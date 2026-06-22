"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

export type CompanyAddress = {
  id: string;
  company_id: string;
  label: string;
  recipient: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  is_default: boolean;
  sort_order: number;
};

async function requireCompanyAccess(companyId: string) {
  const user = await getCurrentUser();
  if (user?.isSuperadmin) return;
  if (user?.companyId === companyId && can(user, "settings.manage")) return;
  throw new Error("Geen toegang");
}

function revalidate(companyId: string) {
  revalidatePath("/settings");
  revalidatePath("/cart");
  revalidatePath(`/admin/companies/${companyId}`);
}

function field(fd: FormData, name: string): string | null {
  const v = String(fd.get(name) ?? "").trim();
  return v || null;
}

export async function createAddress(companyId: string, formData: FormData) {
  await requireCompanyAccess(companyId);
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("Geef een naam op voor het adres");

  const admin = createAdminClient();
  const { count } = await admin
    .from("company_addresses")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  const isDefault =
    formData.get("is_default") === "on" || (count ?? 0) === 0;

  const { error } = await admin.from("company_addresses").insert({
    company_id: companyId,
    label,
    recipient: field(formData, "recipient"),
    street: field(formData, "street"),
    postal_code: field(formData, "postal_code"),
    city: field(formData, "city"),
    country: field(formData, "country"),
    is_default: isDefault,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidate(companyId);
}

export async function setDefaultAddress(companyId: string, addressId: string) {
  await requireCompanyAccess(companyId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("company_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
  revalidate(companyId);
}

export async function deleteAddress(companyId: string, addressId: string) {
  await requireCompanyAccess(companyId);
  const admin = createAdminClient();

  const { data: removed } = await admin
    .from("company_addresses")
    .select("is_default")
    .eq("id", addressId)
    .single();

  const { error } = await admin
    .from("company_addresses")
    .delete()
    .eq("id", addressId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);

  // If we removed the default, promote the next one so there is always a default.
  if (removed?.is_default) {
    const { data: next } = await admin
      .from("company_addresses")
      .select("id")
      .eq("company_id", companyId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (next?.id)
      await admin
        .from("company_addresses")
        .update({ is_default: true })
        .eq("id", next.id);
  }
  revalidate(companyId);
}
