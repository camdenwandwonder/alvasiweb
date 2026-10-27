import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { can, type CurrentUser } from "@/lib/auth/user";

export const RECIPIENT_COOKIE = "alvasi-bestellen-voor";

export type OrderRecipient = {
  id: string;
  name: string;
  email: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
};

/**
 * The employee a manager is ordering for, or null when ordering for oneself.
 * Re-validated on every read: permission, same company, account active.
 */
export async function getOrderRecipient(user: CurrentUser | null): Promise<OrderRecipient | null> {
  if (!user?.companyId || !can(user, "orders.order_for_others")) return null;
  const id = (await cookies()).get(RECIPIENT_COOKIE)?.value;
  if (!id || id === user.id) return null;
  return loadRecipient(user.companyId, id);
}

export async function loadRecipient(companyId: string, userId: string): Promise<OrderRecipient | null> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email, status, company_id, role_id, role:roles(name, perms:role_permissions(permission))")
    .eq("id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data || data.status === "disabled") return null;
  const role = (Array.isArray(data.role) ? data.role[0] : data.role) as
    | { name: string; perms: { permission: string }[] | null }
    | null;
  return {
    id: data.id as string,
    name: (data.full_name as string | null) || (data.email as string | null) || "Medewerker",
    email: (data.email as string | null) ?? null,
    roleId: (data.role_id as string | null) ?? null,
    roleName: role?.name ?? null,
    permissions: (role?.perms ?? []).map((p) => p.permission),
  };
}
