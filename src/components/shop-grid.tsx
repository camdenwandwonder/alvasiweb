"use client";

import { useMemo, useState } from "react";
import { Search, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/primitives";
import { ProductThumb } from "@/components/product-thumb";
import { AddToCart } from "@/components/add-to-cart";
import { formatValue, PERIOD_LABEL, type Display, type Period } from "@/lib/ordering";
import type { ShopProduct } from "@/lib/shop";

export type { ShopProduct };

function CapBadge({ cap }: { cap: NonNullable<ShopProduct["cap"]> }) {
  const period = PERIOD_LABEL[cap.period as Period] ?? "";
  if (cap.remaining <= 0)
    return (
      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Maximum bereikt — aanvragen kan
      </span>
    );
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
      Nog {cap.remaining} van {cap.max} {period}
    </span>
  );
}

export function ShopGrid({
  products,
  categories,
  display,
  canOrder,
  preferredSizes = [],
  preview = false,
}: {
  products: ShopProduct[];
  categories: { id: string; name: string }[];
  display: Display;
  canOrder: boolean;
  preferredSizes?: string[];
  preview?: boolean;
}) {
  const priced = display !== "hidden";
  const unitValue = (p: ShopProduct) => (display === "credits" ? p.credits : p.euro);

  function priceLabel(p: ShopProduct): string {
    if (!priced) return "";
    // "vanaf" when variants are priced differently (e.g. a pricier XXL).
    const cheapest = p.variants.length
      ? p.variants.reduce((m, v) => (unitValueOf(v) < unitValueOf(m) ? v : m))
      : null;
    const differ = p.variants.some(
      (v) => v.euro !== p.variants[0].euro || v.credits !== p.variants[0].credits,
    );
    if (cheapest && differ)
      return `vanaf ${formatValue(cheapest.euro, cheapest.credits, display)}`;
    const ref = cheapest ?? { euro: p.euro, credits: p.credits };
    return formatValue(ref.euro, ref.credits, display);
  }
  function unitValueOf(v: { euro: number; credits: number }) {
    return display === "credits" ? v.credits : v.euro;
  }

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState<"name" | "price-asc" | "price-desc">("name");

  const shown = useMemo(() => {
    let list = products;
    const q = query.trim().toLowerCase();
    if (q)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      );
    if (categoryId) list = list.filter((p) => p.category_id === categoryId);
    list = [...list].sort((a, b) => {
      if (sort === "name" || !priced) return a.name.localeCompare(b.name);
      return sort === "price-asc"
        ? unitValue(a) - unitValue(b)
        : unitValue(b) - unitValue(a);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query, categoryId, sort, display]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een product…"
            className="pl-8"
          />
        </div>
        {categories.length > 0 ? (
          <NativeSelect
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-auto"
          >
            <option value="">Alle categorieën</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        {priced ? (
          <NativeSelect
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="w-auto"
          >
            <option value="name">Sorteer: naam</option>
            <option value="price-asc">Prijs: laag → hoog</option>
            <option value="price-desc">Prijs: hoog → laag</option>
          </NativeSelect>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Package className="mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-medium">Geen producten gevonden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length === 0
              ? "Er zijn (nog) geen producten beschikbaar."
              : "Pas je zoekopdracht of filter aan."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => {
            const price = priceLabel(p);
            return (
              <Card key={p.id} className="group flex flex-col overflow-hidden p-0">
                <ProductThumb
                  images={p.images ?? []}
                  alt={p.name}
                  className="aspect-square w-full"
                />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">{p.name}</h3>
                      {price ? (
                        <span className="shrink-0 text-sm font-medium">{price}</span>
                      ) : null}
                    </div>
                    {p.category_name ? (
                      <p className="text-xs text-muted-foreground">
                        {p.category_name}
                      </p>
                    ) : null}
                    {p.cap ? (
                      <div className="mt-2">
                        <CapBadge cap={p.cap} />
                      </div>
                    ) : null}
                    {p.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {p.description}
                      </p>
                    ) : null}
                  </div>
                  {canOrder || preview ? (
                    <div className="mt-4">
                      <AddToCart
                        productId={p.id}
                        name={p.name}
                        euro={p.euro}
                        credits={p.credits}
                        image={
                          p.images?.find((i) => i.is_primary)?.url ??
                          p.images?.[0]?.url ??
                          null
                        }
                        variants={p.variants}
                        display={display}
                        preferredSizes={preferredSizes}
                        preview={preview}
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
