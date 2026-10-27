import { redirect } from "next/navigation";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/server";
import { buildShop } from "@/lib/shop";
import { activeAnnouncement } from "@/lib/announcement";
import { getOrderRecipient } from "@/lib/shop/recipient";
import { ShopView } from "@/components/shop/shop-view";
import type { RecipientOption } from "@/components/shop/recipient-switch";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const recipient = await getOrderRecipient(user);
  const forOthers = can(user, "orders.order_for_others");
  const manager = !isMember(user);

  const [shop, people, { data: companyRow }] = await Promise.all([
    buildShop(
      recipient
        ? {
            id: recipient.id,
            companyId: user.companyId,
            roleId: recipient.roleId,
            permissions: recipient.permissions,
            kind: manager ? "manager" : "member",
            favoritesOf: user.id,
          }
        : {
            id: user.id,
            companyId: user.companyId,
            roleId: user.roleId,
            permissions: user.permissions,
            kind: manager ? "manager" : "member",
          },
    ),
    forOthers
      ? createAdminClient()
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
                role:
                  ((Array.isArray(p.role) ? p.role[0] : p.role) as { name: string } | null)?.name ?? null,
              }),
            ),
          )
      : Promise.resolve([] as RecipientOption[]),
    createAdminClient()
      .from("companies")
      .select("announcement_text, announcement_from, announcement_until")
      .eq("id", user.companyId)
      .maybeSingle(),
  ]);

  const forName = recipient ? recipient.name.split(" ")[0]! : null;

  return (
    <ShopView
      data={shop}
      canOrder={can(user, "orders.create")}
      manager={manager}
      forName={forName}
      canRequest={can(user, "orders.create")}
      title="Winkel"
      description={
        recipient
          ? `Je bestelt namens ${recipient.name}: de maat, het budget en de maxima van ${forName} gelden.`
          : `Bestel de producten van ${user.company?.name ?? "jouw bedrijf"}.`
      }
      recipients={
        forOthers
          ? { people, current: recipient ? { id: recipient.id, name: recipient.name } : null }
          : undefined
      }
      announcement={activeAnnouncement(companyRow)}
      initial={{
        categorie: one("categorie"),
        maat: one("maat"),
        zoek: one("zoek"),
        sorteer: one("sorteer"),
        product: one("product"),
        weergave: one("weergave"),
      }}
    />
  );
}
