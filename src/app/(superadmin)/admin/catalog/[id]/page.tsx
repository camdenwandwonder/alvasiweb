import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Archive } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProductEditor } from "../product-editor";
import { ProductImages } from "../product-images";
import { SizeChartEditor } from "@/components/size-chart-editor";
import type { SizeChartInput } from "@/lib/size-chart-actions";
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

  const [
    { data: categories },
    { data: axesData },
    { data: options },
    { data: images },
    { data: chart },
  ] =
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
      admin
        .from("size_charts")
        .select("columns, rows, note")
        .eq("product_id", id)
        .maybeSingle(),
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

  // Sizes of this product (selected values of its size axis) for the size chart.
  const sizeAxis = axes.find((a) => a.kind === "size");
  const productSizes = sizeAxis
    ? sizeAxis.values
        .filter((v) => (selections[sizeAxis.setId] ?? []).includes(v.id))
        .map((v) => v.label ?? v.value)
    : [];
  const ownChart: SizeChartInput | null = chart
    ? {
        columns: (chart.columns as string[]) ?? [],
        rows: (chart.rows as SizeChartInput["rows"]) ?? [],
        note: (chart.note as string | null) ?? null,
      }
    : null;

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
          credit_cost: product.credit_cost,
          max_quantity_per_order: product.max_quantity_per_order,
          lead_time_days: product.lead_time_days,
          requires_proof: !!product.requires_proof,
          requires_approval_override: product.requires_approval_override,
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
          <p className="mb-3 text-xs text-muted-foreground">
            Tip: 3 foto&apos;s of meer, lichte egale achtergrond, product gecentreerd. De
            winkel toont foto&apos;s in staande verhouding 4:5 zonder bij te snijden.
          </p>
          <ProductImages
            productId={id}
            companyId={companyId}
            images={images ?? []}
          />
        </CardContent>
      </Card>

      {sizeAxis ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Eigen maattabel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Optioneel. Gaat voor de maattabel van het maatsysteem, bijvoorbeeld als dit
              model kleiner of groter valt.
            </p>
            <SizeChartEditor
              target={{ productId: id }}
              sizes={productSizes}
              initial={ownChart}
              emptyText="Dit product gebruikt de maattabel van het maatsysteem."
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
