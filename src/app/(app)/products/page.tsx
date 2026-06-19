import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
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
        title="Products"
        description="Browse and order your company's custom products."
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products available"
          description="Your administrator hasn't added products yet."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="flex flex-col">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="mb-3 h-40 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="mb-3 flex h-40 w-full items-center justify-center rounded-lg bg-border/40 text-sm text-muted">
                  No image
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium">{p.name}</h3>
                {p.category ? (
                  <p className="text-xs text-muted">{p.category}</p>
                ) : null}
                {p.description ? (
                  <p className="mt-1 text-sm text-muted">{p.description}</p>
                ) : null}
              </div>

              {canOrder ? (
                <form
                  action={placeOrder.bind(null, p.id)}
                  className="mt-4 space-y-3 border-t border-border pt-4"
                >
                  {p.variants.length > 0 ? (
                    <Field label="Option">
                      <Select name="variant_id" required defaultValue="">
                        <option value="" disabled>
                          Select…
                        </option>
                        {p.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {variantLabel(v.attributes)}
                          </option>
                        ))}
                      </Select>
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
                  <Button type="submit" className="w-full">
                    Order
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
