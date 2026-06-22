import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { CartClient, type DeliveryAddress } from "./cart-client";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: addresses } = await supabase
    .from("company_addresses")
    .select(
      "id, label, recipient, street, postal_code, city, country, is_default",
    )
    .eq("company_id", user?.companyId ?? "")
    .order("is_default", { ascending: false })
    .order("sort_order");

  return <CartClient addresses={(addresses ?? []) as DeliveryAddress[]} />;
}
