"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Heart, Package, Plus, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImg } from "./product-img";
import { toggleFavorite } from "@/lib/shop/actions";
import type { Display } from "@/lib/ordering";
import type { ShopProduct } from "@/lib/shop";
import {
  capText,
  colorHex,
  priceText,
  shortVariant,
  sizeRange,
  useAddToCart,
  variantFor,
} from "./shop-utils";

export type CardMode = "grid" | "shelf" | "reorder";

/** Labels in priority order; at most two are shown. */
export function productBadges(p: ShopProduct): { text: string; tone: "amber" | "brand" | "muted" }[] {
  const all: { text: string; tone: "amber" | "brand" | "muted"; on: boolean }[] = [
    { text: "Goedkeuring nodig", tone: "amber", on: p.needsApproval },
    { text: "Maximum bereikt", tone: "amber", on: !!p.cap && p.cap.remaining <= 0 },
    {
      text: p.roleKind === "starterspakket" ? "Starterspakket" : "Voor jouw functie",
      tone: "brand",
      on: !!p.roleKind,
    },
    { text: "Proef vooraf", tone: "muted", on: p.requiresProof },
    { text: "Nieuw", tone: "brand", on: p.isNew },
  ];
  return all.filter((b) => b.on).slice(0, 2);
}

export function ProductImage({
  p,
  className,
  sizes = "(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw",
}: {
  p: ShopProduct;
  className?: string;
  sizes?: string;
}) {
  const [index, setIndex] = useState(0);
  const touch = useRef<number | null>(null);
  const images = p.images;
  const current = images[index] ?? images[0];

  return (
    <div
      className={cn("relative aspect-[4/5] overflow-hidden bg-[#f4f4f2]", className)}
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touch.current == null || images.length < 2) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touch.current;
        if (Math.abs(dx) > 30)
          setIndex((i) => (i + (dx < 0 ? 1 : images.length - 1)) % images.length);
        touch.current = null;
      }}
    >
      {current ? (
        <ProductImg
          src={current.url}
          alt={p.name}
          sizes={sizes}
          className="p-3 transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Package className="h-8 w-8" />
        </div>
      )}
      {images.length > 1 ? (
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
          {images.slice(0, 6).map((img, i) => (
            <button
              key={img.url}
              type="button"
              aria-label={`Foto ${i + 1} van ${images.length}`}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              onMouseEnter={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-foreground/70" : "w-1.5 bg-foreground/25 hover:bg-foreground/50",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FavoriteButton({
  p,
  className,
  onChange,
}: {
  p: ShopProduct;
  className?: string;
  onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useState(p.favorite);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `${p.name} uit favorieten` : `${p.name} als favoriet bewaren`}
      onClick={(e) => {
        e.stopPropagation();
        const next = !on;
        setOn(next);
        onChange?.(next);
        start(async () => {
          const res = await toggleFavorite(p.id, next);
          if (!res.ok) {
            setOn(!next);
            onChange?.(!next);
            toast.error(res.error);
          }
        });
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm transition hover:scale-105",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", on ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
    </button>
  );
}

export function ProductCard({
  p,
  display,
  canOrder,
  preview,
  mode = "grid",
  onOpen,
  onFavorite,
}: {
  p: ShopProduct;
  display: Display;
  canOrder: boolean;
  preview: boolean;
  mode?: CardMode;
  onOpen: () => void;
  onFavorite?: (on: boolean) => void;
}) {
  const add = useAddToCart();
  const [added, setAdded] = useState(false);
  const price = priceText(p, display);
  const cap = capText(p);
  const badges = productBadges(p);
  const quick =
    mode === "reorder" && p.lastOrdered?.variantId
      ? (p.variants.find((v) => v.id === p.lastOrdered!.variantId) ?? null)
      : p.myVariantId
        ? (p.variants.find((v) => v.id === p.myVariantId) ?? null)
        : variantFor(p, {});
  const canQuick = canOrder && !preview && (quick || !p.variants.length);
  const quickLabel =
    mode === "reorder" && p.lastOrdered
      ? `Nogmaals${
          quick && p.sizeKey && p.sizes.length > 1
            ? ` (${String(quick.attributes[p.sizeKey])})`
            : p.lastOrdered.variantLabel && p.sizes.length > 1
              ? ` (${shortVariant(p.lastOrdered.variantLabel)})`
              : ""
        }`
      : quick && p.sizes.length > 1 && p.sizeKey
        ? `Toevoegen (${String(quick.attributes[p.sizeKey])})`
        : "Toevoegen";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-foreground/20 hover:shadow-md",
        mode !== "grid" && "w-[200px] shrink-0 sm:w-[220px]",
      )}
    >
      <div className="relative">
        <ProductImage p={p} />
        {badges.length ? (
          <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
            {badges.map((b) => (
              <span
                key={b.text}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                  b.tone === "amber" && "bg-amber-100 text-amber-900",
                  b.tone === "brand" && "bg-[var(--brand)] text-[var(--brand-foreground)]",
                  b.tone === "muted" && "bg-background/90 text-foreground",
                )}
              >
                {b.text}
              </span>
            ))}
          </div>
        ) : null}
        <FavoriteButton p={p} className="absolute top-2 right-2 z-10" onChange={onFavorite} />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {p.name}
          </button>
        </h3>
        {p.colors.length || p.sizes.length > 1 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {p.colors.slice(0, 5).map((c) => (
              <span
                key={c}
                title={c}
                className="h-3 w-3 rounded-full border border-foreground/20"
                style={{ background: colorHex(c) ?? "transparent" }}
              />
            ))}
            {p.colors.length === 1 ? <span>{p.colors[0]}</span> : null}
            {p.colors.length > 5 ? <span>+{p.colors.length - 5}</span> : null}
            {p.colors.length && p.sizes.length > 1 ? <span aria-hidden>·</span> : null}
            {p.sizes.length > 1 ? <span>{sizeRange(p)}</span> : null}
          </p>
        ) : null}
        <div className="mt-auto pt-1">
          {price ? <p className="text-sm font-semibold">{price}</p> : null}
          {cap ? (
            <p className={cn("text-xs", cap.full ? "font-medium text-amber-700" : "text-muted-foreground")}>
              {cap.text}
            </p>
          ) : null}
          {p.mySize && p.sizes.length > 1 ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Ruler className="h-3 w-3" /> Jouw maat: {p.mySize}
            </p>
          ) : null}
        </div>
      </div>

      {canOrder || preview ? (
        <div className="relative z-10 px-3 pb-3">
          {canQuick ? (
            <button
              type="button"
              onClick={() => {
                add(p, quick, 1);
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-2 text-sm font-medium text-[var(--brand-foreground)] transition hover:opacity-90"
            >
              {added ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
              <span className="truncate">{added ? "Toegevoegd" : quickLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-medium transition hover:bg-muted"
            >
              {preview ? "Bekijken" : p.sizes.length > 1 ? "Kies maat" : "Kies uitvoering"}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}
