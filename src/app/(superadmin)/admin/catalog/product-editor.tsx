"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, NativeSelect } from "@/components/primitives";
import { saveProduct } from "./actions";

type AxisValue = {
  id: string;
  value: string;
  label: string | null;
  swatch: string | null;
};
type Axis = { setId: string; name: string; kind: string; values: AxisValue[] };

type Product = {
  id: string;
  company_id: string;
  name: string;
  category_id: string | null;
  status: string;
  description: string | null;
  base_price: number | null;
  credit_cost: number | null;
  max_quantity_per_order: number | null;
};

export function ProductEditor({
  product,
  categories,
  axes,
  selections: initialSelections,
}: {
  product: Product;
  categories: { id: string; name: string }[];
  axes: Axis[];
  selections: Record<string, string[]>;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [status, setStatus] = useState(product.status);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(
    product.base_price != null ? String(product.base_price) : "",
  );
  const [creditCost, setCreditCost] = useState(
    product.credit_cost != null ? String(product.credit_cost) : "",
  );
  const [maxQty, setMaxQty] = useState(
    product.max_quantity_per_order != null
      ? String(product.max_quantity_per_order)
      : "",
  );
  const [selections, setSelections] =
    useState<Record<string, string[]>>(initialSelections);

  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const dirty = useRef(false);
  const regen = useRef(false);

  function payload(regenVariants: boolean) {
    return {
      name,
      category_id: product.category_id,
      status,
      description: description || null,
      base_price: price.trim() ? Number(price) : null,
      credit_cost: creditCost.trim() ? Number(creditCost) : null,
      max_quantity_per_order: maxQty.trim() ? Number(maxQty) : null,
      regenVariants,
      selections,
    };
  }

  // Debounced autosave whenever a field or selection changes.
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await saveProduct(product.id, product.company_id, payload(regen.current));
        regen.current = false;
        dirty.current = false;
        setSaveState("saved");
      } catch {
        toast.error("Automatisch opslaan mislukt");
        setSaveState("saved");
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, status, description, price, creditCost, maxQty, selections]);

  // Warn if leaving with a save still pending.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function touch(opts?: { regen?: boolean }) {
    dirty.current = true;
    if (opts?.regen) regen.current = true;
  }

  async function onCategoryChange(value: string) {
    // Category determines the axes — save then reload so new axes appear.
    setSaveState("saving");
    await saveProduct(product.id, product.company_id, {
      ...payload(false),
      category_id: value || null,
    });
    router.refresh();
  }

  function toggleValue(setId: string, valueId: string) {
    setSelections((prev) => {
      const cur = new Set(prev[setId] ?? []);
      if (cur.has(valueId)) cur.delete(valueId);
      else cur.add(valueId);
      return { ...prev, [setId]: [...cur] };
    });
    touch({ regen: true });
  }

  async function saveNow() {
    setSaveState("saving");
    try {
      await saveProduct(product.id, product.company_id, payload(true));
      regen.current = false;
      dirty.current = false;
      setSaveState("saved");
      toast.success("Opgeslagen");
      router.refresh();
    } catch {
      toast.error("Opslaan mislukt");
      setSaveState("saved");
    }
  }

  // Variant count preview (client-side cartesian of selections).
  const variantCount = axes.reduce((acc, ax) => {
    const n = (selections[ax.setId] ?? []).length;
    return n > 0 ? acc * n : acc;
  }, axes.some((ax) => (selections[ax.setId] ?? []).length > 0) ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Sticky save bar */}
      <div className="sticky top-14 z-10 -mx-1 flex items-center justify-between gap-3 rounded-lg border bg-card/95 px-3 py-2 backdrop-blur">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {saveState === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Bezig met opslaan…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-green-600" /> Alle wijzigingen
              opgeslagen
            </>
          )}
        </span>
        <Button onClick={saveNow} size="sm">
          Opslaan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basisgegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Naam">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                touch();
              }}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categorie">
              <NativeSelect
                value={product.category_id ?? ""}
                onChange={(e) => onCategoryChange(e.target.value)}
              >
                <option value="">Geen categorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  touch();
                }}
              >
                <option value="draft">Concept</option>
                <option value="active">Actief</option>
                <option value="archived">Gearchiveerd</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="Omschrijving">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                touch();
              }}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prijs (€)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  touch();
                }}
                placeholder="0,00"
              />
            </Field>
            <Field label="Credits" hint="Voor credits-modus">
              <Input
                type="number"
                step="1"
                min="0"
                value={creditCost}
                onChange={(e) => {
                  setCreditCost(e.target.value);
                  touch();
                }}
                placeholder="0"
              />
            </Field>
            <Field label="Max. / bestelling" hint="Leeg = standaard">
              <Input
                type="number"
                min="1"
                value={maxQty}
                onChange={(e) => {
                  setMaxQty(e.target.value);
                  touch();
                }}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Opties &amp; varianten
            <span className="text-xs font-normal text-muted-foreground">
              {variantCount} varianten
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!product.category_id ? (
            <p className="text-sm text-muted-foreground">
              Kies eerst een categorie om de beschikbare maten/kleuren te tonen.
            </p>
          ) : axes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Deze categorie heeft nog geen optie-assen. Beheer ze bij
              Configuratie → Categorieën.
            </p>
          ) : (
            <div className="space-y-5">
              {axes.map((ax) => {
                const sel = new Set(selections[ax.setId] ?? []);
                const isColor = ax.kind === "color";
                return (
                  <div key={ax.setId}>
                    <p className="mb-2 text-sm font-medium">{ax.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {ax.values.map((v) => {
                        const on = sel.has(v.id);
                        return (
                          <button
                            type="button"
                            key={v.id}
                            onClick={() => toggleValue(ax.setId, v.id)}
                            className={[
                              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition",
                              on
                                ? "border-[var(--brand)] bg-[var(--brand)]/5"
                                : "hover:bg-muted",
                            ].join(" ")}
                          >
                            {isColor && v.swatch ? (
                              <span
                                className="h-3.5 w-3.5 rounded-full border"
                                style={{ background: v.swatch }}
                              />
                            ) : null}
                            {v.label ?? v.value}
                            {on ? <Check className="h-3.5 w-3.5" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {variantCount > 0 ? (
                <p className="border-t pt-3 text-xs text-muted-foreground">
                  <Badge variant="secondary">{variantCount}</Badge> varianten
                  worden automatisch gegenereerd.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
