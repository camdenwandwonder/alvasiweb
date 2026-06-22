"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) throw new Error("Geen toegang");
  return user;
}

async function logEvent(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  companyId: string,
  actor: string,
  status: string | null,
  note: string | null,
) {
  await admin.from("order_events").insert({
    order_id: orderId,
    company_id: companyId,
    actor,
    status,
    note,
  });
}

export async function advanceOrderStatus(orderId: string, status: string) {
  const user = await requireSuperadmin();
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, company_id")
    .eq("id", orderId)
    .single();
  if (!order) throw new Error("Bestelling niet gevonden");

  await admin.from("orders").update({ status }).eq("id", orderId);
  await logEvent(admin, orderId, order.company_id, user.id, status, null);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

/**
 * Move an order to a new status (used by the production board drag & drop and
 * list view). Returns a result instead of throwing so the board can revert an
 * optimistic move and show the reason (e.g. proof gating).
 */
export async function moveOrderStatus(
  orderId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireSuperadmin();
    const admin = createAdminClient();

    const { data: order } = await admin
      .from("orders")
      .select("id, company_id")
      .eq("id", orderId)
      .single();
    if (!order) return { ok: false, error: "Bestelling niet gevonden" };

    await admin.from("orders").update({ status }).eq("id", orderId);
    await logEvent(admin, orderId, order.company_id, user.id, status, null);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Mislukt" };
  }
}

/** Toggle the personal production check-off on a single order line. */
export async function toggleOrderItemChecked(
  itemId: string,
  checked: boolean,
): Promise<{ ok: boolean }> {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin.from("order_items").update({ checked }).eq("id", itemId);
  return { ok: true };
}

export async function addProof(
  orderId: string,
  companyId: string,
  formData: FormData,
) {
  const user = await requireSuperadmin();
  const admin = createAdminClient();
  const url = String(formData.get("file_url") ?? "").trim();
  if (!url) throw new Error("Upload eerst een bestand");

  const { count } = await admin
    .from("proofs")
    .select("*", { count: "exact", head: true })
    .eq("order_id", orderId);

  const { error } = await admin.from("proofs").insert({
    order_id: orderId,
    company_id: companyId,
    version: (count ?? 0) + 1,
    file_url: url,
    status: "pending",
    uploaded_by: user.id,
  });
  if (error) throw new Error(error.message);
  await logEvent(
    admin,
    orderId,
    companyId,
    user.id,
    null,
    `Proef v${(count ?? 0) + 1} toegevoegd`,
  );

  revalidatePath(`/admin/orders/${orderId}`);
}
