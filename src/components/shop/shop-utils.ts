"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "@/components/cart";
import { variantLabel } from "@/lib/format";
import { formatValue, PERIOD_LABEL, type Display, type Period } from "@/lib/ordering";
import type { ShopProduct, ShopVariant } from "@/lib/shop";

export const PERIOD_SHORT: Record<string, string> = {
  monthly: "deze maand",
  quarterly: "dit kwartaal",
  yearly: "dit jaar",
  once: "in totaal",
};

/** "€ 99,00", "vanaf € 99,00", "33 credits" or "" when prices are hidden. */
export function priceText(p: ShopProduct, display: Display): string {
  if (display === "hidden") return "";
  const unit = (v: { euro: number; credits: number }) => (display === "credits" ? v.credits : v.euro);
  if (p.variants.length > 1) {
    const differ = p.variants.some(
      (v) => v.euro !== p.variants[0]!.euro || v.credits !== p.variants[0]!.credits,
    );
    if (differ) {
      const cheapest = p.variants.reduce((m, v) => (unit(v) < unit(m) ? v : m));
      return `vanaf ${formatValue(cheapest.euro, cheapest.credits, display)}`;
    }
    return formatValue(p.variants[0]!.euro, p.variants[0]!.credits, display);
  }
  const v = p.variants[0] ?? p;
  return formatValue(v.euro, v.credits, display);
}

/** What the maximum per product means right now, or null without one. */
export function capText(p: ShopProduct): { text: string; full: boolean } | null {
  if (!p.cap) return null;
  const period = PERIOD_SHORT[p.cap.period] ?? PERIOD_LABEL[p.cap.period as Period] ?? "";
  if (p.cap.remaining <= 0) return { text: "Maximum bereikt, aanvragen kan", full: true };
  return { text: `Nog ${p.cap.remaining} van ${p.cap.max} ${period}`.trim(), full: false };
}

export function variantFor(
  p: ShopProduct,
  pick: { size?: string | null; color?: string | null },
): ShopVariant | null {
  if (!p.variants.length) return null;
  if (p.variants.length === 1) return p.variants[0]!;
  const matches = p.variants.filter(
    (v) =>
      (!p.sizeKey || !pick.size || String(v.attributes[p.sizeKey]) === pick.size) &&
      (!p.colorKey || !pick.color || String(v.attributes[p.colorKey]) === pick.color),
  );
  const needSize = p.sizeKey && p.sizes.length > 1 && !pick.size;
  const needColor = p.colorKey && p.colors.length > 1 && !pick.color;
  if (needSize || needColor) return null;
  return matches.length === 1 ? matches[0]! : null;
}

/** "Maat: L, Kleur: Navy" → "L, Navy". */
export function shortVariant(label: string | null): string {
  if (!label) return "";
  return label
    .split(",")
    .map((x) => x.split(":").pop()!.trim())
    .filter(Boolean)
    .join(", ");
}

export function sizeRange(p: ShopProduct): string {
  if (p.sizes.length <= 1) return p.sizes[0] ?? "";
  return `${p.sizes[0]} – ${p.sizes[p.sizes.length - 1]}`;
}

const COLOR_HEX: Record<string, string> = {
  navy: "#1f2a44",
  marine: "#1f2a44",
  zwart: "#111111",
  black: "#111111",
  wit: "#ffffff",
  white: "#ffffff",
  rood: "#c62828",
  red: "#c62828",
  blauw: "#1e5bb8",
  blue: "#1e5bb8",
  grijs: "#8a8f98",
  grey: "#8a8f98",
  gray: "#8a8f98",
  groen: "#2e7d32",
  green: "#2e7d32",
  geel: "#f2c200",
  yellow: "#f2c200",
  oranje: "#ef6c00",
  orange: "#ef6c00",
  bruin: "#6d4c41",
  beige: "#d8c8a8",
  antraciet: "#3a3d42",
};
export function colorHex(name: string): string | null {
  return COLOR_HEX[name.trim().toLowerCase()] ?? null;
}

/** Adds a product line to the cart with a toast that links to the cart. */
export function useAddToCart() {
  const cart = useCart();
  const router = useRouter();
  return (p: ShopProduct, variant: ShopVariant | null, qty: number, silent = false) => {
    cart.addItem({
      productId: p.id,
      variantId: variant?.id ?? null,
      name: p.name,
      variantLabel: variant ? variantLabel(variant.attributes) : null,
      unitPrice: variant?.euro ?? p.euro,
      unitCredits: variant?.credits ?? p.credits,
      image: p.images[0]?.url ?? null,
      qty,
    });
    if (!silent)
      toast.success(`${qty > 1 ? `${qty}× ` : ""}${p.name} in je winkelwagen`, {
        description: variant ? shortVariant(variantLabel(variant.attributes)) : undefined,
        action: { label: "Bekijk winkelwagen", onClick: () => router.push("/cart") },
      });
  };
}

/** How much of this product is already in the cart. */
export function useInCart(productId: string): number {
  const cart = useCart();
  return cart.items.filter((i) => i.productId === productId).reduce((s, i) => s + i.qty, 0);
}
