"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

/** Set a user's standard sizes (manager with users.update, or superadmin). */
export async function setUserSizes(userId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Geen toegang");
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!target) throw new Error("Gebruiker niet gevonden");

  const allowed =
    user.isSuperadmin ||
    (user.companyId === target.company_id && can(user, "users.update"));
  if (!allowed) throw new Error("Geen toegang");

  const { data: sizeSets } = await admin
    .from("option_sets")
    .select("id")
    .eq("kind", "size");
  const sizes: Record<string, string> = {};
  for (const s of sizeSets ?? []) {
    const v = String(formData.get(`size_${s.id}`) ?? "").trim();
    if (v) sizes[s.id] = v;
  }

  await admin.from("profiles").update({ sizes }).eq("id", userId);
  revalidatePath("/personeel");
  if (target.company_id)
    revalidatePath(`/admin/companies/${target.company_id}`);
}
