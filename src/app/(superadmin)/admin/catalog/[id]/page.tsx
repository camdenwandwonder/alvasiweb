import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Archive, Trash2, Star, X, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { ImageUploader } from "@/components/image-uploader";
import { variantLabel } from "@/lib/format";
import {
  updateProductBasics,
  addProductImage,
  removeProductImage,
  setPrimaryImage,
  saveProductOptions,
  duplicateProduct,
  setProductStatus,
  deleteProduct,
} from "../actions";

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

  const [{ data: categories }, { data: axes }, { data: options }, { data: images }, { data: variants }] =
    await Promise.all([
      admin.from("categories").select("id, name").eq("active", true).order("sort_order"),
      admin
        .from("category_option_sets")
        .select(
          "axis_role, sort_order, option_set:option_sets(id, name, kind, values:option_values(id, value, label, swatch, sort_order))",
        )
        .eq("category_id", product.category_id ?? "")
        .order("sort_order"),
      admin.from("product_options").select("option_set_id, selected_value_ids").eq("product_id", id),
      admin
        .from("product_images")
        .select("id, url, is_primary, sort_order")
        .eq("product_id", id)
        .order("sort_order"),
      admin
        .from("product_variants")
        .select("id, attributes")
        .eq("product_id", id)
        .order("created_at"),
    ]);

  const selectedBySet = new Map<string, Set<string>>();
  for (const o of options ?? [])
    selectedBySet.set(o.option_set_id, new Set(o.selected_value_ids ?? []));

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/catalog"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Catalogus
      </Link>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {(product.company as { name: string } | null)?.name}
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
        </div>
      </div>

      <div className="space-y-6">
        {/* Basis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basisgegevens</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateProductBasics.bind(null, id)} className="space-y-4">
              <Field label="Naam">
                <Input name="name" defaultValue={product.name} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Categorie">
                  <NativeSelect
                    name="category_id"
                    defaultValue={product.category_id ?? ""}
                  >
                    <option value="">Geen categorie</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Status">
                  <NativeSelect name="status" defaultValue={product.status}>
                    <option value="draft">Concept</option>
                    <option value="active">Actief</option>
                    <option value="archived">Gearchiveerd</option>
                  </NativeSelect>
                </Field>
              </div>
              <Field label="Omschrijving">
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={product.description ?? ""}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prijs (€)">
                  <Input
                    name="base_price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={product.base_price ?? ""}
                    placeholder="0,00"
                  />
                </Field>
                <Field
                  label="Max. aantal per bestelling"
                  hint="Leeg = categoriestandaard"
                >
                  <Input
                    name="max_quantity_per_order"
                    type="number"
                    min="1"
                    defaultValue={product.max_quantity_per_order ?? ""}
                  />
                </Field>
              </div>
              <SubmitButton>Opslaan</SubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Media */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Afbeeldingen</CardTitle>
          </CardHeader>
          <CardContent>
            {images && images.length > 0 ? (
              <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((im) => (
                  <div
                    key={im.id}
                    className="group relative overflow-hidden rounded-lg border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    {im.is_primary ? (
                      <span className="absolute left-1.5 top-1.5">
                        <Badge>Hoofd</Badge>
                      </span>
                    ) : null}
                    <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      {!im.is_primary ? (
                        <form action={setPrimaryImage.bind(null, im.id, id)}>
                          <SubmitButton variant="secondary" size="icon-xs">
                            <Star className="h-3.5 w-3.5" />
                          </SubmitButton>
                        </form>
                      ) : null}
                      <form action={removeProductImage.bind(null, im.id, id)}>
                        <SubmitButton variant="destructive" size="icon-xs">
                          <X className="h-3.5 w-3.5" />
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                Nog geen afbeeldingen.
              </p>
            )}
            <form
              action={addProductImage.bind(null, id, companyId)}
              className="space-y-3"
            >
              <ImageUploader name="image_url" bucket="product-images" />
              <SubmitButton variant="outline" size="sm">
                <Plus className="h-4 w-4" /> Afbeelding toevoegen
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Opties & varianten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opties &amp; varianten</CardTitle>
          </CardHeader>
          <CardContent>
            {!product.category_id ? (
              <p className="text-sm text-muted-foreground">
                Kies eerst een categorie om standaard maten/kleuren te tonen.
              </p>
            ) : !axes || axes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Deze categorie heeft nog geen optie-assen.{" "}
                <Link
                  href="/admin/config/categories"
                  className="text-[var(--brand-2)] hover:underline"
                >
                  Configureer categorieën
                </Link>
                .
              </p>
            ) : (
              <form
                action={saveProductOptions.bind(null, id, companyId)}
                className="space-y-5"
              >
                {axes.map((a) => {
                  const set = a.option_set as unknown as {
                    id: string;
                    name: string;
                    kind: string;
                    values: {
                      id: string;
                      value: string;
                      label: string | null;
                      swatch: string | null;
                    }[];
                  };
                  const sel = selectedBySet.get(set.id) ?? new Set();
                  const axisLabel =
                    a.axis_role === "size"
                      ? "Maat"
                      : a.axis_role === "color"
                        ? "Kleur"
                        : set.name;
                  return (
                    <div key={set.id}>
                      <p className="mb-2 text-sm font-medium">{axisLabel}</p>
                      <div className="flex flex-wrap gap-2">
                        {set.values.map((v) => (
                          <label
                            key={v.id}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5"
                          >
                            <input
                              type="checkbox"
                              name={`opt_${set.id}`}
                              value={v.id}
                              defaultChecked={sel.has(v.id)}
                              className="h-3.5 w-3.5"
                            />
                            {set.kind === "color" && v.swatch ? (
                              <span
                                className="h-3.5 w-3.5 rounded-full border"
                                style={{ background: v.swatch }}
                              />
                            ) : null}
                            {v.label ?? v.value}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3">
                  <SubmitButton>Varianten genereren</SubmitButton>
                  <span className="text-sm text-muted-foreground">
                    {variants?.length ?? 0} varianten
                  </span>
                </div>
              </form>
            )}

            {variants && variants.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-4">
                {variants.map((v) => (
                  <Badge key={v.id} variant="secondary">
                    {variantLabel(v.attributes as Record<string, unknown>)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Verwijderen */}
        <form action={deleteProduct.bind(null, id)} className="border-t pt-4">
          <SubmitButton variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" /> Product verwijderen
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
