"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { slugify } from "@/lib/format";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) throw new Error("Not authorized");
  return user;
}

export async function createCompany(formData: FormData) {
  const user = await requireSuperadmin();

  const name = String(formData.get("name") ?? "").trim();
  const primary = String(formData.get("primary_color") || "#0f172a");
  const secondary = String(formData.get("secondary_color") || "#6366f1");
  const logo = String(formData.get("logo_url") ?? "").trim();
  if (!name) throw new Error("Company name is required");

  const admin = createAdminClient();
  const slug = `${slugify(name) || "company"}-${crypto
    .randomUUID()
    .slice(0, 5)}`;

  const { data, error } = await admin
    .from("companies")
    .insert({
      name,
      slug,
      primary_color: primary,
      secondary_color: secondary,
      logo_url: logo || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${data.id}`);
}
