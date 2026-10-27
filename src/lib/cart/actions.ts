"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { getOrderRecipient } from "@/lib/shop/recipient";
import { evaluateCart } from "./evaluate";
import type {
  CartEvaluation,
  CartLineInput,
  DeliveryChoice,
  SavedCart,
  StoredCartItem,
} from "./types";

const MAX_LINES = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What placing this cart would do, computed with the same rules as placing. */
export async function previewCart(
  items: CartLineInput[],
  delivery: DeliveryChoice,
): Promise<CartEvaluation | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.create")) return { ok: false, error: "Geen toegang" };
  const clean = (Array.isArray(items) ? items : [])
    .slice(0, MAX_LINES)
    .filter((i) => i && UUID.test(String(i.productId)))
    .map((i) => ({
      productId: String(i.productId),
      variantId: i.variantId && UUID.test(String(i.variantId)) ? String(i.variantId) : null,
      qty: Math.min(9999, Math.max(1, Math.floor(Number(i.qty) || 1))),
      unitPrice: typeof i.unitPrice === "number" ? i.unitPrice : undefined,
      unitCredits: typeof i.unitCredits === "number" ? i.unitCredits : undefined,
    }));
  return evaluateCart(user, clean, {
    addressId: delivery?.addressId && UUID.test(delivery.addressId) ? delivery.addressId : null,
    custom: !!delivery?.custom,
  });
}

function cleanItems(list: unknown): StoredCartItem[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_LINES)
    .filter(
      (i): i is StoredCartItem =>
        !!i && typeof i === "object" && UUID.test(String((i as StoredCartItem).productId)),
    )
    .map((i) => ({
      productId: String(i.productId),
      variantId: i.variantId && UUID.test(String(i.variantId)) ? String(i.variantId) : null,
      name: String(i.name ?? "").slice(0, 200),
      variantLabel: i.variantLabel ? String(i.variantLabel).slice(0, 200) : null,
      unitPrice: Number(i.unitPrice) || 0,
      unitCredits: i.unitCredits != null ? Number(i.unitCredits) || 0 : undefined,
      image: typeof i.image === "string" && i.image.startsWith("https://") ? i.image.slice(0, 500) : null,
      qty: Math.min(9999, Math.max(1, Math.floor(Number(i.qty) || 1))),
    }));
}

/** The cart of the signed-in user for the current "voor wie", or null. */
export async function loadCart(): Promise<SavedCart | null> {
  const user = await getCurrentUser();
  if (!user?.companyId) return null;
  const recipient = await getOrderRecipient(user);
  const supabase = await createClient();
  let q = supabase.from("carts").select("items, saved, updated_at").eq("user_id", user.id);
  q = recipient ? q.eq("for_user_id", recipient.id) : q.is("for_user_id", null);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  return {
    items: cleanItems(data.items),
    saved: cleanItems(data.saved),
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}

/** Stores the cart on the server so it follows the user across devices. */
export async function saveCart(cart: {
  items: StoredCartItem[];
  saved: StoredCartItem[];
}): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user?.companyId) return { ok: false };
  const recipient = await getOrderRecipient(user);
  const supabase = await createClient();
  const row = {
    user_id: user.id,
    for_user_id: recipient?.id ?? null,
    company_id: user.companyId,
    items: cleanItems(cart?.items),
    saved: cleanItems(cart?.saved),
    updated_at: new Date().toISOString(),
  };

  // The unique index is on an expression, so upsert by hand.
  let find = supabase.from("carts").select("user_id").eq("user_id", user.id);
  find = recipient ? find.eq("for_user_id", recipient.id) : find.is("for_user_id", null);
  const { data: existing } = await find.maybeSingle();
  if (existing) {
    let upd = supabase
      .from("carts")
      .update({ items: row.items, saved: row.saved, updated_at: row.updated_at, company_id: row.company_id })
      .eq("user_id", user.id);
    upd = recipient ? upd.eq("for_user_id", recipient.id) : upd.is("for_user_id", null);
    const { error } = await upd;
    return { ok: !error };
  }
  const { error } = await supabase.from("carts").insert(row);
  return { ok: !error };
}
