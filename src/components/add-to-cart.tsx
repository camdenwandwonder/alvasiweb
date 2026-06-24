"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
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

  // Pre-select the variant matching the member's saved size, so they don't
  // have to pick it every time.
  useEffect(() => {
    if (variantId || !preferredSizes.length || !variants.length) return;
    const match = variants.find((v) =>
      Object.values(v.attributes).some((val) =>
        preferredSizes.includes(String(val)),
      ),
    );
    if (match) setVariantId(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {variants.length > 0 ? (
        <Field label="Optie">
          <NativeSelect
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            <option value="">Kies…</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {variantLabel(v.attributes)}
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
