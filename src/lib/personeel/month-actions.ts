"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES } from "@/lib/allowance";
import { companyGate } from "@/lib/company-gate";

export type MonthTotals = { orders: number; value: number; credits: number };

export type MonthOverview = {
  /** YYYY-MM */
  month: string;
  current: MonthTotals & { orderers: number };
  previous: MonthTotals;
  pendingApproval: number;
  rejected: number;
  topProducts: { name: string; quantity: number }[];
  byRole: { roleId: string | null; orders: number; value: number; credits: number; orderers: number }[];
  newPeople: string[];
  requests: { pending: number; approved: number; declined: number; approvedAmount: number };
};

/** Midnight on the 1st of the month in Dutch time, as a UTC instant. */
function monthStart(year: number, monthIndex: number): Date {
  const utc = new Date(Date.UTC(year, monthIndex, 1));
  const local = new Date(utc.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const asUtc = new Date(utc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(utc.getTime() - (local.getTime() - asUtc.getTime()));
}

function totals(rows: { total: unknown; credit_total: unknown }[]): MonthTotals {
  return {
    orders: rows.length,
    value: Math.round(rows.reduce((s, o) => s + Number(o.total ?? 0), 0) * 100) / 100,
    credits: Math.round(rows.reduce((s, o) => s + Number(o.credit_total ?? 0), 0)),
  };
}

export async function getMonthOverview(
  companyId: string,
  month: string,
): Promise<{ ok: true; overview: MonthOverview } | { ok: false; error: string }> {
  if (
    !(await companyGate(companyId, "users.view")) &&
    !(await companyGate(companyId, "settings.manage"))
  )
    return { ok: false, error: "Geen toegang" };

  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return { ok: false, error: "Ongeldige maand." };
  const year = Number(m[1]);
  const index = Number(m[2]) - 1;
  const start = monthStart(year, index);
  const end = monthStart(year, index + 1);
  const prevStart = monthStart(year, index - 1);

  const admin = createAdminClient();
  const [{ data: orders }, { data: items }, { data: people }, { data: requests }] =
    await Promise.all([
      admin
        .from("orders")
        .select("ordered_by, total, credit_total, status, created_at")
        .eq("company_id", companyId)
        .gte("created_at", prevStart.toISOString())
        .lt("created_at", end.toISOString()),
      admin
        .from("order_items")
        .select("product_name, quantity, parent:orders!inner(created_at, status)")
        .eq("company_id", companyId)
        .gte("parent.created_at", start.toISOString())
        .lt("parent.created_at", end.toISOString())
        .in("parent.status", ACTIVE_STATUSES),
      admin
        .from("profiles")
        .select("id, full_name, email, role_id, created_at")
        .eq("company_id", companyId),
      admin
        .from("budget_requests")
        .select("status, amount")
        .eq("company_id", companyId)
        .eq("kind", "request")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString()),
    ]);

  const all = orders ?? [];
  const inMonth = all.filter((o) => new Date(o.created_at as string) >= start);
  const active = inMonth.filter((o) => ACTIVE_STATUSES.includes(o.status as string));
  const prevActive = all.filter(
    (o) => new Date(o.created_at as string) < start && ACTIVE_STATUSES.includes(o.status as string),
  );

  const roleOf = new Map((people ?? []).map((p) => [p.id as string, (p.role_id as string | null) ?? null]));
  const byRole = new Map<string | null, { rows: typeof active; orderers: Set<string> }>();
  for (const o of active) {
    const roleId = roleOf.get(o.ordered_by as string) ?? null;
    const entry = byRole.get(roleId) ?? { rows: [], orderers: new Set<string>() };
    entry.rows.push(o);
    entry.orderers.add(o.ordered_by as string);
    byRole.set(roleId, entry);
  }

  const products = new Map<string, number>();
  for (const i of items ?? []) {
    const name = (i.product_name as string) || "Onbekend product";
    products.set(name, (products.get(name) ?? 0) + Number(i.quantity ?? 0));
  }

  const reqs = requests ?? [];
  return {
    ok: true,
    overview: {
      month,
      current: {
        ...totals(active),
        orderers: new Set(active.map((o) => o.ordered_by as string)).size,
      },
      previous: totals(prevActive),
      pendingApproval: inMonth.filter((o) => o.status === "pending_approval").length,
      rejected: inMonth.filter((o) => o.status === "rejected").length,
      topProducts: [...products.entries()]
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 6),
      byRole: [...byRole.entries()]
        .map(([roleId, e]) => ({ roleId, ...totals(e.rows), orderers: e.orderers.size }))
        .sort((a, b) => b.value - a.value),
      newPeople: (people ?? [])
        .filter((p) => {
          const at = new Date(p.created_at as string);
          return at >= start && at < end;
        })
        .map((p) => p.id as string),
      requests: {
        pending: reqs.filter((r) => r.status === "pending").length,
        approved: reqs.filter((r) => r.status === "approved").length,
        declined: reqs.filter((r) => r.status === "declined").length,
        approvedAmount: reqs
          .filter((r) => r.status === "approved")
          .reduce((s, r) => s + Number(r.amount), 0),
      },
    },
  };
}
