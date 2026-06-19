import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState, Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { variantLabel } from "@/lib/format";
import { placeOrder } from "./actions";

export const dynamic = "force-dynamic";

type Variant = { id: string; attributes: Record<string, unknown> };
type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  max_quantity_per_order: number | null;
  variants: Variant[];
};

export default async function ProductsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select(
      "id, name, description, category, image_url, max_quantity_per_order, variants:product_variants(id, attributes)",
    )
    .eq("active", true)
    .order("name");

  const products = (data ?? []) as unknown as Product[];
  const canOrder = can(user, "orders.create");

  return (
    <div>
      <PageHeader
        title="Shop"
        description="Browse and order your company's custom products."
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products available"
          description="Your administrator hasn't added products yet."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden p-0">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-muted text-muted-foreground">
                  <Package className="h-8 w-8" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex-1">
                  <h3 className="font-medium">{p.name}</h3>
                  {p.category ? (
                    <p className="text-xs text-muted-foreground">
                      {p.category}
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
                      <Field label="Option">
                        <NativeSelect name="variant_id" required defaultValue="">
                          <option value="" disabled>
                            Select…
                          </option>
                          {p.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {variantLabel(v.attributes)}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                    ) : null}
                    <Field label="Quantity">
                      <Input
                        name="quantity"
                        type="number"
                        min="1"
                        max={p.max_quantity_per_order ?? undefined}
                        defaultValue="1"
                        required
                      />
                    </Field>
                    <SubmitButton className="w-full">Order</SubmitButton>
                  </form>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
