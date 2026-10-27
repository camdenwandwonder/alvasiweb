import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ShopGrid } from "@/components/shop-grid";
import { AllowanceBanner } from "@/components/allowance-banner";
import type { ShopData } from "@/lib/shop";

/** Read-only look at the shop exactly as one employee sees it. */
export function ShopPreview({
  name,
  roleName,
  shop,
  backHref,
}: {
  name: string;
  roleName: string;
  shop: ShopData;
  backHref: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-3 sm:flex-row sm:items-center">
        <Eye className="h-5 w-5 shrink-0 text-[var(--brand)]" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Je bekijkt de winkel als {name}</p>
          <p className="text-muted-foreground">
            Functie {roleName}. Dit is een voorbeeld: bestellen kan hier niet.
          </p>
        </div>
        <Link href={backHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="h-4 w-4" /> Terug naar personeel
        </Link>
      </div>

      <AllowanceBanner
        settings={shop.settings}
        allowance={shop.allowance}
        display={shop.display}
        missingSizes={shop.missingSizes}
        canRequest={false}
      />

      <ShopGrid
        products={shop.products}
        categories={shop.categories}
        display={shop.display}
        canOrder={false}
        preferredSizes={shop.preferredSizes}
        preview
      />
    </div>
  );
}
