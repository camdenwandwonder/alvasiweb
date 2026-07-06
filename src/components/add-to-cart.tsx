"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ShoppingCart, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/primitives";
import { useCart } from "@/components/cart";
import { variantLabel } from "@/lib/format";

type Variant = {
  id: string;
  attributes: Record<string, unknown>;
  price_override: number | null;
};

export function AddToCart({
  productId,
  name,
  basePrice,
  image,
  variants,
  preferredSizes = [],
}: {
  productId: string;
  name: string;
  basePrice: number | null;
  image: string | null;
  variants: Variant[];
  preferredSizes?: string[];
}) {
  const cart = useCart();
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);

  // When the member has a standard size that matches one of this product's
  // axes, lock that axis: the size is fixed and only the remaining choices
  // (e.g. color) are shown.
  const locked = useMemo(() => {
    if (!variants.length || !preferredSizes.length) return null;
    for (const v of variants) {
      for (const [key, val] of Object.entries(v.attributes)) {
        if (preferredSizes.includes(String(val)))
          return { key, value: String(val) };
      }
    }
    return null;
  }, [variants, preferredSizes]);

  const options = useMemo(
    () =>
      locked
        ? variants.filter(
            (v) => String(v.attributes[locked.key]) === locked.value,
          )
        : variants,
    [variants, locked],
  );

  // Nothing left to choose → select it automatically (no dropdown shown).
  useEffect(() => {
    if (options.length === 1) setVariantId(options[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Label an option by its remaining (non-locked) attributes.
  function optionLabel(v: Variant): string {
    const rest = Object.entries(v.attributes).filter(
      ([k]) => !locked || k !== locked.key,
    );
    return rest.length
      ? rest.map(([k, val]) => `${k}: ${val}`).join(", ")
      : variantLabel(v.attributes);
  }

  const chooserLabel =
    options.length > 1
      ? [
          ...new Set(
            Object.keys(options[0]?.attributes ?? {}).filter(
              (k) => !locked || k !== locked.key,
            ),
          ),
        ].join(" / ") || "Optie"
      : "Optie";

  // With a single (auto-selected) variant, still show what it is.
  const singleInfo =
    options.length === 1
      ? Object.entries(options[0].attributes)
          .filter(([k]) => !locked || k !== locked.key)
          .map(([k, val]) => `${k}: ${val}`)
          .join(", ")
      : "";

  function add() {
    if (variants.length && !variantId) {
      toast.error("Kies eerst een optie");
      return;
    }
    const variant = variants.find((v) => v.id === variantId) ?? null;
    const unitPrice = variant?.price_override ?? basePrice ?? 0;
    cart.addItem({
      productId,
      variantId: variant?.id ?? null,
      name,
      variantLabel: variant ? variantLabel(variant.attributes) : null,
      unitPrice,
      image,
      qty,
    });
    toast.success(`${name} toegevoegd aan winkelwagen`);
    setQty(1);
  }

  return (
    <div className="space-y-3 border-t pt-4">
      {locked ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Ruler className="h-3.5 w-3.5" />
          {locked.key}: <span className="font-medium">{locked.value}</span>
          · jouw standaardmaat
        </p>
      ) : null}
      {singleInfo ? (
        <p className="text-xs text-muted-foreground">{singleInfo}</p>
      ) : null}
      {options.length > 1 ? (
        <Field label={chooserLabel}>
          <NativeSelect
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            <option value="">Kies…</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {optionLabel(v)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="w-20">
          <Field label="Aantal">
            <Input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            />
          </Field>
        </div>
        <Button onClick={add} className="flex-1">
          <ShoppingCart className="h-4 w-4" /> In winkelwagen
        </Button>
      </div>
    </div>
  );
}
