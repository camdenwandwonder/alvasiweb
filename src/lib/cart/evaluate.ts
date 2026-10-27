import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isMember, type CurrentUser } from "@/lib/auth/user";
import { getAllowanceFor, type PersonAllowance } from "@/lib/allowance";
import { getOrderRecipient, type OrderRecipient } from "@/lib/shop/recipient";
import { variantLabel } from "@/lib/format";
import {
  displayFor,
  effectiveCredits,
  formatAmount,
  formatCredits,
  type OrderingSettings,
} from "@/lib/ordering";
import { seesFullCatalogue } from "@/lib/permissions";
import type { CartEvaluation, CartLineInput, DeliveryChoice, LineCheck } from "./types";

const PERIOD_NOW: Record<string, string> = {
  monthly: "deze maand",
  quarterly: "dit kwartaal",
  yearly: "dit jaar",
  once: "in totaal",
};

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  status: string;
  base_price: number | null;
  credit_cost: number | null;
  credit_cost_manual: boolean;
  category_id: string | null;
  max_quantity_per_order: number | null;
  requires_approval_override: boolean | null;
  variants: {
    id: string;
    attributes: Record<string, unknown>;
    sku: string | null;
    price_override: number | null;
    credit_cost: number | null;
  }[];
  images: { url: string; is_primary: boolean }[] | null;
};

/** One order line ready to insert. */
export type OrderLine = {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  credit_cost: number;
};

export type Orderer = {
  id: string;
  roleId: string | null;
  permissions: string[];
  name: string;
  email: string | null;
};

/** Everything placing an order needs on top of what the preview shows. */
export type CartRun = {
  evaluation: CartEvaluation;
  companyId: string;
  recipient: OrderRecipient | null;
  orderer: Orderer;
  settings: OrderingSettings;
  allowance: PersonAllowance;
  lines: OrderLine[];
  subtotal: number;
  creditTotal: number;
  /** Reasons for the request text, as stored today. */
  capReasons: string[];
  overBudget: boolean;
  addressIsCustom: boolean;
  /** Products marked "altijd goedkeuring" in this cart. */
  approvalProducts: string[];
  /** Problems that stop placing (unavailable, max per order, stale variant). */
  errors: string[];
};

/** "L · Navy" from {"Maat":"L","Kleur":"Navy"}. */
function shortLabel(attributes: Record<string, unknown> | null): string {
  return Object.values(attributes ?? {})
    .map((v) => String(v).trim())
    .filter(Boolean)
    .join(" · ");
}

/** Who reviews requests: active people whose functie may approve (max 3). */
export async function approverNames(companyId: string, excludeId: string | null): Promise<string[]> {
  const admin = createAdminClient();
  const { data: perms } = await admin
    .from("role_permissions")
    .select("role_id, role:roles!inner(company_id)")
    .eq("permission", "orders.approve")
    .eq("role.company_id", companyId);
  const roleIds = [...new Set((perms ?? []).map((p) => p.role_id as string))];
  if (!roleIds.length) return [];
  let q = admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("company_id", companyId)
    .in("role_id", roleIds)
    .neq("status", "disabled")
    .order("full_name")
    .limit(4);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data ?? [])
    .map((p) => (p.full_name as string | null) || (p.email as string | null) || "")
    .filter(Boolean)
    .slice(0, 3);
}

/** Size values/labels the orderer saved as standard sizes. */
async function preferredSizes(userId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: sizeSets }] = await Promise.all([
    admin.from("profiles").select("sizes").eq("id", userId).maybeSingle(),
    admin.from("option_sets").select("id, values:option_values(value, label)").eq("kind", "size"),
  ]);
  const preferred = new Set<string>();
  const sizes = (profile?.sizes as Record<string, string> | null) ?? {};
  for (const [setId, val] of Object.entries(sizes)) {
    if (!val) continue;
    preferred.add(String(val));
    const set = (sizeSets ?? []).find((s) => s.id === setId) as
      | { values: { value: string; label: string | null }[] }
      | undefined;
    const ov = set?.values?.find((v) => v.value === val);
    if (ov?.label) preferred.add(ov.label);
  }
  return preferred;
}

/**
 * The single source of the cart rules, used by the checkout preview and by
 * placing the order: availability, prices, maxima, budget and approval.
 */
export async function runCart(
  user: CurrentUser,
  items: (CartLineInput & { variantLabel?: string | null })[],
  delivery: DeliveryChoice,
): Promise<CartRun | { ok: false; error: string }> {
  if (!user.companyId) return { ok: false, error: "Geen toegang" };
  const companyId = user.companyId;
  const admin = createAdminClient();

  const recipient = await getOrderRecipient(user);
  const orderer: Orderer = recipient
    ? {
        id: recipient.id,
        roleId: recipient.roleId,
        permissions: recipient.permissions,
        name: recipient.name,
        email: recipient.email,
      }
    : {
        id: user.id,
        roleId: user.roleId,
        permissions: user.permissions,
        name: user.fullName ?? user.email ?? "",
        email: user.email,
      };
  const first = recipient ? recipient.name.split(" ")[0] : null;

  const productIds = [...new Set(items.map((i) => i.productId))];
  const [
    { data: productData },
    { data: rules },
    { settings, allowance },
    { count: addressCount },
    { data: role },
    preferred,
    approvers,
  ] = await Promise.all([
    admin
      .from("products")
      .select(
        "id, name, sku, status, base_price, credit_cost, credit_cost_manual, category_id, max_quantity_per_order, requires_approval_override, variants:product_variants(id, attributes, sku, price_override, credit_cost), images:product_images(url, is_primary)",
      )
      .eq("company_id", companyId)
      .in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("category_role_visibility").select("category_id, role_id").eq("company_id", companyId),
    getAllowanceFor(companyId, orderer.id),
    admin.from("company_addresses").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("archived_at", null),
    orderer.roleId
      ? admin.from("roles").select("requires_order_approval").eq("id", orderer.roleId).maybeSingle()
      : Promise.resolve({ data: null }),
    preferredSizes(orderer.id),
    approverNames(companyId, orderer.id),
  ]);

  const products = new Map(((productData ?? []) as unknown as ProductRow[]).map((p) => [p.id, p]));
  const restricted = new Map<string, Set<string>>();
  for (const r of rules ?? []) {
    const s = restricted.get(r.category_id as string) ?? new Set<string>();
    s.add(r.role_id as string);
    restricted.set(r.category_id as string, s);
  }
  const fullCatalogue = seesFullCatalogue(orderer.permissions);
  const visible = (p: ProductRow) => {
    if (fullCatalogue || !p.category_id) return true;
    const set = restricted.get(p.category_id);
    return !set || (!!orderer.roleId && set.has(orderer.roleId));
  };

  const display = displayFor(settings, isMember(user) ? "member" : "manager");
  const credits = settings.payment === "credits";
  const rate = settings.creditRate;
  const errors: string[] = [];
  const lines: OrderLine[] = [];
  const checks: LineCheck[] = [];
  let subtotal = 0;
  let creditTotal = 0;
  let count = 0;

  // Quantity per product first: maxima count the whole product, not one size.
  const qtyByProduct = new Map<string, number>();
  for (const i of items) {
    const p = products.get(i.productId);
    if (p && p.status === "active" && visible(p))
      qtyByProduct.set(p.id, (qtyByProduct.get(p.id) ?? 0) + Math.max(1, Math.floor(i.qty)));
  }

  const capReasons: string[] = [];
  const approvalReasons: string[] = [];

  for (const item of items) {
    const p = products.get(item.productId);
    const qty = Math.max(1, Math.floor(item.qty));
    const image = p
      ? ((p.images ?? []).find((im) => im.is_primary)?.url ?? (p.images ?? [])[0]?.url ?? null)
      : null;

    const uncappedBlocked =
      !!p && allowance.capsEnabled && !allowance.caps[p.id] && allowance.uncapped === "blocked";
    if (!p || p.status !== "active" || !visible(p) || uncappedBlocked) {
      const message = uncappedBlocked
        ? first
          ? `Dit product kan niet besteld worden: er is voor ${first} geen maximum ingesteld.`
          : "Dit product kun je niet bestellen: er is voor jou geen maximum ingesteld."
        : "Dit product is niet meer beschikbaar.";
      errors.push(`${p?.name ?? "Een product"}: ${message}`);
      checks.push({
        productId: item.productId,
        variantId: item.variantId,
        available: false,
        name: p?.name ?? item.variantLabel ?? "Product",
        variantLabel: null,
        image,
        unitPrice: item.unitPrice ?? 0,
        unitCredits: item.unitCredits ?? 0,
        priceChanged: null,
        maxPerOrder: null,
        cap: null,
        options: [],
        message,
        tone: "error",
      });
      continue;
    }

    const variant = item.variantId ? (p.variants.find((v) => v.id === item.variantId) ?? null) : null;
    const staleVariant = !!item.variantId && !variant && p.variants.length > 1;
    const unitPrice =
      variant?.price_override != null ? Number(variant.price_override) : Number(p.base_price ?? 0);
    const unitCredits = effectiveCredits(p, variant, rate);

    const changed =
      (item.unitPrice != null && Math.abs(item.unitPrice - unitPrice) > 0.005) ||
      (item.unitCredits != null && Math.abs(item.unitCredits - unitCredits) > 0.005);
    const priceChanged = changed
      ? {
          fromEuro: item.unitPrice ?? unitPrice,
          toEuro: unitPrice,
          fromCredits: item.unitCredits ?? unitCredits,
          toCredits: unitCredits,
        }
      : null;

    const cap = allowance.capsEnabled ? allowance.caps[p.id] : undefined;
    const productQty = qtyByProduct.get(p.id) ?? qty;
    const capOver = !!cap && productQty > cap.remaining;
    const overMax = !!p.max_quantity_per_order && qty > p.max_quantity_per_order;

    const parts: string[] = [];
    if (priceChanged && display !== "hidden") {
      parts.push(
        display === "credits"
          ? `Prijs aangepast van ${formatCredits(priceChanged.fromCredits)} naar ${formatCredits(priceChanged.toCredits)}.`
          : `Prijs aangepast van ${euro.format(priceChanged.fromEuro)} naar ${euro.format(priceChanged.toEuro)}.`,
      );
    }
    if (staleVariant) parts.push("Deze uitvoering bestaat niet meer. Kies een andere.");
    if (overMax) parts.push(`Maximaal ${p.max_quantity_per_order} per bestelling.`);
    if (capOver && cap) {
      const period = PERIOD_NOW[cap.period] ?? "";
      parts.push(
        `${first ? `${first} bestelt` : "Je bestelt"} er ${productQty}, ${first ? `${first} heeft` : "je hebt"} er nog ${Math.max(0, cap.remaining)} van ${cap.max} ${period}: dit wordt een aanvraag.`.replace(
          /\s+:/,
          ":",
        ),
      );
    }

    if (staleVariant) errors.push(`${p.name}: kies een andere uitvoering.`);
    if (overMax) errors.push(`Maximaal ${p.max_quantity_per_order} per bestelling voor ${p.name}.`);

    const options = p.variants.length > 1
      ? p.variants.map((v) => ({
          id: v.id,
          label: shortLabel(v.attributes),
          mine: Object.values(v.attributes ?? {}).some((x) => preferred.has(String(x))),
          euro: v.price_override != null ? Number(v.price_override) : Number(p.base_price ?? 0),
          credits: effectiveCredits(p, v, rate),
        }))
      : [];

    checks.push({
      productId: p.id,
      variantId: variant?.id ?? item.variantId,
      available: true,
      name: p.name,
      variantLabel: variant ? shortLabel(variant.attributes) || null : null,
      image,
      unitPrice,
      unitCredits,
      priceChanged,
      maxPerOrder: p.max_quantity_per_order,
      cap: cap
        ? { max: cap.max, remaining: cap.remaining - productQty, period: cap.period, over: capOver }
        : null,
      options,
      message: parts.length ? parts.join(" ") : null,
      tone: staleVariant || overMax ? "error" : parts.length ? "warn" : null,
    });

    subtotal += unitPrice * qty;
    creditTotal += unitCredits * qty;
    count += qty;
    lines.push({
      product_id: p.id,
      variant_id: variant?.id ?? null,
      product_name: p.name,
      variant_label: variant ? variantLabel(variant.attributes) : item.variantLabel?.trim() || null,
      sku: variant?.sku ?? p.sku,
      quantity: qty,
      unit_price: unitPrice,
      line_total: unitPrice * qty,
      credit_cost: unitCredits,
    });
  }

  // Maxima per product (once per product).
  if (allowance.capsEnabled) {
    for (const [pid, qty] of qtyByProduct) {
      const cap = allowance.caps[pid];
      if (!cap || qty <= cap.remaining) continue;
      const name = products.get(pid)?.name ?? "product";
      const period = PERIOD_NOW[cap.period] ?? "";
      capReasons.push(`Maximum overschreden: ${name} (${cap.used + qty} van ${cap.max} ${period})`.trim());
      approvalReasons.push(first ? `Boven het maximum van ${first} voor ${name}` : `Boven je maximum voor ${name}`);
    }
  }

  // Budget in the payment unit (approved extra budget is included).
  const spend = credits ? creditTotal : subtotal;
  let overBudget = false;
  let budget: CartEvaluation["budget"] = null;
  if (allowance.budget) {
    overBudget = spend > allowance.budget.remaining + 1e-9;
    budget = {
      total: allowance.budget.total,
      remaining: allowance.budget.remaining,
      after: Math.round((allowance.budget.remaining - spend) * 100) / 100,
      period: allowance.budget.period,
    };
    if (overBudget) approvalReasons.unshift(first ? `Boven het budget van ${first}` : "Boven je budget");
  }

  const addressIsCustom = delivery.custom && (addressCount ?? 0) > 0;
  if (addressIsCustom) approvalReasons.push("Ander adres");

  // Approvals the database decides on its own (functie, drempel) and products
  // that always need approval are reported too, so nothing comes as a surprise.
  if ((role as { requires_order_approval?: boolean } | null)?.requires_order_approval)
    approvalReasons.unshift(
      first ? `De functie van ${first} vraagt altijd goedkeuring` : "Je functie vraagt altijd goedkeuring",
    );
  if (settings.approvalOver != null && spend > settings.approvalOver)
    approvalReasons.push(`Boven de drempel van ${formatAmount(settings.approvalOver, settings.payment)}`);
  const approvalProducts: string[] = [];
  for (const pid of qtyByProduct.keys()) {
    const p = products.get(pid);
    if (p?.requires_approval_override) {
      approvalProducts.push(p.name);
      approvalReasons.push(`${p.name} vraagt altijd goedkeuring`);
    }
  }

  const evaluation: CartEvaluation = {
    ok: true,
    forName: recipient?.name ?? null,
    forRole: recipient?.roleName ?? null,
    payment: settings.payment,
    display,
    lines: checks,
    totals: {
      euro: Math.round(subtotal * 100) / 100,
      credits: Math.round(creditTotal * 100) / 100,
      items: count,
    },
    budget,
    approval: {
      required: approvalReasons.length > 0,
      reasons: [...new Set(approvalReasons)],
      approvers,
    },
    reasonRequired: overBudget,
    blocked: !lines.length
      ? items.length
        ? "Er staat niets in de winkelwagen dat besteld kan worden."
        : "Je winkelwagen is leeg."
      : null,
  };

  return {
    evaluation,
    companyId,
    recipient,
    orderer,
    settings,
    allowance,
    lines,
    subtotal,
    creditTotal,
    capReasons,
    overBudget,
    addressIsCustom,
    approvalProducts,
    errors,
  };
}

/** Preview of what placing this cart will do. */
export async function evaluateCart(
  user: CurrentUser,
  items: CartLineInput[],
  delivery: DeliveryChoice,
): Promise<CartEvaluation | { ok: false; error: string }> {
  const run = await runCart(user, items, delivery);
  return "evaluation" in run ? run.evaluation : run;
}
