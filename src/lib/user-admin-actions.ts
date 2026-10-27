"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

type Result = { ok: true } | { ok: false; error: string };

const MIN_PASSWORD = 8;
// Supabase bans are durations; ~100 years effectively means "until reactivated".
const BAN_FOREVER = "876000h";

/** Superadmin, or a member of this company holding the given permission. */
async function gate(companyId: string, permission: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isSuperadmin) return user;
  if (user.companyId === companyId && can(user, permission)) return user;
  return null;
}

/** Loads a company user; refuses superadmin accounts and unknown ids. */
async function loadTarget(userId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, company_id, is_superadmin, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.is_superadmin || !data.company_id) return null;
  return data as { id: string; company_id: string; email: string | null };
}

async function roleBelongsTo(roleId: string, companyId: string) {
  const { data } = await createAdminClient()
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("company_id", companyId)
    .maybeSingle();
  return !!data;
}

function refresh(companyId: string) {
  revalidatePath("/people");
  revalidatePath(`/admin/companies/${companyId}`);
}

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function createCompanyUser(
  companyId: string,
  fd: FormData,
): Promise<Result> {
  if (!(await gate(companyId, "users.invite")))
    return { ok: false, error: "Geen toegang" };

  const email = text(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const fullName = text(fd, "full_name") || null;
  const roleId = text(fd, "role_id");
  if (!email || !roleId)
    return { ok: false, error: "E-mailadres en rol zijn verplicht." };
  if (password.length < MIN_PASSWORD)
    return {
      ok: false,
      error: `Het wachtwoord moet minimaal ${MIN_PASSWORD} tekens hebben.`,
    };
  if (!(await roleBelongsTo(roleId, companyId)))
    return { ok: false, error: "Ongeldige rol." };

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user)
    return {
      ok: false,
      error: error?.message.includes("already")
        ? "Er bestaat al een account met dit e-mailadres."
        : (error?.message ?? "Aanmaken mislukt."),
    };

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
    company_id: companyId,
    role_id: roleId,
    full_name: fullName,
    email,
    status: "active",
    is_superadmin: false,
  });
  if (pErr) {
    // Don't leave a login without a profile behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: pErr.message };
  }

  refresh(companyId);
  return { ok: true };
}

export async function updateCompanyUser(
  userId: string,
  fd: FormData,
): Promise<Result> {
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "Gebruiker niet gevonden." };
  const actor = await gate(target.company_id, "users.update");
  if (!actor) return { ok: false, error: "Geen toegang" };

  const fullName = text(fd, "full_name") || null;
  const email = text(fd, "email").toLowerCase();
  const roleId = text(fd, "role_id");
  const status = text(fd, "status") === "disabled" ? "disabled" : "active";

  if (!email) return { ok: false, error: "E-mailadres is verplicht." };
  if (!roleId || !(await roleBelongsTo(roleId, target.company_id)))
    return { ok: false, error: "Ongeldige rol." };
  if (actor.id === userId && status === "disabled")
    return { ok: false, error: "Je kunt je eigen account niet deactiveren." };

  const admin = createAdminClient();

  // Login identity: e-mail change + (de)activation via an auth ban, so a
  // deactivated user can really no longer sign in.
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    ...(email !== target.email ? { email, email_confirm: true } : {}),
    ban_duration: status === "disabled" ? BAN_FOREVER : "none",
    user_metadata: { full_name: fullName },
  });
  if (authErr)
    return {
      ok: false,
      error: authErr.message.includes("already")
        ? "Dit e-mailadres is al in gebruik."
        : authErr.message,
    };

  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, email, role_id: roleId, status })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  refresh(target.company_id);
  return { ok: true };
}

export async function setCompanyUserPassword(
  userId: string,
  fd: FormData,
): Promise<Result> {
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "Gebruiker niet gevonden." };
  if (!(await gate(target.company_id, "users.update")))
    return { ok: false, error: "Geen toegang" };

  const password = String(fd.get("password") ?? "");
  if (password.length < MIN_PASSWORD)
    return {
      ok: false,
      error: `Het wachtwoord moet minimaal ${MIN_PASSWORD} tekens hebben.`,
    };

  const { error } = await createAdminClient().auth.admin.updateUserById(
    userId,
    { password },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCompanyUser(userId: string): Promise<Result> {
  const target = await loadTarget(userId);
  if (!target) return { ok: false, error: "Gebruiker niet gevonden." };
  const actor = await gate(target.company_id, "users.remove");
  if (!actor) return { ok: false, error: "Geen toegang" };
  if (actor.id === userId)
    return { ok: false, error: "Je kunt je eigen account niet verwijderen." };

  const admin = createAdminClient();

  // Orders keep a hard reference to whoever placed them; removing that user
  // would destroy order history, so steer towards deactivating instead.
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("ordered_by", userId);
  if (count && count > 0)
    return {
      ok: false,
      error: `Deze gebruiker heeft ${count} bestelling${count === 1 ? "" : "en"} geplaatst. Deactiveer de gebruiker in plaats van verwijderen, zodat de bestelgeschiedenis bewaard blijft.`,
    };

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error)
    return {
      ok: false,
      error:
        "Verwijderen is niet gelukt omdat er nog gegevens aan deze gebruiker gekoppeld zijn. Deactiveer de gebruiker in plaats daarvan.",
    };

  refresh(target.company_id);
  return { ok: true };
}
