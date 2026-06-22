"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

export async function updateBranding(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "settings.manage"))
    throw new Error("Geen toegang");
  const supabase = await createClient();

  const update: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    primary_color: String(formData.get("primary_color") || "#0f172a"),
    secondary_color: String(formData.get("secondary_color") || "#6366f1"),
  };
  const logo = String(formData.get("logo_url") ?? "").trim();
  if (logo) update.logo_url = logo;

  const { error } = await supabase
    .from("companies")
    .update(update)
    .eq("id", user.companyId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
