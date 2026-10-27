import { redirect } from "next/navigation";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { PageHeader } from "@/components/primitives";
import { ShopGrid } from "@/components/shop-grid";
import { AllowanceBanner } from "@/components/allowance-banner";
import { buildShop } from "@/lib/shop";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId) redirect("/login");

  const shop = await buildShop({
    id: user.id,
    companyId: user.companyId,
    roleId: user.roleId,
    permissions: user.permissions,
    kind: isMember(user) ? "member" : "manager",
  });
  const canOrder = can(user, "orders.create");

  return (
    <div>
      <PageHeader
        title="Winkel"
        description="Blader door en bestel de producten van jouw bedrijf."
      />

      <AllowanceBanner
        settings={shop.settings}
        allowance={shop.allowance}
        display={shop.display}
        missingSizes={shop.missingSizes}
        canRequest={canOrder}
      />

      <ShopGrid
        products={shop.products}
        categories={shop.categories}
        display={shop.display}
        canOrder={canOrder}
        preferredSizes={shop.preferredSizes}
      />
    </div>
  );
}
