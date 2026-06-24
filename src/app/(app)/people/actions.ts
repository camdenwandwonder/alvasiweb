"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

async function requirePerm(perm: string) {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, perm)) throw new Error("Geen toegang");
  return user;
}

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
  revalidatePath("/people");
  if (target.company_id)
    revalidatePath(`/admin/companies/${target.company_id}`);
}

export async function createUser(formData: FormData) {
  const user = await requirePerm("users.invite");
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const roleId = String(formData.get("role_id") ?? "");
  if (!email || !password || !roleId)
    throw new Error("E-mail, wachtwoord en rol zijn verplicht");

  // Role must belong to this company.
  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!role) throw new Error("Ongeldige rol");

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(error.message);

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    company_id: user.companyId,
    role_id: roleId,
    full_name: fullName,
    email,
    status: "active",
    is_superadmin: false,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(pErr.message);
  }
  revalidatePath("/people");
}

export async function updateUserRole(profileId: string, formData: FormData) {
  const user = await requirePerm("users.update");
  const admin = createAdminClient();
  const roleId = String(formData.get("role_id") ?? "");

  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("company_id", user.companyId)
    .maybeSingle();
  if (!role) throw new Error("Ongeldige rol");

  await admin
    .from("profiles")
    .update({ role_id: roleId })
    .eq("id", profileId)
    .eq("company_id", user.companyId);
  revalidatePath("/people");
}

export async function setUserStatus(profileId: string, status: string) {
  const user = await requirePerm("users.update");
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ status })
    .eq("id", profileId)
    .eq("company_id", user.companyId);
  revalidatePath("/people");
}
