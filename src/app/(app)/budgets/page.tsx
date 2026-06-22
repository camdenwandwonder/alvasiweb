import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { PageHeader } from "@/components/primitives";
import { BudgetSettingsPanel } from "@/components/budget-settings-panel";
import type { BudgetMode } from "@/lib/allowance";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const user = await getCurrentUser();
  if (!can(user, "settings.manage")) redirect("/dashboard");
  const supabase = await createClient();
  const companyId = user!.companyId!;

  const [
    { data: roles },
    { data: people },
    { data: products },
    { data: budgets },
    { data: allotments },
    { data: company },
  ] = await Promise.all([
    supabase.from("roles").select("id, name").eq("company_id", companyId).order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("company_id", companyId)
      .order("full_name"),
    supabase.from("products").select("id, name").eq("company_id", companyId).order("name"),
    supabase
      .from("budgets")
      .select("id, scope, target_id, amount, period, kind")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_allotments")
      .select("id, scope, target_id, product_id, max_quantity, period")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("settings").eq("id", companyId).single(),
  ]);

  const settings = (company?.settings as Record<string, unknown>) ?? {};
  const mode = (settings.budget_mode as BudgetMode) ?? "euro";
  const threshold = settings.approval_over_amount;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Regels & budgetten"
        description="Bepaal de bestelwijze, goedkeuringsregels en bestedingslimieten."
      />
      <BudgetSettingsPanel
        companyId={companyId}
        mode={mode}
        approvalThreshold={threshold != null ? String(threshold) : ""}
        roles={roles ?? []}
        people={people ?? []}
        products={products ?? []}
        budgets={(budgets ?? []) as never}
        allotments={(allotments ?? []) as never}
      />
    </div>
  );
}
