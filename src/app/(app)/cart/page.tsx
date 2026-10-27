import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, isMember } from "@/lib/auth/user";
import { getAllowance } from "@/lib/allowance";
import { displayFor } from "@/lib/ordering";
import { CartClient, type DeliveryAddress } from "./cart-client";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const [{ data: addresses }, { settings, allowance }] = await Promise.all([
    createAdminClient()
      .from("company_addresses")
      .select("id, label, recipient, street, postal_code, city, country, is_default")
      .eq("company_id", user.companyId)
      .order("is_default", { ascending: false })
      .order("sort_order"),
    getAllowance(user),
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
    />
  );
}
