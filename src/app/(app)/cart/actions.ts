"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { getAllowance } from "@/lib/allowance";
import { variantLabel, formatPrice } from "@/lib/format";
import { effectiveCredits, formatCredits, PERIOD_LABEL, type Period } from "@/lib/ordering";
import { seesFullCatalogue } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { processOrderSync } from "@/lib/jamespro/sync";

export type CheckoutItem = {
  productId: string;
  variantId: string | null;
  variantLabel?: string | null;
  qty: number;
};

export type ShipTo = {
  name?: string;
  address?: string;
  postal?: string;
  city?: string;
  country?: string;
  note?: string;
};

export type Delivery = {
  /** Selected saved company address; empty = manual entry. */
  addressId?: string | null;
  /** Manual address fields (used when addressId is empty). */
  custom?: ShipTo;
  note?: string;
};

export type CheckoutResult =
  | { ok: true; orderId: string; isRequest: boolean }
  | { ok: false; error: string; code?: "reason_required" };

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
  variants: {
    id: string;
    attributes: Record<string, unknown>;
    sku: string | null;
    price_override: number | null;
    credit_cost: number | null;
  }[];
};

/**
 * Creates one order from the cart. Euro prices and credits are recomputed
 * server-side (never trusted from the browser) and the order is written with
 * the admin client after checking access, visibility, budget and maxima.
 * Going over budget needs a written reason; going over a maximum or using a
 * custom address turns the order into a request that needs approval.
 */
export async function createOrderFromCart(
  items: CheckoutItem[],
  delivery: Delivery,
  options?: { reason?: string },
): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.create"))
    return { ok: false, error: "Geen toegang" };
  if (!items.length) return { ok: false, error: "Je winkelwagen is leeg" };

  const companyId = user.companyId;
  const admin = createAdminClient();

  // Delivery address: a saved company address is trusted; a manual address is
  // a deviation (needs approval) only when saved addresses exist.
  const note = delivery.note?.trim() || null;
  let shipTo: ShipTo = {};
  let addressIsCustom = false;
  if (delivery.addressId) {
    const { data: addr } = await admin
      .from("company_addresses")
      .select("label, recipient, street, postal_code, city, country")
      .eq("id", delivery.addressId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!addr) return { ok: false, error: "Gekozen leveradres niet gevonden" };
    shipTo = {
      name: addr.recipient ?? addr.label,
      address: addr.street ?? undefined,
      postal: addr.postal_code ?? undefined,
      city: addr.city ?? undefined,
      country: addr.country ?? undefined,
    };
  } else {
    shipTo = delivery.custom ?? {};
    const { count } = await admin
      .from("company_addresses")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    addressIsCustom = (count ?? 0) > 0;
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const [{ data: productData }, { data: rules }, { settings, allowance }] = await Promise.all([
    admin
      .from("products")
      .select(
        "id, name, sku, status, base_price, credit_cost, credit_cost_manual, category_id, max_quantity_per_order, variants:product_variants(id, attributes, sku, price_override, credit_cost)",
      )
      .eq("company_id", companyId)
      .in("id", productIds),
    admin
      .from("category_role_visibility")
      .select("category_id, role_id")
      .eq("company_id", companyId),
    getAllowance(user),
  ]);
  const products = new Map(
    ((productData ?? []) as unknown as ProductRow[]).map((p) => [p.id, p]),
  );

  // Same catalogue rule as the shop.
  const restricted = new Map<string, Set<string>>();
  for (const r of rules ?? []) {
    const s = restricted.get(r.category_id) ?? new Set<string>();
    s.add(r.role_id);
    restricted.set(r.category_id, s);
  }
  const fullCatalogue = seesFullCatalogue(user.permissions);
  const visible = (p: ProductRow) => {
    if (fullCatalogue || !p.category_id) return true;
    const set = restricted.get(p.category_id);
    return !set || (!!user.roleId && set.has(user.roleId));
  };

  const rate = settings.creditRate;
  const lines: {
    product_id: string;
    variant_id: string | null;
    product_name: string;
    variant_label: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
    credit_cost: number;
  }[] = [];
  let subtotal = 0;
  let creditTotal = 0;
  const qtyByProduct = new Map<string, number>();

  for (const item of items) {
    const p = products.get(item.productId);
    if (!p || p.status !== "active" || !visible(p))
      return { ok: false, error: "Een product in je winkelwagen is niet (meer) beschikbaar." };

    const qty = Math.max(1, Math.floor(item.qty));
    if (p.max_quantity_per_order && qty > p.max_quantity_per_order)
      return {
        ok: false,
        error: `Maximaal ${p.max_quantity_per_order} per bestelling voor ${p.name}`,
      };

    // Stale variant ids (catalogue regenerated) fall back to the product.
    const variant = item.variantId
      ? (p.variants.find((v) => v.id === item.variantId) ?? null)
      : null;
    const unitPrice =
      variant?.price_override != null ? Number(variant.price_override) : Number(p.base_price ?? 0);
    const unitCredits = effectiveCredits(p, variant, rate);

    subtotal += unitPrice * qty;
    creditTotal += unitCredits * qty;
    qtyByProduct.set(p.id, (qtyByProduct.get(p.id) ?? 0) + qty);
    lines.push({
      product_id: p.id,
      variant_id: variant?.id ?? null,
      product_name: p.name,
      variant_label: variant
        ? variantLabel(variant.attributes)
        : item.variantLabel?.trim() || null,
      sku: variant?.sku ?? p.sku,
      quantity: qty,
      unit_price: unitPrice,
      line_total: unitPrice * qty,
      credit_cost: unitCredits,
    });
  }

  // Maxima per product.
  const capReasons: string[] = [];
  if (allowance.capsEnabled) {
    for (const [pid, qty] of qtyByProduct) {
      const cap = allowance.caps[pid];
      const name = products.get(pid)?.name ?? "product";
      if (!cap) {
        if (allowance.uncapped === "blocked")
          return {
            ok: false,
            error: `${name} kun je niet bestellen: er is voor jou geen maximum ingesteld.`,
          };
        continue;
      }
      if (qty > cap.remaining) {
        const period = PERIOD_LABEL[cap.period as Period] ?? "";
        capReasons.push(
          `Maximum overschreden: ${name} (${cap.used + qty} van ${cap.max} ${period})`.trim(),
        );
      }
    }
  }

  // Budget in the payment unit (approved extra budget is included).
  let overBudget = false;
  if (allowance.budget) {
    const spend = settings.payment === "credits" ? creditTotal : subtotal;
    overBudget = spend > allowance.budget.remaining + 1e-9;
  }

  const userReason = options?.reason?.trim() || null;
  if (overBudget && !userReason)
    return {
      ok: false,
      code: "reason_required",
      error: "Geef een reden op voor je aanvraag.",
    };

  const reasonParts: string[] = [];
  if (overBudget && userReason) reasonParts.push(userReason);
  reasonParts.push(...capReasons);
  if (addressIsCustom) {
    const addrText = [shipTo.name, shipTo.address, shipTo.postal, shipTo.city]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(", ");
    reasonParts.push(`Afwijkend leveradres${addrText ? `: ${addrText}` : ""}`);
  }
  const isRequest = overBudget || capReasons.length > 0 || addressIsCustom;
  const finalReason = reasonParts.join(" · ") || null;

  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      company_id: companyId,
      ordered_by: user.id,
      note,
      ship_to_name: shipTo.name?.trim() || null,
      ship_to_address: shipTo.address?.trim() || null,
      ship_to_postal: shipTo.postal?.trim() || null,
      ship_to_city: shipTo.city?.trim() || null,
      ship_to_country: shipTo.country?.trim() || null,
      ship_to_custom: addressIsCustom,
      subtotal,
      total: subtotal,
      credit_total: creditTotal,
      credit_rate: settings.payment === "credits" ? rate : null,
      is_request: isRequest,
      request_reason: finalReason,
    })
    .select("id, order_number, status")
    .single();
  if (oErr || !order)
    return { ok: false, error: `Bestelling mislukt: ${oErr?.message ?? "onbekend"}` };

  const { error: iErr } = await admin
    .from("order_items")
    .insert(lines.map((l) => ({ order_id: order.id, company_id: companyId, ...l })));
  if (iErr) {
    // Never leave an order without lines behind.
    await admin.from("orders").delete().eq("id", order.id);
    return { ok: false, error: `Bestelregels mislukt: ${iErr.message}` };
  }

  const notifyTo = process.env.ALVASI_NOTIFY_EMAIL;
  if (notifyTo) {
    const rows = lines
      .map(
        (l) =>
          `<li>${l.quantity} × ${l.product_name}${
            l.variant_label ? ` (${l.variant_label})` : ""
          } — ${formatPrice(l.line_total)}</li>`,
      )
      .join("");
    await sendEmail({
      to: notifyTo,
      subject: `${isRequest ? "Aanvraag" : "Nieuwe bestelling"} ${order.order_number ?? ""} — ${user.company?.name ?? ""}`,
      html: `<h2>${isRequest ? "Aanvraag" : "Nieuwe bestelling"} ${order.order_number ?? ""}</h2>
        <p>Bedrijf: ${user.company?.name ?? ""}<br/>Besteld door: ${user.fullName ?? user.email ?? ""}</p>
        ${finalReason ? `<p>Reden: ${finalReason}</p>` : ""}
        <ul>${rows}</ul>
        <p><strong>Totaal: ${formatPrice(subtotal)}</strong>${
          settings.payment === "credits" ? ` (${formatCredits(creditTotal)})` : ""
        }</p>`,
    });
  }

  // Orders that skip approval go straight to production and are synced to
  // JamesPRO right after the response.
  if (order.status === "in_production") {
    after(async () => {
      await processOrderSync(order.id);
    });
  }

  return { ok: true, orderId: order.id, isRequest };
}
