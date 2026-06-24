"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { getAllowance } from "@/lib/allowance";
import { variantLabel, formatPrice } from "@/lib/format";
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

/**
 * Creates one order from the cart. Prices/credits are recomputed server-side
 * (never trusted from the client). If the order exceeds the member's remaining
 * allowance (euro/credits/quantity), it is flagged as a request (is_request +
 * reason) and the DB trigger routes it to approval.
 */
export type CheckoutResult =
  | { ok: true; orderId: string; isRequest: boolean }
  | { ok: false; error: string; code?: "reason_required" };

export async function createOrderFromCart(
  items: CheckoutItem[],
  delivery: Delivery,
  options?: { reason?: string },
): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user || !user.companyId) return { ok: false, error: "Geen toegang" };
  if (!items.length)
    return { ok: false, error: "Je winkelwagen is leeg" };

  const supabase = await createClient();

  // Resolve the delivery address. A selected saved company address is trusted
  // (loaded server-side); a manual address is only treated as a deviation that
  // needs approval when the company actually has saved addresses to deviate from.
  const note = delivery.note?.trim() || null;
  let shipTo: ShipTo = {};
  let addressIsCustom = false;

  if (delivery.addressId) {
    const { data: addr } = await supabase
      .from("company_addresses")
      .select("label, recipient, street, postal_code, city, country")
      .eq("id", delivery.addressId)
      .eq("company_id", user.companyId)
      .single();
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
    const { count } = await supabase
      .from("company_addresses")
      .select("*", { count: "exact", head: true })
      .eq("company_id", user.companyId);
    addressIsCustom = (count ?? 0) > 0;
  }

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
  const qtyByProduct: Record<string, number> = {};

  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.qty));
    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, sku, base_price, credit_cost, max_quantity_per_order")
      .eq("id", item.productId)
      .single();
    if (error || !product)
      return { ok: false, error: "Product niet gevonden" };
    if (product.max_quantity_per_order && qty > product.max_quantity_per_order) {
      return {
        ok: false,
        error: `Maximaal ${product.max_quantity_per_order} per bestelling voor ${product.name}`,
      };
    }

    let unitPrice = Number(product.base_price ?? 0);
    const creditCost = Number(product.credit_cost ?? 0);
    let label: string | null = item.variantLabel?.trim() || null;
    let sku: string | null = product.sku;
    // Only keep variant_id if the variant still exists (carts in localStorage
    // can hold stale ids after the catalog/options are re-generated).
    let resolvedVariantId: string | null = null;
    if (item.variantId) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("id, attributes, sku, price_override")
        .eq("id", item.variantId)
        .maybeSingle();
      if (variant) {
        resolvedVariantId = variant.id;
        label = variantLabel(variant.attributes as Record<string, unknown>);
        sku = variant.sku ?? sku;
        if (variant.price_override != null) unitPrice = Number(variant.price_override);
      }
    }

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    creditTotal += creditCost * qty;
    qtyByProduct[product.id] = (qtyByProduct[product.id] ?? 0) + qty;
    lines.push({
      product_id: product.id,
      variant_id: resolvedVariantId,
      product_name: product.name,
      variant_label: label,
      sku,
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal,
      credit_cost: creditCost,
    });
  }

  // Over-allowance detection in the company's mode.
  const allowance = await getAllowance(user);
  let isOver = false;
  if (allowance.hasLimit) {
    if (allowance.mode === "euro" && allowance.remaining != null)
      isOver = subtotal > allowance.remaining;
    else if (allowance.mode === "credits" && allowance.remaining != null)
      isOver = creditTotal > allowance.remaining;
    else if (allowance.mode === "quantity") {
      for (const [pid, q] of Object.entries(qtyByProduct)) {
        const rem = allowance.perProduct?.[pid]?.remaining;
        if (rem != null && q > rem) isOver = true;
      }
    }
  }

  const userReason = options?.reason?.trim() || null;
  // Over-allowance still requires a written reason from the member.
  if (isOver && !userReason)
    return {
      ok: false,
      code: "reason_required",
      error: "Geef een reden op voor je aanvraag.",
    };

  // A custom delivery address always routes to approval (auto reason).
  const reasonParts: string[] = [];
  if (isOver && userReason) reasonParts.push(userReason);
  if (addressIsCustom) {
    const addrText = [shipTo.name, shipTo.address, shipTo.postal, shipTo.city]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(", ");
    reasonParts.push(
      `Afwijkend leveradres${addrText ? `: ${addrText}` : ""}`,
    );
  }
  const isRequest = isOver || addressIsCustom;
  const finalReason = reasonParts.join(" · ") || null;

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert({
      company_id: user.companyId,
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
      is_request: isRequest,
      request_reason: finalReason,
    })
    .select("id, order_number, status")
    .single();
  if (oErr || !order)
    return { ok: false, error: `Bestelling mislukt: ${oErr?.message ?? "onbekend"}` };

  const { error: iErr } = await supabase.from("order_items").insert(
    lines.map((l) => ({ order_id: order.id, company_id: user.companyId, ...l })),
  );
  if (iErr)
    return { ok: false, error: `Bestelregels mislukt: ${iErr.message}` };

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
        <p><strong>Totaal: ${formatPrice(subtotal)}</strong></p>`,
    });
  }

  // Auto-approved orders are synced to JamesPRO right after the response.
  if (order.status === "approved") {
    after(async () => {
      await processOrderSync(order.id);
    });
  }

  return { ok: true, orderId: order.id, isRequest };
}
