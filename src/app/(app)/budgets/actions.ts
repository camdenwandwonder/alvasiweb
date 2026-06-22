"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

async function requireSettings() {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "settings.manage"))
    throw new Error("Geen toegang");
  return user;
}

export async function createBudget(scope: "role" | "user", formData: FormData) {
  const user = await requireSettings();
  const supabase = await createClient();
  const targetId = String(formData.get("target_id") ?? "");
  const amount = Number(formData.get("amount") ?? "0");
  const period = String(formData.get("period") ?? "yearly");
  if (!targetId || !Number.isFinite(amount) || amount <= 0)
    throw new Error("Doel en bedrag zijn verplicht");

  const { error } = await supabase.from("budgets").insert({
    company_id: user.companyId,
    scope,
    target_id: targetId,
    amount,
    period,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/budgets");
}

export async function deleteBudget(id: string) {
  await requireSettings();
  const supabase = await createClient();
  await supabase.from("budgets").delete().eq("id", id);
  revalidatePath("/budgets");
}

export async function saveApprovalThreshold(formData: FormData) {
  const user = await requireSettings();
  const supabase = await createClient();
  const raw = String(formData.get("approval_over_amount") ?? "").trim();

  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", user.companyId)
    .single();
  const settings = (company?.settings as Record<string, unknown>) ?? {};
  if (raw) settings.approval_over_amount = Number(raw);
  else delete settings.approval_over_amount;

  const { error } = await supabase
    .from("companies")
    .update({ settings })
    .eq("id", user.companyId);
  if (error) throw new Error(error.message);
  revalidatePath("/budgets");
}
