"use client";

import { useState } from "react";
import { Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImg } from "./product-img";
import { variantLabel } from "@/lib/format";
import type { Display } from "@/lib/ordering";
import type { ShopProduct } from "@/lib/shop";
import { productBadges } from "./product-card";
import { capText, priceText, shortVariant, sizeRange, useAddToCart } from "./shop-utils";

export function ProductRow({
  p,
  display,
  canOrder,
  preview,
  onOpen,
}: {
  p: ShopProduct;
  display: Display;
  canOrder: boolean;
  preview: boolean;
  onOpen: () => void;
}) {
  const add = useAddToCart();
  const [variantId, setVariantId] = useState(p.myVariantId ?? (p.variants.length === 1 ? p.variants[0]!.id : ""));
  const [qty, setQty] = useState(1);
  const variant = p.variants.find((v) => v.id === variantId) ?? null;
  const cap = capText(p);
  const badges = productBadges(p);
  const ordering = canOrder && !preview;

  return (
    <li className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md bg-[#f4f4f2]">
          {p.images[0] ? (
            <ProductImg src={p.images[0].url} alt="" sizes="48px" />
          ) : (
            <Package className="m-auto mt-4 h-5 w-5 text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium hover:underline">{p.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[p.category_name, p.colors.join(", "), sizeRange(p)].filter(Boolean).join(" · ")}
          </span>
          {badges.length ? (
            <span className="mt-0.5 flex gap-1">
              {badges.map((b) => (
                <span
                  key={b.text}
                  className={cn(
                    "rounded px-1 text-[10px] font-semibold",
                    b.tone === "amber" ? "bg-amber-100 text-amber-900" : "bg-muted",
                  )}
                >
                  {b.text}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>

      <div className="w-36 shrink-0 text-sm sm:text-right">
        {priceText(p, display) ? <p className="font-semibold">{priceText(p, display)}</p> : null}
        {cap ? <p className={cn("text-xs", cap.full ? "text-amber-700" : "text-muted-foreground")}>{cap.text}</p> : null}
      </div>

      {canOrder || preview ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {p.variants.length > 1 ? (
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              disabled={!ordering}
              aria-label={`Uitvoering ${p.name}`}
              className="h-9 w-36 rounded-lg border bg-transparent px-2 text-sm"
            >
              <option value="">{p.sizes.length > 1 ? "Kies maat" : "Kies uitvoering"}</option>
              {p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {shortVariant(variantLabel(v.attributes))}
                  {p.mySize && p.sizeKey && String(v.attributes[p.sizeKey]) === p.mySize ? " (jouw maat)" : ""}
                </option>
              ))}
            </select>
          ) : null}
          <input
            value={qty}
            onChange={(e) =>
              setQty(Math.min(p.maxPerOrder ?? 999, Math.max(1, Math.floor(Number(e.target.value) || 1))))
            }
            inputMode="numeric"
            disabled={!ordering}
            aria-label={`Aantal ${p.name}`}
            className="h-9 w-14 rounded-lg border bg-transparent text-center text-sm"
          />
          <button
            type="button"
            disabled={!ordering || (p.variants.length > 0 && !variant)}
            onClick={() => {
              add(p, variant, qty);
              setQty(1);
            }}
            aria-label={`${p.name} in winkelwagen`}
            className="flex h-9 items-center gap-1 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-[var(--brand-foreground)] transition hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline">Toevoegen</span>
          </button>
        </div>
      ) : null}
    </li>
  );
}
