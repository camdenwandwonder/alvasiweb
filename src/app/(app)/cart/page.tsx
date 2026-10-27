import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { getOrderRecipient } from "@/lib/shop/recipient";
import { readOrderPrefs } from "@/lib/company-prefs";
import type { RecipientOption } from "@/components/shop/recipient-switch";
import { CartClient, type DeliveryAddress } from "./cart-client";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");
  if (!can(user, "orders.create")) redirect("/products");

  const forOthers = can(user, "orders.order_for_others");
  const admin = createAdminClient();
  const [recipient, { data: addresses }, people, { data: companyRow }] = await Promise.all([
    getOrderRecipient(user),
    admin
      .from("company_addresses")
      .select("id, label, recipient, street, postal_code, city, country, is_default")
      .eq("company_id", user.companyId)
      .is("archived_at", null)
      .order("is_default", { ascending: false })
      .order("sort_order"),
    forOthers
      ? admin
          .from("profiles")
          .select("id, full_name, email, status, role:roles(name)")
          .eq("company_id", user.companyId)
          .neq("id", user.id)
          .neq("status", "disabled")
          .order("full_name")
          .then(({ data }) =>
            (data ?? []).map(
              (p): RecipientOption => ({
                id: p.id as string,
                name: (p.full_name as string | null) || (p.email as string | null) || "Medewerker",
                role: ((Array.isArray(p.role) ? p.role[0] : p.role) as { name: string } | null)?.name ?? null,
              }),
            ),
          )
      : Promise.resolve([] as RecipientOption[]),
    admin.from("companies").select("settings").eq("id", user.companyId).maybeSingle(),
  ]);

  return (
    <CartClient
      addresses={(addresses ?? []) as DeliveryAddress[]}
      me={user.fullName ?? user.email ?? "jezelf"}
      recipient={recipient ? { id: recipient.id, name: recipient.name, roleName: recipient.roleName } : null}
      people={forOthers ? people : null}
      prefs={readOrderPrefs(companyRow?.settings as Record<string, unknown> | null)}
    />
  );
}
