/**
 * Ordering rules per organisation: how employees pay (none / euro / credits)
 * and optional maximum quantities per product. Pure functions only, so the
 * browser (previews) and the server (checkout) always calculate identically.
 */

export type PaymentMode = "none" | "euro" | "credits";
export type Period = "monthly" | "quarterly" | "yearly" | "once";

export type OrderingSettings = {
  payment: PaymentMode;
  /** Euro value of one credit (1 credit = € creditRate). */
  creditRate: number;
  capsEnabled: boolean;
  /** Products without a maximum while caps are on. */
  uncapped: "free" | "blocked";
  /** Show prices next to "nog X over" when payment is "none". */
  showPriceWithCaps: boolean;
  /** Approval needed above this amount, in the payment unit. */
  approvalOver: number | null;
};

export const PERIOD_LABEL: Record<Period, string> = {
  monthly: "per maand",
  quarterly: "per kwartaal",
  yearly: "per jaar",
  once: "eenmalig",
};

export function readOrderingSettings(
  raw: Record<string, unknown> | null | undefined,
): OrderingSettings {
  const s = raw ?? {};
  const legacy = s.budget_mode as string | undefined;
  const payment: PaymentMode =
    s.payment_mode === "none" || s.payment_mode === "euro" || s.payment_mode === "credits"
      ? s.payment_mode
      : legacy === "credits"
        ? "credits"
        : legacy === "quantity"
          ? "none"
          : "euro";
  const rate = Number(s.credit_rate);
  const threshold = s.approval_over_amount;
  return {
    payment,
    creditRate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    capsEnabled:
      typeof s.caps_enabled === "boolean" ? s.caps_enabled : legacy === "quantity",
    uncapped: s.uncapped_products === "blocked" ? "blocked" : "free",
    showPriceWithCaps: s.show_price_with_caps === true,
    approvalOver:
      threshold === null || threshold === undefined || threshold === ""
        ? null
        : Number(threshold),
  };
}

/** Whole credits for a euro price; always rounded up (never below the euro value). */
export function creditsFor(euro: number, rate: number): number {
  if (!(rate > 0) || !(euro > 0)) return 0;
  return Math.ceil(euro / rate - 1e-9);
}

export type CreditProduct = {
  base_price: number | null;
  credit_cost: number | null;
  credit_cost_manual: boolean;
};
export type CreditVariant = {
  price_override: number | null;
  credit_cost: number | null;
};

/** Euro unit price of a product (variant price wins when set). */
export function euroPrice(p: CreditProduct, v?: CreditVariant | null): number {
  if (v?.price_override != null) return Number(v.price_override);
  return Number(p.base_price ?? 0);
}

/** Credits the rate would give right now (ignores frozen/manual values). */
export function suggestedCredits(
  p: CreditProduct,
  v: CreditVariant | null | undefined,
  rate: number,
): number {
  return creditsFor(euroPrice(p, v), rate);
}

/**
 * The credit price that applies: a manual override wins, then the frozen
 * value, and only if nothing was frozen yet the live calculation — so a
 * product can never silently cost 0 credits.
 */
export function effectiveCredits(
  p: CreditProduct,
  v: CreditVariant | null | undefined,
  rate: number,
): number {
  if (p.credit_cost_manual && p.credit_cost != null) return Number(p.credit_cost);
  if (v && v.price_override != null) {
    return v.credit_cost != null
      ? Number(v.credit_cost)
      : suggestedCredits(p, v, rate);
  }
  return p.credit_cost != null ? Number(p.credit_cost) : suggestedCredits(p, null, rate);
}

/** True when the frozen credit price no longer matches the euro price. */
export function hasDrift(
  p: CreditProduct,
  v: CreditVariant | null | undefined,
  rate: number,
): boolean {
  if (p.credit_cost_manual) return false;
  return effectiveCredits(p, v, rate) !== suggestedCredits(p, v, rate);
}

/** Average extra euro value rounding adds across products, as a fraction. */
export function roundingGap(prices: number[], rate: number): number {
  const positive = prices.filter((p) => p > 0);
  if (!positive.length) return 0;
  const gaps = positive.map((p) => (creditsFor(p, rate) * rate - p) / p);
  return gaps.reduce((s, g) => s + g, 0) / gaps.length;
}

/**
 * Suggest a friendly rate: the largest simple value whose average rounding
 * gap stays within ~5%, which keeps budgets in tens to hundreds of credits
 * instead of thousands.
 */
export function suggestRate(prices: number[]): number {
  const friendly = [5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.01];
  return friendly.find((r) => roundingGap(prices, r) <= 0.05) ?? 0.01;
}

export type Display = "euro" | "credits" | "both" | "hidden";

/**
 * What a viewer sees as price. Members see one unit (or nothing); managers and
 * Alvasi always see euros, with credits alongside in credit mode.
 */
export function displayFor(
  settings: OrderingSettings,
  viewer: "member" | "manager",
): Display {
  if (settings.payment === "credits") return viewer === "member" ? "credits" : "both";
  if (settings.payment === "none" && settings.capsEnabled && !settings.showPriceWithCaps)
    return viewer === "member" ? "hidden" : "euro";
  return "euro";
}

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

export function formatCredits(n: number): string {
  return `${new Intl.NumberFormat("nl-NL").format(Math.round(n))} credits`;
}

/** One price string for the given display mode ("" when hidden). */
export function formatValue(eur: number, credits: number, display: Display): string {
  switch (display) {
    case "credits":
      return formatCredits(credits);
    case "both":
      return `${formatCredits(credits)} · ${euro.format(eur)}`;
    case "hidden":
      return "";
    default:
      return euro.format(eur);
  }
}

/** Budget amounts are stored in the payment unit. */
export function formatAmount(amount: number, payment: PaymentMode): string {
  return payment === "credits" ? formatCredits(amount) : euro.format(amount);
}

export function periodStart(period: string, now = new Date()): Date {
  if (period === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarterly") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), q, 1);
  }
  if (period === "yearly") return new Date(now.getFullYear(), 0, 1);
  return new Date(0);
}

/** Next reset date, or null for one-off budgets. */
export function periodReset(period: string, now = new Date()): Date | null {
  if (period === "monthly") return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (period === "quarterly") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), q + 3, 1);
  }
  if (period === "yearly") return new Date(now.getFullYear() + 1, 0, 1);
  return null;
}
