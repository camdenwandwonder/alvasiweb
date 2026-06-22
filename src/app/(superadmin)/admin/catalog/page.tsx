import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/primitives";
import { ProductThumb } from "@/components/product-thumb";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  status: string;
  base_price: number | null;
  company: { name: string } | null;
  category: { name: string } | null;
  images: { url: string; is_primary: boolean }[];
};

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Actief", variant: "default" },
  draft: { label: "Concept", variant: "secondary" },
  archived: { label: "Gearchiveerd", variant: "outline" },
};

export default async function CatalogPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select(
      "id, name, status, base_price, company:companies(name), category:categories(name), images:product_images(url, is_primary)",
    )
    .order("created_at", { ascending: false });

  const products = (data ?? []) as unknown as Product[];

  return (
    <div>
      <PageHeader
        title="Catalogus"
        description="Alle producten van alle bedrijven."
        action={
          <Link href="/admin/catalog/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw product
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nog geen producten"
          description="Maak je eerste product aan."
          action={
            <Link href="/admin/catalog/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuw product
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const status = STATUS[p.status] ?? STATUS.active;
            return (
              <Link key={p.id} href={`/admin/catalog/${p.id}`} className="group">
                <Card className="overflow-hidden p-0 transition hover:border-foreground/20 hover:shadow-md">
                  <ProductThumb
                    images={p.images ?? []}
                    alt={p.name}
                    className="aspect-square w-full"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">{p.name}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.company?.name ?? "—"}
                      {p.category ? ` · ${p.category.name}` : ""}
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {formatPrice(p.base_price)}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
