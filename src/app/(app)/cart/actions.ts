"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { getAllowance } from "@/lib/allowance";
import { variantLabel, formatPrice } from "@/lib/format";
import { sendEmail } from "@/lib/email";

export type CheckoutItem = {
  productId: string;
  variantId: string | null;
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

/**
 * Creates one order from the cart. Prices/credits are recomputed server-side
 * (never trusted from the client). If the order exceeds the member's remaining
 * allowance (euro/credits/quantity), it is flagged as a request (is_request +
 * reason) and the DB trigger routes it to approval.
 */
export async function createOrderFromCart(
  items: CheckoutItem[],
  shipTo: ShipTo,
  options?: { reason?: string },
): Promise<{ orderId: string; isRequest: boolean }> {
  const user = await getCurrentUser();
  if (!user || !user.companyId) throw new Error("Geen toegang");
  if (!items.length) throw new Error("Je winkelwagen is leeg");

  const supabase = await createClient();

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
    if (error || !product) throw new Error("Product niet gevonden");
    if (product.max_quantity_per_order && qty > product.max_quantity_per_order) {
      throw new Error(
        `Maximaal ${product.max_quantity_per_order} per bestelling voor ${product.name}`,
      );
    }

    let unitPrice = Number(product.base_price ?? 0);
    const creditCost = Number(product.credit_cost ?? 0);
    let label: string | null = null;
    let sku: string | null = product.sku;
    if (item.variantId) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("attributes, sku, price_override")
        .eq("id", item.variantId)
        .single();
      if (variant) {
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
      variant_id: item.variantId,
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

  const reason = options?.reason?.trim() || null;
  if (isOver && !reason)
    throw new Error("Geef een reden op voor je aanvraag.");

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert({
      company_id: user.companyId,
      ordered_by: user.id,
      note: shipTo.note?.trim() || null,
      ship_to_name: shipTo.name?.trim() || null,
      ship_to_address: shipTo.address?.trim() || null,
      ship_to_postal: shipTo.postal?.trim() || null,
      ship_to_city: shipTo.city?.trim() || null,
      ship_to_country: shipTo.country?.trim() || null,
      subtotal,
      total: subtotal,
      credit_total: creditTotal,
      is_request: isOver,
      request_reason: isOver ? reason : null,
    })
    .select("id, order_number")
    .single();
  if (oErr) throw new Error(oErr.message);

  const { error: iErr } = await supabase.from("order_items").insert(
    lines.map((l) => ({ order_id: order.id, company_id: user.companyId, ...l })),
  );
  if (iErr) throw new Error(iErr.message);

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
      subject: `${isOver ? "Aanvraag" : "Nieuwe bestelling"} ${order.order_number ?? ""} — ${user.company?.name ?? ""}`,
      html: `<h2>${isOver ? "Aanvraag" : "Nieuwe bestelling"} ${order.order_number ?? ""}</h2>
        <p>Bedrijf: ${user.company?.name ?? ""}<br/>Besteld door: ${user.fullName ?? user.email ?? ""}</p>
        ${isOver && reason ? `<p>Reden: ${reason}</p>` : ""}
        <ul>${rows}</ul>
        <p><strong>Totaal: ${formatPrice(subtotal)}</strong></p>`,
    });
  }

  return { orderId: order.id, isRequest: isOver };
}
