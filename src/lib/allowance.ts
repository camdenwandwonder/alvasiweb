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
};

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

/**
 * Computes the member's remaining allowance for the company's budget mode.
 * Part A: euro mode (sum of order totals vs the most specific budget). Credits
 * and quantity modes are returned as "no limit" until Part B wires them up.
 */
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

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", user.companyId)
    .maybeSingle();
  const settings = (company?.settings as Record<string, unknown>) ?? {};
  const mode = (settings.budget_mode as BudgetMode) ?? "euro";

  if (mode !== "euro") return { ...empty, mode };

  // Most specific budget: user budget overrides role budget.
  let budget: { amount: number; period: string } | null = null;
  const { data: userBudget } = await supabase
    .from("budgets")
    .select("amount, period")
    .eq("company_id", user.companyId)
    .eq("scope", "user")
    .eq("target_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  budget = userBudget ?? null;
  if (!budget && user.roleId) {
    const { data: roleBudget } = await supabase
      .from("budgets")
      .select("amount, period")
      .eq("company_id", user.companyId)
      .eq("scope", "role")
      .eq("target_id", user.roleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    budget = roleBudget ?? null;
  }
  if (!budget) return { mode, hasLimit: false, total: null, used: 0, remaining: null, period: null };

  const { data: orders } = await supabase
    .from("orders")
    .select("total, created_at, status")
    .eq("company_id", user.companyId)
    .eq("ordered_by", user.id)
    .gte("created_at", periodStart(budget.period).toISOString());
  const used = (orders ?? [])
    .filter((o) =>
      ["approved", "fulfilled", "pending_approval"].includes(o.status),
    )
    .reduce((s, o) => s + Number(o.total ?? 0), 0);

  return {
    mode,
    hasLimit: true,
    total: Number(budget.amount),
    used,
    remaining: Number(budget.amount) - used,
    period: budget.period,
  };
}
