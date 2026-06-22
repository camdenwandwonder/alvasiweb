import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/user";

export type BudgetMode = "euro" | "credits" | "quantity";

export type Allowance = {
  mode: BudgetMode;
  hasLimit: boolean;
  total: number | null; // null = unlimited
  used: number;
  remaining: number | null;
  period: string | null;
  /** quantity mode: per-product remaining quota. */
  perProduct?: Record<string, { max: number; used: number; remaining: number }>;
};

const ACTIVE_STATUSES = ["approved", "fulfilled", "pending_approval"];

export function periodStart(period: string): Date {
  const now = new Date();
  if (period === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarterly") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), q, 1);
  }
  if (period === "yearly") return new Date(now.getFullYear(), 0, 1);
  return new Date(0); // "once"
}

export async function getAllowance(
  user: CurrentUser | null,
): Promise<Allowance> {
  const empty: Allowance = {
    mode: "euro",
    hasLimit: false,
    total: null,
    used: 0,
    remaining: null,
    period: null,
  };
  if (!user?.companyId) return empty;

  const supabase = await createClient();
  const companyId = user.companyId;

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const settings = (company?.settings as Record<string, unknown>) ?? {};
  const mode = (settings.budget_mode as BudgetMode) ?? "euro";

  if (mode === "quantity") return getQuantityAllowance(user);

  // euro / credits: a single value budget of the matching kind.
  const wantCredits = mode === "credits";
  let budget: { amount: number; period: string } | null = null;

  for (const scope of ["user", "role"] as const) {
    const target = scope === "user" ? user.id : user.roleId;
    if (!target) continue;
    const { data } = await supabase
      .from("budgets")
      .select("amount, period, kind")
      .eq("company_id", companyId)
      .eq("scope", scope)
      .eq("target_id", target)
      .order("created_at", { ascending: false });
    const match = (data ?? []).find((b) =>
      wantCredits ? b.kind === "credits" : b.kind !== "credits",
    );
    if (match) {
      budget = { amount: Number(match.amount), period: match.period };
      break;
    }
  }
  if (!budget)
    return { mode, hasLimit: false, total: null, used: 0, remaining: null, period: null };

  const { data: orders } = await supabase
    .from("orders")
    .select("total, credit_total, created_at, status")
    .eq("company_id", companyId)
    .eq("ordered_by", user.id)
    .gte("created_at", periodStart(budget.period).toISOString());
  const used = (orders ?? [])
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .reduce(
      (s, o) => s + Number((wantCredits ? o.credit_total : o.total) ?? 0),
      0,
    );

  return {
    mode,
    hasLimit: true,
    total: budget.amount,
    used,
    remaining: budget.amount - used,
    period: budget.period,
  };
}

async function getQuantityAllowance(user: CurrentUser): Promise<Allowance> {
  const supabase = await createClient();
  const companyId = user.companyId!;

  // Allotments: user overrides role, per product.
  const perProduct: Record<string, { max: number; period: string }> = {};
  for (const scope of ["role", "user"] as const) {
    const target = scope === "role" ? user.roleId : user.id;
    if (!target) continue;
    const { data } = await supabase
      .from("product_allotments")
      .select("product_id, max_quantity, period")
      .eq("company_id", companyId)
      .eq("scope", scope)
      .eq("target_id", target);
    for (const a of data ?? [])
      perProduct[a.product_id] = { max: a.max_quantity, period: a.period };
  }

  const out: Record<string, { max: number; used: number; remaining: number }> = {};
  if (Object.keys(perProduct).length === 0)
    return {
      mode: "quantity",
      hasLimit: false,
      total: null,
      used: 0,
      remaining: null,
      period: null,
      perProduct: out,
    };

  // The user's recent orders + their items.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at, status")
    .eq("company_id", companyId)
    .eq("ordered_by", user.id);
  const okOrders = (orders ?? []).filter((o) =>
    ACTIVE_STATUSES.includes(o.status),
  );
  const orderDate = new Map(okOrders.map((o) => [o.id, new Date(o.created_at)]));
  const ids = okOrders.map((o) => o.id);

  let items: { order_id: string; product_id: string | null; quantity: number }[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("order_items")
      .select("order_id, product_id, quantity")
      .in("order_id", ids);
    items = data ?? [];
  }

  for (const [pid, info] of Object.entries(perProduct)) {
    const since = periodStart(info.period);
    const used = items
      .filter(
        (i) =>
          i.product_id === pid &&
          (orderDate.get(i.order_id) ?? new Date(0)) >= since,
      )
      .reduce((s, i) => s + i.quantity, 0);
    out[pid] = { max: info.max, used, remaining: info.max - used };
  }

  return {
    mode: "quantity",
    hasLimit: true,
    total: null,
    used: 0,
    remaining: null,
    period: null,
    perProduct: out,
  };
}
