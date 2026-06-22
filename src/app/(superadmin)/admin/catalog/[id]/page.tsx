import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Archive } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProductEditor } from "../product-editor";
import { ProductImages } from "../product-images";
import { duplicateProduct, setProductStatus, deleteProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("*, company:companies(name)")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();
  const companyId = product.company_id as string;

  const [{ data: categories }, { data: axesData }, { data: options }, { data: images }] =
    await Promise.all([
      admin.from("categories").select("id, name").eq("active", true).order("sort_order"),
      admin
        .from("category_option_sets")
        .select(
          "sort_order, option_set:option_sets(id, name, kind, values:option_values(id, value, label, swatch, sort_order))",
        )
        .eq("category_id", product.category_id ?? "")
        .order("sort_order"),
      admin
        .from("product_options")
        .select("option_set_id, selected_value_ids")
        .eq("product_id", id),
      admin
        .from("product_images")
        .select("id, url, is_primary, sort_order")
        .eq("product_id", id)
        .order("sort_order"),
    ]);

  const axes = (axesData ?? [])
    .map((a) => {
      const s = a.option_set as unknown as {
        id: string;
        name: string;
        kind: string;
        values: {
          id: string;
          value: string;
          label: string | null;
          swatch: string | null;
          sort_order: number;
        }[];
      } | null;
      if (!s) return null;
      return {
        setId: s.id,
        name: s.name,
        kind: s.kind,
        values: [...s.values].sort((x, y) => x.sort_order - y.sort_order),
      };
    })
    .filter(Boolean) as {
    setId: string;
    name: string;
    kind: string;
    values: { id: string; value: string; label: string | null; swatch: string | null }[];
  }[];

  const selections: Record<string, string[]> = {};
  for (const o of options ?? [])
    selections[o.option_set_id] = (o.selected_value_ids ?? []) as string[];

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/catalog"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Catalogus
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {(product.company as unknown as { name: string } | null)?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={duplicateProduct.bind(null, id)}>
            <SubmitButton variant="outline" size="sm">
              <Copy className="h-4 w-4" /> Dupliceren
            </SubmitButton>
          </form>
          {product.status !== "archived" ? (
            <form action={setProductStatus.bind(null, id, "archived")}>
              <SubmitButton variant="outline" size="sm">
                <Archive className="h-4 w-4" /> Archiveren
              </SubmitButton>
            </form>
          ) : (
            <form action={setProductStatus.bind(null, id, "active")}>
              <SubmitButton variant="outline" size="sm">
                Activeren
              </SubmitButton>
            </form>
          )}
          <ConfirmDialog
            action={deleteProduct.bind(null, id)}
            triggerLabel="Verwijderen"
            title={`${product.name} verwijderen?`}
            description="Dit verwijdert het product en al zijn varianten en afbeeldingen."
            confirmLabel="Definitief verwijderen"
          />
        </div>
      </div>

      <ProductEditor
        product={{
          id: product.id,
          company_id: companyId,
          name: product.name,
          category_id: product.category_id,
          status: product.status,
          description: product.description,
          base_price: product.base_price,
          max_quantity_per_order: product.max_quantity_per_order,
        }}
        categories={categories ?? []}
        axes={axes}
        selections={selections}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Afbeeldingen</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImages
            productId={id}
            companyId={companyId}
            images={images ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
