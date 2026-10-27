"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { logAudit } from "@/lib/company-gate";
import { processOrderSync } from "@/lib/jamespro/sync";

// Approval sends the order straight to production (there is no separate
// "goedgekeurd" stage in the pipeline).
async function decideOrder(orderId: string, status: "in_production" | "rejected") {
  const user = await getCurrentUser();
  if (!user || !can(user, "orders.approve")) throw new Error("Geen toegang");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("company_id, order_number, status")
    .eq("id", orderId)
    .single();
  if (!order) throw new Error("Bestelling niet gevonden");
  if (order.status !== "pending_approval")
    throw new Error("Over deze bestelling is al besloten");

  const { error } = await supabase
    .from("orders")
    .update({
      status,
      approved_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  await supabase.from("order_events").insert({
    order_id: orderId,
    company_id: order.company_id,
    actor: user.id,
    status,
    note:
      status === "in_production" ? "Goedgekeurd, naar productie" : "Afgewezen",
  });
  await logAudit({
    companyId: order.company_id,
    actor: user,
    targetType: "order",
    targetId: orderId,
    action: status === "in_production" ? "approve" : "reject",
    summary: `Bestelling ${order.order_number ?? "zonder nummer"} ${
      status === "in_production" ? "goedgekeurd" : "afgewezen"
    }`,
  });

  // The DB trigger enqueues a JamesPRO sync row when an order is approved;
  // process it right after the response so the project/task appear promptly.
  if (status === "in_production") {
    after(async () => {
      await processOrderSync(orderId);
    });
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/approvals");
}

export async function approveOrder(orderId: string) {
  await decideOrder(orderId, "in_production");
}

export async function rejectOrder(orderId: string) {
  await decideOrder(orderId, "rejected");
}

/**
 * A member cancels their own order while it still awaits approval. Runs with
 * the admin client: members have no direct update rights on orders.
 */
export async function cancelOwnOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.cancel"))
    return { ok: false, error: "Geen toegang" };
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, company_id, ordered_by, status, order_number")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.ordered_by !== user.id || order.company_id !== user.companyId)
    return { ok: false, error: "Bestelling niet gevonden" };
  if (order.status !== "pending_approval")
    return {
      ok: false,
      error: "Alleen bestellingen die nog op goedkeuring wachten kun je annuleren.",
    };

  const { error } = await admin
    .from("orders")
    .update({ status: "cancelled", decided_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending_approval");
  if (error) return { ok: false, error: "Annuleren is mislukt." };

  await admin.from("order_events").insert({
    order_id: orderId,
    company_id: order.company_id,
    actor: user.id,
    status: "cancelled",
    note: "Geannuleerd door besteller",
  });
  await logAudit({
    companyId: order.company_id,
    actor: user,
    targetType: "order",
    targetId: orderId,
    action: "cancel",
    summary: `Bestelling ${order.order_number ?? "zonder nummer"} geannuleerd door besteller`,
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/approvals");
  return { ok: true };
}

export async function decideProof(
  proofId: string,
  decision: "approved" | "changes_requested",
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Geen toegang");
  const supabase = await createClient();

  const { data: proof } = await supabase
    .from("proofs")
    .select("order_id, company_id, version")
    .eq("id", proofId)
    .single();
  if (!proof) throw new Error("Proef niet gevonden");

  const { error } = await supabase
    .from("proofs")
    .update({ status: decision, decided_by: user.id })
    .eq("id", proofId);
  if (error) throw new Error(error.message);

  await supabase.from("order_events").insert({
    order_id: proof.order_id,
    company_id: proof.company_id,
    actor: user.id,
    note:
      decision === "approved"
        ? `Proef v${proof.version} goedgekeurd`
        : `Wijziging gevraagd op proef v${proof.version}`,
  });

  revalidatePath(`/orders/${proof.order_id}`);
}
