import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState, Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { variantLabel, formatPrice } from "@/lib/format";
import { placeOrder } from "./actions";

export const dynamic = "force-dynamic";

type Variant = { id: string; attributes: Record<string, unknown> };
type Image = { url: string; is_primary: boolean };
type Product = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  max_quantity_per_order: number | null;
  category: { name: string } | null;
  variants: Variant[];
  images: Image[];
};

export default async function ProductsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select(
      "id, name, description, base_price, max_quantity_per_order, category:categories(name), variants:product_variants(id, attributes), images:product_images(url, is_primary)",
    )
    .eq("status", "active")
    .order("name");

  const products = (data ?? []) as unknown as Product[];
  const canOrder = can(user, "orders.create");

  return (
    <div>
      <PageHeader
        title="Winkel"
        description="Blader door en bestel de producten van jouw bedrijf."
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Geen producten beschikbaar"
          description="Je beheerder heeft nog geen producten toegevoegd."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const img =
              p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
            return (
              <Card key={p.id} className="flex flex-col overflow-hidden p-0">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={p.name}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
                    <Package className="h-8 w-8" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">{p.name}</h3>
                      <span className="shrink-0 text-sm font-medium">
                        {formatPrice(p.base_price)}
                      </span>
                    </div>
                    {p.category ? (
                      <p className="text-xs text-muted-foreground">
                        {p.category.name}
                      </p>
                    ) : null}
                    {p.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {p.description}
                      </p>
                    ) : null}
                  </div>

                  {canOrder ? (
                    <form
                      action={placeOrder.bind(null, p.id)}
                      className="mt-4 space-y-3 border-t pt-4"
                    >
                      {p.variants.length > 0 ? (
                        <Field label="Optie">
                          <NativeSelect name="variant_id" required defaultValue="">
                            <option value="" disabled>
                              Kies…
                            </option>
                            {p.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {variantLabel(v.attributes)}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                      ) : null}
                      <Field label="Aantal">
                        <Input
                          name="quantity"
                          type="number"
                          min="1"
                          max={p.max_quantity_per_order ?? undefined}
                          defaultValue="1"
                          required
                        />
                      </Field>
                      <SubmitButton className="w-full">Bestellen</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
