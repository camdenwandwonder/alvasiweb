"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { logAudit } from "@/lib/company-gate";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/profile");
  revalidatePath("/products");
}

/** Save (or clear, with null) one standard size. Applies immediately. */
export async function setMySize(setId: string, value: string | null): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Geen toegang" };
  const supabase = await createClient();

  const [{ data: set }, { data: profile }] = await Promise.all([
    supabase
      .from("option_sets")
      .select("id, kind, values:option_values(value)")
      .eq("id", setId)
      .maybeSingle(),
    supabase.from("profiles").select("sizes").eq("id", user.id).maybeSingle(),
  ]);
  if (!set || set.kind !== "size") return { ok: false, error: "Onbekend maatsysteem." };
  const allowed = ((set.values as { value: string }[] | null) ?? []).map((v) => v.value);
  if (value !== null && !allowed.includes(value)) return { ok: false, error: "Onbekende maat." };

  const sizes = { ...((profile?.sizes as Record<string, string> | null) ?? {}) };
  if (value) sizes[setId] = value;
  else delete sizes[setId];

  const { error } = await supabase.from("profiles").update({ sizes }).eq("id", user.id);
  if (error) return { ok: false, error: "Opslaan mislukt." };
  refresh();
  return { ok: true };
}

/** Change one personal detail (name or phone). */
export async function updatePersonal(field: "full_name" | "phone", value: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Geen toegang" };
  if (field !== "full_name" && field !== "phone") return { ok: false, error: "Onbekend veld." };
  const v = value.trim().slice(0, field === "phone" ? 30 : 120);
  if (field === "full_name" && !v) return { ok: false, error: "Vul je naam in." };
  if (field === "phone" && v && !/^[0-9+()\-\s]{6,30}$/.test(v))
    return { ok: false, error: "Dat lijkt geen telefoonnummer." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ [field]: v || null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Opslaan mislukt." };

  if (user.companyId)
    await logAudit({
      companyId: user.companyId,
      actor: user,
      targetType: "user",
      targetId: user.id,
      action: "profiel",
      summary: field === "full_name" ? `Naam gewijzigd in ${v}.` : "Telefoonnummer gewijzigd.",
    });
  refresh();
  revalidatePath("/", "layout");
  return { ok: true };
}

function dutchPasswordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("should be different")) return "Kies een ander wachtwoord dan je huidige.";
  if (m.includes("at least") || m.includes("too short")) {
    const n = message.match(/(\d+)/)?.[1];
    return `Het wachtwoord is te kort${n ? ` (minimaal ${n} tekens)` : ""}.`;
  }
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked"))
    return "Dit wachtwoord is te zwak of komt voor in bekende datalekken. Kies een ander.";
  if (m.includes("characters") || m.includes("contain"))
    return "Het wachtwoord moet hoofdletters, kleine letters, cijfers en/of tekens bevatten.";
  return "Wachtwoord wijzigen is niet gelukt. Probeer een ander wachtwoord.";
}

/** Change the own password after checking the current one. */
export async function changeMyPassword(current: string, next: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.email) return { ok: false, error: "Geen toegang" };
  if (next.length < 8) return { ok: false, error: "Het nieuwe wachtwoord moet minimaal 8 tekens hebben." };
  if (next === current) return { ok: false, error: "Kies een ander wachtwoord dan je huidige." };

  // Check the current password on a throw-away client so this session is untouched.
  const check = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: signInError } = await check.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (signInError) return { ok: false, error: "Je huidige wachtwoord klopt niet." };
  await check.auth.signOut({ scope: "local" }).catch(() => undefined);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, error: dutchPasswordError(error.message) };

  if (user.companyId)
    await logAudit({
      companyId: user.companyId,
      actor: user,
      targetType: "user",
      targetId: user.id,
      action: "wachtwoord",
      summary: "Eigen wachtwoord gewijzigd.",
    });
  return { ok: true };
}

/** Sign out on every device, then go to the login page. */
export async function signOutEverywhere() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  if (user?.companyId)
    await logAudit({
      companyId: user.companyId,
      actor: user,
      targetType: "user",
      targetId: user.id,
      action: "uitloggen",
      summary: "Overal uitgelogd.",
    });
  redirect("/login");
}
