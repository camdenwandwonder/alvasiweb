import { redirect } from "next/navigation";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { parseQuery } from "@/lib/orders/filters";
import { loadOverview, savedViewScope, type OverviewScope } from "@/lib/orders/overview";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.companyId) redirect(user.isSuperadmin ? "/admin/bestellingen" : "/login");

  const sp = await searchParams;
  const query = parseQuery(sp);
  const viewAll = can(user, "orders.view_all");
  if (!viewAll && !can(user, "orders.view_own")) redirect("/products");

  const scope: OverviewScope = viewAll
    ? { mode: "company", companyId: user.companyId, userId: user.id }
    : { mode: "own", companyId: user.companyId, userId: user.id, member: isMember(user) };
  const data = await loadOverview(scope, query);
  const bestelling = typeof sp.bestelling === "string" && UUID.test(sp.bestelling) ? sp.bestelling : null;

  return (
    <OrdersWorkspace
      data={data}
      query={query}
      basePath="/orders"
      detailBase="/orders/"
      title={viewAll ? "Bestellingen" : "Mijn bestellingen"}
      description={
        viewAll
          ? `Wie wat heeft besteld bij ${user.company?.name ?? "je bedrijf"}, per periode.`
          : "Alles wat je hebt besteld, met de status van elke bestelling."
      }
      canApprove={can(user, "orders.approve")}
      scopeKey={savedViewScope(scope)}
      initialOrderId={bestelling}
    />
  );
}
