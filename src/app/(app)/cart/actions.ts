"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { variantLabel } from "@/lib/format";

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
 * Creates one order from the cart. Prices are recomputed server-side from the
 * database (never trusted from the client). Order number + approval status are
 * set by database triggers.
 */
export async function createOrderFromCart(
  items: CheckoutItem[],
  shipTo: ShipTo,
): Promise<{ orderId: string }> {
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
  }[] = [];
  let subtotal = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.qty));
    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, sku, base_price, max_quantity_per_order")
      .eq("id", item.productId)
      .single();
    if (error || !product) throw new Error("Product niet gevonden");
    if (
      product.max_quantity_per_order &&
      qty > product.max_quantity_per_order
    ) {
      throw new Error(
        `Maximaal ${product.max_quantity_per_order} per bestelling voor ${product.name}`,
      );
    }

    let unitPrice = Number(product.base_price ?? 0);
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
        if (variant.price_override != null)
          unitPrice = Number(variant.price_override);
      }
    }

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    lines.push({
      product_id: product.id,
      variant_id: item.variantId,
      product_name: product.name,
      variant_label: label,
      sku,
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal,
    });
  }

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
    })
    .select("id")
    .single();
  if (oErr) throw new Error(oErr.message);

  const { error: iErr } = await supabase.from("order_items").insert(
    lines.map((l) => ({
      order_id: order.id,
      company_id: user.companyId,
      ...l,
    })),
  );
  if (iErr) throw new Error(iErr.message);

  await supabase
    .from("orders")
    .update({ subtotal, total: subtotal })
    .eq("id", order.id);

  return { orderId: order.id };
}
