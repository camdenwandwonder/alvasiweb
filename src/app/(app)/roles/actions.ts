"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

async function requirePerm(perm: string) {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, perm)) throw new Error("Geen toegang");
  return user;
}

export async function createRole(formData: FormData) {
  const user = await requirePerm("roles.manage");
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Naam is verplicht");

  const { data, error } = await supabase
    .from("roles")
    .insert({ company_id: user.companyId, name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/roles");
  redirect(`/roles/${data.id}`);
}

export async function updateRole(id: string, formData: FormData) {
  await requirePerm("roles.manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("roles")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      requires_order_approval: formData.get("requires_order_approval") === "on",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const selected = formData
    .getAll("permissions")
    .map(String)
    .filter((p) => ALL_PERMISSION_KEYS.includes(p));

  await supabase.from("role_permissions").delete().eq("role_id", id);
  if (selected.length) {
    await supabase
      .from("role_permissions")
      .insert(selected.map((permission) => ({ role_id: id, permission })));
  }

  revalidatePath(`/roles/${id}`);
  revalidatePath("/roles");
}

export async function deleteRole(id: string) {
  await requirePerm("roles.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/roles");
  redirect("/roles");
}
