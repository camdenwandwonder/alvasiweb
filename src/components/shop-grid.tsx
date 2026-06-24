"use client";

import { useMemo, useState } from "react";
import { Search, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/primitives";
import { ProductThumb } from "@/components/product-thumb";
import { AddToCart } from "@/components/add-to-cart";
import { formatPrice } from "@/lib/format";
import type { BudgetMode } from "@/lib/allowance";

export type ShopVariant = {
  id: string;
  attributes: Record<string, unknown>;
  price_override: number | null;
};
export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  credit_cost: number | null;
  category_id: string | null;
  category_name: string | null;
  variants: ShopVariant[];
  images: { url: string; is_primary: boolean }[];
};

export function ShopGrid({
  products,
  categories,
  canOrder,
  mode = "euro",
  perProduct,
  preferredSizes = [],
}: {
  products: ShopProduct[];
  categories: { id: string; name: string }[];
  canOrder: boolean;
  mode?: BudgetMode;
  perProduct?: Record<string, { max: number; used: number; remaining: number }>;
  preferredSizes?: string[];
}) {
  function priceLabel(p: ShopProduct): React.ReactNode {
    if (mode === "credits")
      return (
        <span className="text-sm font-medium">
          {p.credit_cost ?? 0} credits
        </span>
      );
    if (mode === "quantity") {
      const q = perProduct?.[p.id];
      if (!q) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <span className="text-xs font-medium">
          {q.remaining}/{q.max} over
        </span>
      );
    }
    return (
      <span className="text-sm font-medium">{formatPrice(p.base_price)}</span>
    );
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
      if (sort === "name") return a.name.localeCompare(b.name);
      const val = (p: ShopProduct) =>
        mode === "credits" ? (p.credit_cost ?? 0) : (p.base_price ?? 0);
      return sort === "price-asc" ? val(a) - val(b) : val(b) - val(a);
    });
    return list;
  }, [products, query, categoryId, sort, mode]);

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
            className="h-9 w-auto"
          >
            <option value="">Alle categorieën</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <NativeSelect
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-9 w-auto"
        >
          <option value="name">Sorteer: naam</option>
          <option value="price-asc">Prijs: laag → hoog</option>
          <option value="price-desc">Prijs: hoog → laag</option>
        </NativeSelect>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Package className="mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-medium">Geen producten gevonden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pas je zoekopdracht of filter aan.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
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
                    <span className="shrink-0">{priceLabel(p)}</span>
                  </div>
                  {p.category_name ? (
                    <p className="text-xs text-muted-foreground">
                      {p.category_name}
                    </p>
                  ) : null}
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  ) : null}
                </div>
                {canOrder ? (
                  <div className="mt-4">
                    <AddToCart
                      productId={p.id}
                      name={p.name}
                      basePrice={p.base_price}
                      image={
                        p.images?.find((i) => i.is_primary)?.url ??
                        p.images?.[0]?.url ??
                        null
                      }
                      variants={p.variants ?? []}
                      preferredSizes={preferredSizes}
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
