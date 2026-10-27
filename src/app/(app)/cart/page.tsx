import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, isMember } from "@/lib/auth/user";
import { getAllowanceFor } from "@/lib/allowance";
import { getOrderRecipient } from "@/lib/shop/recipient";
import { displayFor } from "@/lib/ordering";
import { CartClient, type DeliveryAddress } from "./cart-client";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  // When ordering on behalf of an employee, their budget and maxima apply.
  const recipient = await getOrderRecipient(user);
  const [{ data: addresses }, { settings, allowance }] = await Promise.all([
    createAdminClient()
      .from("company_addresses")
      .select("id, label, recipient, street, postal_code, city, country, is_default")
      .eq("company_id", user.companyId)
      .order("is_default", { ascending: false })
      .order("sort_order"),
    getAllowanceFor(user.companyId, recipient?.id ?? user.id),
  ]);

  return (
    <CartClient
      addresses={(addresses ?? []).map(
        (a): DeliveryAddress => ({
          id: a.id,
          label: a.label,
          recipient: a.recipient,
          street: a.street,
          postal_code: a.postal_code,
          city: a.city,
          country: a.country,
          is_default: a.is_default,
        }),
      )}
      display={displayFor(settings, isMember(user) ? "member" : "manager")}
      payment={settings.payment}
      budgetRemaining={allowance.budget?.remaining ?? null}
      recipient={recipient ? { name: recipient.name, roleName: recipient.roleName } : null}
    />
  );
}
