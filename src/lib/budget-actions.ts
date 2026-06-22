"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

async function requireCompanyAccess(companyId: string) {
  const user = await getCurrentUser();
  if (user?.isSuperadmin) return;
  if (user?.companyId === companyId && can(user, "settings.manage")) return;
  throw new Error("Geen toegang");
}

function revalidate(companyId: string) {
  revalidatePath("/budgets");
  revalidatePath(`/admin/companies/${companyId}`);
}

async function mergeSettings(
  companyId: string,
  patch: Record<string, unknown>,
) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();
  const settings = { ...((data?.settings as Record<string, unknown>) ?? {}), ...patch };
  for (const k of Object.keys(patch))
    if (patch[k] === null || patch[k] === undefined || patch[k] === "")
      delete settings[k];
  await admin.from("companies").update({ settings }).eq("id", companyId);
}

export async function setBudgetMode(companyId: string, formData: FormData) {
  await requireCompanyAccess(companyId);
  const mode = String(formData.get("budget_mode") ?? "euro");
  await mergeSettings(companyId, {
    budget_mode: ["euro", "credits", "quantity"].includes(mode) ? mode : "euro",
  });
  revalidate(companyId);
}

export async function saveApprovalThreshold(
  companyId: string,
  formData: FormData,
) {
  await requireCompanyAccess(companyId);
  const raw = String(formData.get("approval_over_amount") ?? "").trim();
  await mergeSettings(companyId, {
    approval_over_amount: raw ? Number(raw) : "",
  });
  revalidate(companyId);
}

export async function createAllowance(
  companyId: string,
  scope: "role" | "user",
  kind: "euro" | "credits",
  formData: FormData,
) {
  await requireCompanyAccess(companyId);
  const admin = createAdminClient();
  const targetId = String(formData.get("target_id") ?? "");
  const amount = Number(formData.get("amount") ?? "0");
  const period = String(formData.get("period") ?? "yearly");
  if (!targetId || !Number.isFinite(amount) || amount <= 0)
    throw new Error("Doel en bedrag zijn verplicht");
  await admin.from("budgets").insert({
    company_id: companyId,
    scope,
    target_id: targetId,
    amount,
    period,
    kind,
  });
  revalidate(companyId);
}

export async function deleteAllowance(companyId: string, id: string) {
  await requireCompanyAccess(companyId);
  await createAdminClient().from("budgets").delete().eq("id", id);
  revalidate(companyId);
}

export async function createAllotment(
  companyId: string,
  scope: "role" | "user",
  formData: FormData,
) {
  await requireCompanyAccess(companyId);
  const admin = createAdminClient();
  const targetId = String(formData.get("target_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const maxQty = Number(formData.get("max_quantity") ?? "0");
  const period = String(formData.get("period") ?? "yearly");
  if (!targetId || !productId || !Number.isFinite(maxQty) || maxQty <= 0)
    throw new Error("Doel, product en aantal zijn verplicht");
  await admin.from("product_allotments").insert({
    company_id: companyId,
    scope,
    target_id: targetId,
    product_id: productId,
    max_quantity: maxQty,
    period,
  });
  revalidate(companyId);
}

export async function deleteAllotment(companyId: string, id: string) {
  await requireCompanyAccess(companyId);
  await createAdminClient().from("product_allotments").delete().eq("id", id);
  revalidate(companyId);
}
