"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

async function decideOrder(orderId: string, status: "approved" | "rejected") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authorized");
  const supabase = await createClient();

  // RLS enforces that only users with `orders.approve` in this company can update.
  const { error } = await supabase
    .from("orders")
    .update({
      status,
      approved_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  revalidatePath("/orders");
}

export async function approveOrder(orderId: string) {
  await decideOrder(orderId, "approved");
}

export async function rejectOrder(orderId: string) {
  await decideOrder(orderId, "rejected");
}
