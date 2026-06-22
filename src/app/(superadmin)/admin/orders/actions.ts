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

  // Proof gating: products that require a proof must have an approved proof
  // before production can start.
  if (status === "in_production") {
    const { data: items } = await admin
      .from("order_items")
      .select(
        "product:products(requires_proof, category:categories(default_requires_proof))",
      )
      .eq("order_id", orderId);
    const needsProof = (items ?? []).some((it) => {
      const p = it.product as unknown as {
        requires_proof: boolean | null;
        category: { default_requires_proof: boolean } | null;
      } | null;
      return p?.requires_proof ?? p?.category?.default_requires_proof ?? false;
    });
    if (needsProof) {
      const { count } = await admin
        .from("proofs")
        .select("*", { count: "exact", head: true })
        .eq("order_id", orderId)
        .eq("status", "approved");
      if (!count)
        throw new Error(
          "Eerst een goedgekeurde proef vereist voor dit product.",
        );
    }
  }

  await admin.from("orders").update({ status }).eq("id", orderId);
  await logEvent(admin, orderId, order.company_id, user.id, status, null);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
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
