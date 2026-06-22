"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

async function decideOrder(orderId: string, status: "approved" | "rejected") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Geen toegang");
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("company_id")
    .eq("id", orderId)
    .single();

  const { error } = await supabase
    .from("orders")
    .update({
      status,
      approved_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  if (order) {
    await supabase.from("order_events").insert({
      order_id: orderId,
      company_id: order.company_id,
      actor: user.id,
      status,
      note: status === "approved" ? "Goedgekeurd" : "Afgewezen",
    });
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/approvals");
}

export async function approveOrder(orderId: string) {
  await decideOrder(orderId, "approved");
}

export async function rejectOrder(orderId: string) {
  await decideOrder(orderId, "rejected");
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
