"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { slugify } from "@/lib/format";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) throw new Error("Not authorized");
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
  if (!name) throw new Error("Name is required");

  const { data, error } = await admin
    .from("categories")
    .insert({
      name,
      slug: `${slugify(name) || "category"}-${crypto.randomUUID().slice(0, 4)}`,
      description: String(formData.get("description") ?? "").trim() || null,
      default_requires_approval: formData.get("default_requires_approval") === "on",
      default_requires_proof: formData.get("default_requires_proof") === "on",
      default_max_quantity: num(formData.get("default_max_quantity")),
      default_lead_time_days: num(formData.get("default_lead_time_days")),
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

  // Replace the set of applicable option axes.
  const selected = formData.getAll("option_set_ids").map(String);
  await admin.from("category_option_sets").delete().eq("category_id", id);
  if (selected.length) {
    const { data: sets } = await admin
      .from("option_sets")
      .select("id, kind")
      .in("id", selected);
    const rows = (sets ?? []).map((s, i) => ({
      category_id: id,
      option_set_id: s.id,
      axis_role: s.kind === "color" ? "color" : s.kind === "size" ? "size" : "option",
      sort_order: i + 1,
    }));
    if (rows.length) await admin.from("category_option_sets").insert(rows);
  }

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

/* ----------------------------- Option sets ----------------------------- */

export async function createOptionSet(formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  const kind = String(formData.get("kind") ?? "size");

  const { data, error } = await admin
    .from("option_sets")
    .insert({
      name,
      kind: ["size", "color", "text"].includes(kind) ? kind : "size",
      description: String(formData.get("description") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/admin/config/options");
  redirect(`/admin/config/options/${data.id}`);
}

export async function deleteOptionSet(id: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { error } = await admin.from("option_sets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/config/options");
  redirect("/admin/config/options");
}

export async function addOptionValue(optionSetId: string, formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const value = String(formData.get("value") ?? "").trim();
  if (!value) throw new Error("Value is required");

  const { count } = await admin
    .from("option_values")
    .select("*", { count: "exact", head: true })
    .eq("option_set_id", optionSetId);

  const { error } = await admin.from("option_values").insert({
    option_set_id: optionSetId,
    value,
    label: String(formData.get("label") ?? "").trim() || value,
    swatch: String(formData.get("swatch") ?? "").trim() || null,
    sort_order: (count ?? 0) + 1,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/config/options/${optionSetId}`);
}

export async function deleteOptionValue(id: string, optionSetId: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { error } = await admin.from("option_values").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/config/options/${optionSetId}`);
}
