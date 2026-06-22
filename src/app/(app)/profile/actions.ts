"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Geen toegang");
  const supabase = await createClient();

  // Size systems → chosen value, stored as { [optionSetId]: value }.
  const { data: sizeSets } = await supabase
    .from("option_sets")
    .select("id")
    .eq("kind", "size");

  const sizes: Record<string, string> = {};
  for (const s of sizeSets ?? []) {
    const v = String(formData.get(`size_${s.id}`) ?? "").trim();
    if (v) sizes[s.id] = v;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      sizes,
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
}
