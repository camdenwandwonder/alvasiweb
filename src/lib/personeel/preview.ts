import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { buildShop, type ShopData } from "@/lib/shop";

const MANAGEMENT_PERMS = [
  "orders.view_all",
  "orders.approve",
  "users.view",
  "roles.manage",
  "settings.manage",
];

/** The shop as one company employee sees it. Call only after authorising. */
export async function loadShopPreview(
  companyId: string,
  userId: string,
): Promise<{ name: string; roleName: string; shop: ShopData } | null> {
  const admin = createAdminClient();
  const { data: person } = await admin
    .from("profiles")
    .select("id, full_name, email, role_id, company_id, role:roles(name, perms:role_permissions(permission))")
    .eq("id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!person) return null;

  const role = (Array.isArray(person.role) ? person.role[0] : person.role) as
    | { name: string; perms: { permission: string }[] | null }
    | null
    | undefined;
  const permissions = (role?.perms ?? []).map((p) => p.permission);
  const shop = await buildShop({
    id: person.id as string,
    companyId,
    roleId: (person.role_id as string | null) ?? null,
    permissions,
    kind: MANAGEMENT_PERMS.some((p) => permissions.includes(p)) ? "manager" : "member",
  });
  return {
    name: (person.full_name as string | null) || (person.email as string | null) || "medewerker",
    roleName: role?.name ?? "geen",
    shop,
  };
}
