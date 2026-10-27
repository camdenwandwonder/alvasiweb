/**
 * Shared shapes for the cart: what the browser keeps, what the server checks
 * before placing, and the outcome the checkout page shows in advance.
 */
import type { Display, PaymentMode } from "@/lib/ordering";

/** One cart line as sent to the server (prices only to detect changes). */
export type CartLineInput = {
  productId: string;
  variantId: string | null;
  qty: number;
  /** Price per unit the browser showed when the line was added. */
  unitPrice?: number;
  unitCredits?: number;
};

export type DeliveryChoice = {
  /** Saved company address; null = a custom address. */
  addressId: string | null;
  custom: boolean;
};

export type LineCheck = {
  productId: string;
  variantId: string | null;
  /** Can be ordered at all (exists, active, visible for the orderer). */
  available: boolean;
  name: string;
  variantLabel: string | null;
  image: string | null;
  /** Current price per unit. */
  unitPrice: number;
  unitCredits: number;
  /** Set when the price differs from what the browser had. */
  priceChanged: { fromEuro: number; toEuro: number; fromCredits: number; toCredits: number } | null;
  maxPerOrder: number | null;
  /** Maximum per product for this person, after this order. */
  cap: { max: number; remaining: number; period: string; over: boolean } | null;
  /** Other variants of the same product to switch to (e.g. sizes). */
  options: { id: string; label: string; mine: boolean; euro: number; credits: number }[];
  /** One sentence for under the line, or null. */
  message: string | null;
  tone: "warn" | "error" | null;
};

export type CartEvaluation = {
  ok: true;
  /** Name of the employee when a manager orders on behalf of someone. */
  forName: string | null;
  forRole: string | null;
  payment: PaymentMode;
  display: Display;
  lines: LineCheck[];
  totals: { euro: number; credits: number; items: number };
  budget: {
    total: number;
    remaining: number;
    /** Remaining after this order (can be negative). */
    after: number;
    period: string;
  } | null;
  approval: {
    required: boolean;
    /** Short Dutch reasons, e.g. "Boven je budget", "Ander adres". */
    reasons: string[];
    /** Who will review it, e.g. ["Wilko Zieleman"]. */
    approvers: string[];
  };
  /** Over budget: a written reason is required before placing. */
  reasonRequired: boolean;
  /** Something blocks placing altogether (e.g. nothing orderable left). */
  blocked: string | null;
};

export type SavedCart = {
  items: StoredCartItem[];
  saved: StoredCartItem[];
  updatedAt: string | null;
};

/** The shape kept in the browser and on the server. */
export type StoredCartItem = {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  unitPrice: number;
  unitCredits?: number;
  image: string | null;
  qty: number;
};
