import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { parseQuery } from "@/lib/orders/filters";
import { loadOverview, savedViewScope, type OverviewScope } from "@/lib/orders/overview";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminOrdersOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) redirect("/dashboard");

  const sp = await searchParams;
  const query = parseQuery(sp);
  const scope: OverviewScope = { mode: "admin", userId: user.id };
  const data = await loadOverview(scope, query);
  const bestelling = typeof sp.bestelling === "string" && UUID.test(sp.bestelling) ? sp.bestelling : null;

  return (
    <OrdersWorkspace
      data={data}
      query={query}
      basePath="/admin/bestellingen"
      detailBase="/admin/orders/"
      title="Bestellingen"
      description="Alle bestellingen van alle bedrijven, per periode, medewerker en product."
      canApprove
      scopeKey={savedViewScope(scope)}
      initialOrderId={bestelling}
    />
  );
}
