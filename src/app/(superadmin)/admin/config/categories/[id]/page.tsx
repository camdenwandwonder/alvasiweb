import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, X, Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  updateCategory,
  deleteCategory,
  addAxis,
  removeAxis,
  addAxisValue,
  removeAxisValue,
} from "../../actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  size: "Maten",
  color: "Kleuren",
  text: "Kenmerk",
};

type Axis = {
  axis_role: string;
  sort_order: number;
  option_set: {
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
};

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: category }, { data: axesData }] = await Promise.all([
    admin.from("categories").select("*").eq("id", id).maybeSingle(),
    admin
      .from("category_option_sets")
      .select(
        "axis_role, sort_order, option_set:option_sets(id, name, kind, values:option_values(id, value, label, swatch, sort_order))",
      )
      .eq("category_id", id)
      .order("sort_order"),
  ]);
  if (!category) notFound();
  const axes = (axesData ?? []) as unknown as Axis[];

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/config/categories"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Categorieën
      </Link>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {category.name}
      </h1>

      <div className="space-y-6">
        {/* Gegevens + standaardregels */}
        <form action={updateCategory.bind(null, id)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Naam">
                <Input name="name" defaultValue={category.name} required />
              </Field>
              <Field label="Omschrijving">
                <Textarea
                  name="description"
                  rows={2}
                  defaultValue={category.description ?? ""}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={category.active}
                  className="h-4 w-4 rounded border"
                />
                Actief (beschikbaar bij het aanmaken van producten)
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Standaardregels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Deze werken door naar elk product in deze categorie (een product
                kan ze overschrijven).
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="default_requires_approval"
                  defaultChecked={category.default_requires_approval}
                  className="h-4 w-4 rounded border"
                />
                Bestellingen vereisen standaard goedkeuring
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="default_requires_proof"
                  defaultChecked={category.default_requires_proof}
                  className="h-4 w-4 rounded border"
                />
                Ontwerp-proef goedkeuren vóór productie vereist
              </label>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Standaard max. aantal / bestelling" hint="Leeg = onbeperkt">
                  <Input
                    type="number"
                    name="default_max_quantity"
                    min="1"
                    defaultValue={category.default_max_quantity ?? ""}
                  />
                </Field>
                <Field label="Standaard levertijd (dagen)">
                  <Input
                    type="number"
                    name="default_lead_time_days"
                    min="0"
                    defaultValue={category.default_lead_time_days ?? ""}
                  />
                </Field>
              </div>
              <SubmitButton>Wijzigingen opslaan</SubmitButton>
            </CardContent>
          </Card>
        </form>

        {/* Optie-assen, volledig binnen de categorie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opties & maten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Voeg maten, kleuren of andere keuzes toe. Producten in deze
              categorie bieden deze automatisch als varianten aan.
            </p>

            {axes.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nog geen optie-assen. Voeg er hieronder een toe.
              </p>
            ) : (
              <div className="space-y-3">
                {axes.map((a) => {
                  const set = a.option_set;
                  if (!set) return null;
                  const isColor = set.kind === "color";
                  return (
                    <div key={set.id} className="rounded-xl border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{set.name}</span>
                          <Badge variant="secondary">
                            {KIND_LABEL[set.kind] ?? set.kind}
                          </Badge>
                        </div>
                        <form action={removeAxis.bind(null, id, set.id)}>
                          <SubmitButton variant="ghost" size="icon-sm">
                            <Trash2 className="h-4 w-4" />
                          </SubmitButton>
                        </form>
                      </div>

                      {/* values */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        {[...set.values]
                          .sort((x, y) => x.sort_order - y.sort_order)
                          .map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pl-2.5 pr-1 text-sm"
                            >
                              {isColor && v.swatch ? (
                                <span
                                  className="h-3.5 w-3.5 rounded-full border"
                                  style={{ background: v.swatch }}
                                />
                              ) : null}
                              {v.label ?? v.value}
                              <form
                                action={removeAxisValue.bind(null, id, v.id)}
                                className="contents"
                              >
                                <button
                                  type="submit"
                                  className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label="Verwijderen"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </form>
                            </span>
                          ))}
                        {set.values.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Nog geen waarden
                          </span>
                        ) : null}
                      </div>

                      {/* add value */}
                      <form
                        action={addAxisValue.bind(null, id, set.id)}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <Input
                          name="value"
                          required
                          placeholder={isColor ? "navy" : "M"}
                          className="h-9 w-28"
                        />
                        <Input
                          name="label"
                          placeholder={isColor ? "Navy" : "Label (optioneel)"}
                          className="h-9 w-40"
                        />
                        {isColor ? (
                          <input
                            type="color"
                            name="swatch"
                            defaultValue="#1e293b"
                            className="h-9 w-11 rounded-md border"
                          />
                        ) : null}
                        <SubmitButton variant="outline" size="sm">
                          <Plus className="h-3.5 w-3.5" /> Toevoegen
                        </SubmitButton>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}

            {/* add axis */}
            <form
              action={addAxis.bind(null, id)}
              className="flex flex-wrap items-end gap-2 border-t pt-4"
            >
              <Field label="Nieuwe optie-as">
                <Input name="name" required placeholder="bijv. Maat of Kleur" className="w-48" />
              </Field>
              <NativeSelect name="kind" defaultValue="size" className="w-40">
                <option value="size">Maten</option>
                <option value="color">Kleuren</option>
                <option value="text">Ander kenmerk</option>
              </NativeSelect>
              <SubmitButton>
                <Plus className="h-4 w-4" /> Optie-as toevoegen
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {/* Verwijderen */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Gevarenzone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Verwijder deze categorie en alle optie-assen.
            </p>
            <ConfirmDialog
              action={deleteCategory.bind(null, id)}
              triggerLabel="Categorie verwijderen"
              title={`${category.name} verwijderen?`}
              description="Producten verliezen hun categorie. Dit kan niet ongedaan worden gemaakt."
              confirmLabel="Definitief verwijderen"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
