"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { variantLabel } from "@/lib/format";

export async function placeOrder(productId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.companyId) throw new Error("Not authorized");
  const supabase = await createClient();

  const variantId = String(formData.get("variant_id") ?? "") || null;
  const quantity = Number(formData.get("quantity") ?? "1");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error("Quantity must be at least 1");
  }

  // RLS guarantees this product belongs to the user's company.
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, name, sku, max_quantity_per_order")
    .eq("id", productId)
    .single();
  if (pErr || !product) throw new Error("Product not found");
  if (
    product.max_quantity_per_order &&
    quantity > product.max_quantity_per_order
  ) {
    throw new Error(`Maximum ${product.max_quantity_per_order} per order`);
  }

  let label: string | null = null;
  let variantSku: string | null = null;
  if (variantId) {
    const { data: variant } = await supabase
      .from("product_variants")
      .select("attributes, sku")
      .eq("id", variantId)
      .single();
    if (variant) {
      label = variantLabel(variant.attributes as Record<string, unknown>);
      variantSku = variant.sku;
    }
  }

  // Status is set by the DB trigger based on the user's role approval rule.
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert({ company_id: user.companyId, ordered_by: user.id, note })
    .select("id")
    .single();
  if (oErr) throw new Error(oErr.message);

  const { error: iErr } = await supabase.from("order_items").insert({
    order_id: order.id,
    company_id: user.companyId,
    product_id: product.id,
    variant_id: variantId,
    product_name: product.name,
    variant_label: label,
    sku: variantSku ?? product.sku,
    quantity,
  });
  if (iErr) throw new Error(iErr.message);

  revalidatePath("/orders");
  redirect("/orders");
}
