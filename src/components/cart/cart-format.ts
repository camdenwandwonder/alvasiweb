import { formatCredits, type Display, type PaymentMode } from "@/lib/ordering";
import { formatPrice } from "@/lib/format";

/** One amount in the unit the company works in ("" when prices are hidden). */
export function cartAmount(
  euro: number,
  credits: number,
  display: Display,
  payment: PaymentMode,
): string {
  if (display === "hidden") return "";
  if (payment === "credits" || display === "credits") return formatCredits(credits);
  return formatPrice(euro);
}

/** "Maat: L, Kleur: Navy" → "L · Navy". */
export function readableVariant(label: string | null): string {
  if (!label) return "";
  return label
    .split(",")
    .map((x) => x.split(":").pop()!.trim())
    .filter(Boolean)
    .join(" · ");
}
