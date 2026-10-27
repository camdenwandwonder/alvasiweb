import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

/** The signed-in manager's company row, or null when not allowed. */
export async function loadSettingsCompany() {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "settings.manage")) return null;
  const { data } = await createAdminClient()
    .from("companies")
    .select(
      "id, name, short_name, logo_url, logo_icon_url, primary_color, secondary_color, settings, welcome_text, announcement_text, announcement_from, announcement_until, contact_name, contact_email, contact_phone, alvasi_contact_name, alvasi_contact_email, alvasi_contact_phone",
    )
    .eq("id", user.companyId)
    .maybeSingle();
  return data ? { user, company: data } : null;
}

export async function loadCompanyRow(companyId: string) {
  const { data } = await createAdminClient()
    .from("companies")
    .select(
      "id, name, short_name, logo_url, logo_icon_url, primary_color, secondary_color, settings, welcome_text, announcement_text, announcement_from, announcement_until, contact_name, contact_email, contact_phone, alvasi_contact_name, alvasi_contact_email, alvasi_contact_phone",
    )
    .eq("id", companyId)
    .maybeSingle();
  return data;
}

export async function loadAddresses(companyId: string) {
  const { data } = await createAdminClient()
    .from("company_addresses")
    .select("*")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .order("sort_order");
  return data ?? [];
}

export async function loadStartImages(companyId: string) {
  const { data } = await createAdminClient()
    .from("company_media")
    .select("id, url")
    .eq("company_id", companyId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as { id: string; url: string }[];
}
