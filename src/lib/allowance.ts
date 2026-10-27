import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/user";
import {
  periodReset,
  periodStart,
  readOrderingSettings,
  type OrderingSettings,
  type PaymentMode,
} from "@/lib/ordering";

/** Orders in these statuses use up budget and maxima (rejected/cancelled do not). */
export const ACTIVE_STATUSES = [
  "pending_approval",
  "approved",
  "in_production",
  "shipped",
  "delivered",
  "fulfilled",
];

export type BudgetState = {
  /** Base amount from the functie or the personal exception. */
  base: number;
  /** Approved extra budget (requests, welcome) within this period. */
  extra: number;
  total: number;
  used: number;
  remaining: number;
  period: string;
  source: "role" | "user";
  resetsAt: string | null;
};

export type CapState = {
  max: number;
  used: number;
  remaining: number;
  period: string;
  source: "role" | "user";
};

export type PersonAllowance = {
  payment: PaymentMode;
  budget: BudgetState | null;
  capsEnabled: boolean;
  uncapped: "free" | "blocked";
  /** Per product id; only products that have a maximum. */
  caps: Record<string, CapState>;
};

type BudgetRow = {
  scope: "role" | "user";
  target_id: string;
  amount: number;
  period: string;
  kind: string;
};
type AllotRow = {
  scope: "role" | "user";
  target_id: string;
  product_id: string;
  max_quantity: number;
  period: string;
};

/**
 * Budget and maxima for (some of) the people of one company, in a handful of
 * queries. Call only after authorising access to this company.
 */
export async function computeAllowances(
  companyId: string,
  userIds?: string[],
): Promise<{ settings: OrderingSettings; byUser: Map<string, PersonAllowance> }> {
  const admin = createAdminClient();

  let peopleQ = admin.from("profiles").select("id, role_id").eq("company_id", companyId);
  if (userIds) peopleQ = peopleQ.in("id", userIds.length ? userIds : ["-"]);

  const [{ data: company }, { data: people }, { data: budgets }, { data: allots }] =
    await Promise.all([
      admin.from("companies").select("settings").eq("id", companyId).maybeSingle(),
      peopleQ,
      admin
        .from("budgets")
        .select("scope, target_id, amount, period, kind")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      admin
        .from("product_allotments")
        .select("scope, target_id, product_id, max_quantity, period")
        .eq("company_id", companyId),
    ]);

  const settings = readOrderingSettings(company?.settings as Record<string, unknown>);
  const ids = (people ?? []).map((p) => p.id as string);
  const byUser = new Map<string, PersonAllowance>();
  if (!ids.length) return { settings, byUser };

  const kind = settings.payment === "credits" ? "credits" : "euro";
  const budgetRows = ((budgets ?? []) as BudgetRow[]).filter(
    (b) => (b.kind === "credits" ? "credits" : "euro") === kind,
  );
  const allotRows = (allots ?? []) as AllotRow[];

  const [{ data: orders }, { data: extras }] = await Promise.all([
    admin
      .from("orders")
      .select("id, ordered_by, total, credit_total, credit_rate, created_at, status")
      .eq("company_id", companyId)
      .in("ordered_by", ids)
      .in("status", ACTIVE_STATUSES),
    admin
      .from("budget_requests")
      .select("user_id, amount, unit, decided_at")
      .eq("company_id", companyId)
      .eq("status", "approved")
      .eq("unit", kind)
      .in("user_id", ids),
  ]);

  const orderRows = orders ?? [];
  let items: { order_id: string; product_id: string | null; quantity: number }[] = [];
  if (settings.capsEnabled && orderRows.length) {
    const { data } = await admin
      .from("order_items")
      .select("order_id, product_id, quantity")
      .in(
        "order_id",
        orderRows.map((o) => o.id),
      );
    items = data ?? [];
  }
  const orderOf = new Map(orderRows.map((o) => [o.id as string, o]));

  for (const p of people ?? []) {
    const userId = p.id as string;
    const roleId = p.role_id as string | null;
    const mine = orderRows.filter((o) => o.ordered_by === userId);

    // Budget: personal exception wins over the functie.
    let budget: BudgetState | null = null;
    if (settings.payment !== "none") {
      const row =
        budgetRows.find((b) => b.scope === "user" && b.target_id === userId) ??
        (roleId
          ? budgetRows.find((b) => b.scope === "role" && b.target_id === roleId)
          : undefined);
      if (row) {
        const since = periodStart(row.period);
        const used = mine
          .filter((o) => new Date(o.created_at as string) >= since)
          .reduce((s, o) => {
            if (settings.payment === "credits") {
              // Normalise to the current rate so a rate change keeps value.
              const orderRate = Number(o.credit_rate ?? settings.creditRate) || settings.creditRate;
              return s + (Number(o.credit_total ?? 0) * orderRate) / settings.creditRate;
            }
            return s + Number(o.total ?? 0);
          }, 0);
        const extra = (extras ?? [])
          .filter(
            (e) =>
              e.user_id === userId &&
              e.decided_at &&
              new Date(e.decided_at as string) >= since,
          )
          .reduce((s, e) => s + Number(e.amount), 0);
        const base = Number(row.amount);
        const total = base + extra;
        const reset = periodReset(row.period);
        budget = {
          base,
          extra,
          total,
          used: Math.round(used * 100) / 100,
          remaining: Math.round((total - used) * 100) / 100,
          period: row.period,
          source: row.scope,
          resetsAt: reset ? reset.toISOString() : null,
        };
      }
    }

    // Maxima per product: personal exception per product wins.
    const caps: Record<string, CapState> = {};
    if (settings.capsEnabled) {
      const rules = new Map<string, AllotRow>();
      for (const a of allotRows)
        if (a.scope === "role" && roleId && a.target_id === roleId) rules.set(a.product_id, a);
      for (const a of allotRows)
        if (a.scope === "user" && a.target_id === userId) rules.set(a.product_id, a);
      for (const [productId, a] of rules) {
        const since = periodStart(a.period);
        const used = items
          .filter((i) => {
            const o = orderOf.get(i.order_id);
            return (
              i.product_id === productId &&
              o?.ordered_by === userId &&
              new Date(o.created_at as string) >= since
            );
          })
          .reduce((s, i) => s + i.quantity, 0);
        caps[productId] = {
          max: a.max_quantity,
          used,
          remaining: a.max_quantity - used,
          period: a.period,
          source: a.scope,
        };
      }
    }

    byUser.set(userId, {
      payment: settings.payment,
      budget,
      capsEnabled: settings.capsEnabled,
      uncapped: settings.uncapped,
      caps,
    });
  }

  return { settings, byUser };
}

const EMPTY: PersonAllowance = {
  payment: "none",
  budget: null,
  capsEnabled: false,
  uncapped: "free",
  caps: {},
};

/** Allowance of one company user (the signed-in member, or a previewed one). */
export async function getAllowanceFor(
  companyId: string,
  userId: string,
): Promise<{ settings: OrderingSettings; allowance: PersonAllowance }> {
  const { settings, byUser } = await computeAllowances(companyId, [userId]);
  return { settings, allowance: byUser.get(userId) ?? { ...EMPTY, payment: settings.payment } };
}

export async function getAllowance(user: CurrentUser | null) {
  if (!user?.companyId) {
    return {
      settings: readOrderingSettings({}),
      allowance: EMPTY,
    };
  }
  return getAllowanceFor(user.companyId, user.id);
}
