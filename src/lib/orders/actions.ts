"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { displayFor, readOrderingSettings, type Display } from "@/lib/ordering";
import { variantLabel } from "@/lib/format";
import { buildShop } from "@/lib/shop";
import type { CartItem } from "@/components/cart";
import { approveOrder, rejectOrder } from "@/app/(app)/orders/actions";

export type OrderDetail = {
  id: string;
  order_number: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  company_id: string;
  company_name: string | null;
  ordered_by: string;
  ordered_by_name: string | null;
  ordered_by_email: string | null;
  role_name: string | null;
  approved_by_name: string | null;
  /** Who placed the order when it was placed on behalf of the employee. */
  placed_by_name: string | null;
  note: string | null;
  request_reason: string | null;
  reference: string | null;
  cost_center: string | null;
  is_request: boolean;
  ship_to: {
    name: string | null;
    address: string | null;
    postal: string | null;
    city: string | null;
    country: string | null;
    custom: boolean;
  };
  total: number;
  credit_total: number;
  items: {
    id: string;
    product_id: string | null;
    product_name: string;
    variant_label: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
    credit_cost: number;
  }[];
  events: {
    id: string;
    status: string | null;
    note: string | null;
    created_at: string;
    actor_name: string | null;
  }[];
  proofs: { id: string; version: number; file_url: string; status: string; created_at: string }[];
  display: Display;
  can: { approve: boolean; cancel: boolean; reorder: boolean };
};

const num = (v: unknown) => Number(v ?? 0) || 0;
const personName = (p: { full_name: string | null; email: string | null } | undefined) =>
  p ? (p.full_name?.trim() || p.email || null) : null;

/** One order for the overview's side panel; RLS decides whether it is visible. */
export async function getOrderDetail(
  orderId: string,
): Promise<{ ok: true; order: OrderDetail } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Geen toegang" };
  const supabase = await createClient();

  const { data: o } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, decided_at, company_id, ordered_by, ordered_by_name, role_name, approved_by, placed_by, note, request_reason, reference, cost_center, is_request, ship_to_name, ship_to_address, ship_to_postal, ship_to_city, ship_to_country, ship_to_custom, total, credit_total, items:order_items(id, product_id, product_name, variant_label, sku, quantity, unit_price, line_total, credit_cost, created_at)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return { ok: false, error: "Bestelling niet gevonden" };

  const [{ data: events }, { data: proofs }] = await Promise.all([
    supabase
      .from("order_events")
      .select("id, status, note, created_at, actor")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("proofs")
      .select("id, version, file_url, status, created_at")
      .eq("order_id", orderId)
      .order("version", { ascending: false }),
  ]);

  // The order is authorised by RLS above; names and settings via the admin client.
  const admin = createAdminClient();
  const personIds = [
    ...new Set(
      [o.ordered_by, o.approved_by, o.placed_by, ...(events ?? []).map((e) => e.actor)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const [{ data: company }, { data: people }] = await Promise.all([
    admin.from("companies").select("name, settings").eq("id", o.company_id).maybeSingle(),
    admin.from("profiles").select("id, full_name, email").in("id", personIds.length ? personIds : ["-"]),
  ]);
  const byId = new Map(
    (people ?? []).map((p) => [p.id as string, p as { full_name: string | null; email: string | null }]),
  );

  const status = o.status as string;
  const sameCompany = user.companyId === o.company_id;
  const own = o.ordered_by === user.id;
  const display: Display = user.isSuperadmin
    ? "euro"
    : displayFor(
        readOrderingSettings((company?.settings as Record<string, unknown>) ?? {}),
        isMember(user) ? "member" : "manager",
      );

  type RawItem = OrderDetail["items"][number] & { created_at: string };
  const items = ((o.items ?? []) as unknown as RawItem[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((i) => ({
      id: i.id,
      product_id: i.product_id ?? null,
      product_name: i.product_name,
      variant_label: i.variant_label ?? null,
      sku: i.sku ?? null,
      quantity: num(i.quantity),
      unit_price: num(i.unit_price),
      line_total: num(i.line_total),
      credit_cost: num(i.credit_cost),
    }));

  return {
    ok: true,
    order: {
      id: o.id as string,
      order_number: (o.order_number as string | null) ?? null,
      status,
      created_at: o.created_at as string,
      decided_at: (o.decided_at as string | null) ?? null,
      company_id: o.company_id as string,
      company_name: (company?.name as string | null) ?? null,
      ordered_by: o.ordered_by as string,
      ordered_by_name:
        (o.ordered_by_name as string | null) ?? personName(byId.get(o.ordered_by as string)),
      ordered_by_email: byId.get(o.ordered_by as string)?.email ?? null,
      role_name: (o.role_name as string | null) ?? null,
      approved_by_name: o.approved_by ? personName(byId.get(o.approved_by as string)) : null,
      placed_by_name:
        o.placed_by && o.placed_by !== o.ordered_by
          ? personName(byId.get(o.placed_by as string))
          : null,
      note: (o.note as string | null) ?? null,
      request_reason: (o.request_reason as string | null) ?? null,
      reference: (o.reference as string | null) ?? null,
      cost_center: (o.cost_center as string | null) ?? null,
      is_request: !!o.is_request,
      ship_to: {
        name: (o.ship_to_name as string | null) ?? null,
        address: (o.ship_to_address as string | null) ?? null,
        postal: (o.ship_to_postal as string | null) ?? null,
        city: (o.ship_to_city as string | null) ?? null,
        country: (o.ship_to_country as string | null) ?? null,
        custom: !!o.ship_to_custom,
      },
      total: num(o.total),
      credit_total: num(o.credit_total),
      items,
      events: (events ?? []).map((e) => ({
        id: e.id as string,
        status: (e.status as string | null) ?? null,
        note: (e.note as string | null) ?? null,
        created_at: e.created_at as string,
        actor_name: e.actor ? personName(byId.get(e.actor as string)) : null,
      })),
      proofs: (proofs ?? []).map((p) => ({
        id: p.id as string,
        version: num(p.version),
        file_url: p.file_url as string,
        status: p.status as string,
        created_at: p.created_at as string,
      })),
      display,
      can: {
        approve:
          can(user, "orders.approve") &&
          status === "pending_approval" &&
          (user.isSuperadmin || sameCompany),
        cancel: own && can(user, "orders.cancel") && status === "pending_approval",
        reorder: own && sameCompany && can(user, "orders.create"),
      },
    },
  };
}

/** Approve or reject several waiting orders at once. */
export async function decideOrders(
  orderIds: string[],
  decision: "approve" | "reject",
): Promise<{ ok: true; done: number; failed: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || !can(user, "orders.approve")) return { ok: false, error: "Geen toegang" };
  const ids = [...new Set(orderIds)].filter(Boolean);
  if (!ids.length) return { ok: false, error: "Geen bestellingen geselecteerd." };
  if (ids.length > 200) return { ok: false, error: "Maximaal 200 bestellingen tegelijk." };

  let done = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await (decision === "approve" ? approveOrder(id) : rejectOrder(id));
      done++;
    } catch {
      failed++;
    }
  }
  revalidatePath("/orders");
  revalidatePath("/approvals");
  revalidatePath("/admin/bestellingen");
  return { ok: true, done, failed };
}

/**
 * Cart lines to order the same again, priced from the current shop of the
 * signed-in user. Products they can no longer see are skipped.
 */
export async function reorderItems(
  orderId: string,
): Promise<{ ok: true; items: CartItem[]; skipped: string[] } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.create")) return { ok: false, error: "Geen toegang" };
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, company_id, ordered_by, items:order_items(product_id, variant_id, product_name, variant_label, quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.ordered_by !== user.id || order.company_id !== user.companyId)
    return { ok: false, error: "Bestelling niet gevonden" };

  const shop = await buildShop({
    id: user.id,
    companyId: user.companyId,
    roleId: user.roleId,
    permissions: user.permissions,
    kind: isMember(user) ? "member" : "manager",
  });
  const lines = (order.items ?? []) as {
    product_id: string | null;
    variant_id: string | null;
    product_name: string;
    variant_label: string | null;
    quantity: number;
  }[];

  const productIds = [...new Set(lines.map((l) => l.product_id).filter((x): x is string => !!x))];
  const { data: limits } = await createAdminClient()
    .from("products")
    .select("id, max_quantity_per_order")
    .in("id", productIds.length ? productIds : ["-"]);
  const maxOf = new Map(
    (limits ?? []).map((p) => [p.id as string, (p.max_quantity_per_order as number | null) ?? null]),
  );

  const items: CartItem[] = [];
  const skipped: string[] = [];
  for (const l of lines) {
    const label = l.variant_label ? `${l.product_name} (${l.variant_label})` : l.product_name;
    const product = l.product_id ? shop.products.find((p) => p.id === l.product_id) : undefined;
    if (!product) {
      skipped.push(label);
      continue;
    }
    let variant = null as (typeof product.variants)[number] | null;
    if (product.variants.length) {
      variant = product.variants.find((v) => v.id === l.variant_id) ?? null;
      if (!variant) {
        skipped.push(label);
        continue;
      }
    }
    const max = maxOf.get(product.id);
    const qty = Math.max(1, max ? Math.min(l.quantity, max) : l.quantity);
    items.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      variantLabel: variant ? variantLabel(variant.attributes) : null,
      unitPrice: variant?.euro ?? product.euro,
      unitCredits: variant?.credits ?? product.credits,
      image: product.images.find((i) => i.is_primary)?.url ?? product.images[0]?.url ?? null,
      qty,
    });
  }
  return { ok: true, items, skipped };
}

/** Save (or overwrite by name) a filtered overview for the signed-in user. */
export async function saveOrderView(
  scope: string,
  name: string,
  query: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Geen toegang" };
  const clean = name.trim();
  if (!clean || clean.length > 60) return { ok: false, error: "Geef de weergave een naam van maximaal 60 tekens." };
  if (query.length > 2000 || (query !== "" && !query.startsWith("?")))
    return { ok: false, error: "Ongeldige weergave." };
  if (!scope || scope.length > 100) return { ok: false, error: "Ongeldige weergave." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("order_views")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("scope", scope);
  const same = (existing ?? []).find((v) => (v.name as string).toLowerCase() === clean.toLowerCase());
  if (same) {
    const { error } = await supabase.from("order_views").update({ query, name: clean }).eq("id", same.id);
    if (error) return { ok: false, error: "Opslaan is mislukt." };
    return { ok: true, id: same.id as string };
  }
  if ((existing ?? []).length >= 30) return { ok: false, error: "Je kunt maximaal 30 weergaven bewaren." };
  const { data, error } = await supabase
    .from("order_views")
    .insert({ user_id: user.id, scope, name: clean, query })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Opslaan is mislukt." };
  return { ok: true, id: data.id as string };
}

export async function deleteOrderView(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Geen toegang" };
  const supabase = await createClient();
  const { error } = await supabase.from("order_views").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Verwijderen is mislukt." };
  return { ok: true };
}
