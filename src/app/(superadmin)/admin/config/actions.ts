"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { slugify } from "@/lib/format";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) throw new Error("Geen toegang");
}

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ----------------------------- Categories ----------------------------- */

export async function createCategory(formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Naam is verplicht");

  const { data, error } = await admin
    .from("categories")
    .insert({
      name,
      slug: `${slugify(name) || "category"}-${crypto.randomUUID().slice(0, 4)}`,
      description: String(formData.get("description") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/admin/config/categories");
  redirect(`/admin/config/categories/${data.id}`);
}

export async function updateCategory(id: string, formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("categories")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      active: formData.get("active") === "on",
      default_requires_approval: formData.get("default_requires_approval") === "on",
      default_requires_proof: formData.get("default_requires_proof") === "on",
      default_max_quantity: num(formData.get("default_max_quantity")),
      default_lead_time_days: num(formData.get("default_lead_time_days")),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/config/categories/${id}`);
  revalidatePath("/admin/config/categories");
}

export async function deleteCategory(id: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/config/categories");
  redirect("/admin/config/categories");
}

/* ------------------ Option axes (lived inside a category) ------------------ */

export async function addAxis(categoryId: string, formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "size");
  const kind = ["size", "color", "text"].includes(kindRaw) ? kindRaw : "size";
  if (!name) throw new Error("Naam is verplicht");

  const { data: set, error } = await admin
    .from("option_sets")
    .insert({ name, kind })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { count } = await admin
    .from("category_option_sets")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId);

  await admin.from("category_option_sets").insert({
    category_id: categoryId,
    option_set_id: set.id,
    axis_role: kind === "color" ? "color" : kind === "size" ? "size" : "option",
    sort_order: (count ?? 0) + 1,
  });

  revalidatePath(`/admin/config/categories/${categoryId}`);
}

export async function removeAxis(categoryId: string, optionSetId: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  // Deleting the option set also removes its link + values (cascade).
  await admin.from("option_sets").delete().eq("id", optionSetId);
  revalidatePath(`/admin/config/categories/${categoryId}`);
}

export async function addAxisValue(
  categoryId: string,
  optionSetId: string,
  formData: FormData,
) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const value = String(formData.get("value") ?? "").trim();
  if (!value) throw new Error("Waarde is verplicht");

  const { count } = await admin
    .from("option_values")
    .select("*", { count: "exact", head: true })
    .eq("option_set_id", optionSetId);

  await admin.from("option_values").insert({
    option_set_id: optionSetId,
    value,
    label: String(formData.get("label") ?? "").trim() || value,
    swatch: String(formData.get("swatch") ?? "").trim() || null,
    sort_order: (count ?? 0) + 1,
  });
  revalidatePath(`/admin/config/categories/${categoryId}`);
}

export async function removeAxisValue(categoryId: string, valueId: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin.from("option_values").delete().eq("id", valueId);
  revalidatePath(`/admin/config/categories/${categoryId}`);
}
