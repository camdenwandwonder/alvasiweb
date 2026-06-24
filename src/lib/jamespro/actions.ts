"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import {
  jamespro,
  jamesproAuth,
  jamesproMe,
  jamesproSearchCompanies,
  jamesproCreateCompany,
  type JamesproCreds,
  type JamesproCompany,
} from "./client";
import { getIntegration, processOrderSync } from "./sync";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) throw new Error("Geen toegang");
}

async function creds(): Promise<JamesproCreds> {
  const i = await getIntegration();
  if (!i?.auth_key || !i?.auth_secret)
    throw new Error("JamesPRO is niet verbonden.");
  return { key: i.auth_key, secret: i.auth_secret };
}

/** Step 1+2: exchange credentials for key/secret and store them. */
export async function connectJamespro(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; user?: string }> {
  await requireSuperadmin();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const deviceType = String(formData.get("device_type") ?? "Alvasi").trim() || "Alvasi";
  try {
    const c = await jamesproAuth(username, password, deviceType);
    const me = await jamesproMe(c);
    const admin = createAdminClient();
    await admin
      .from("integration_jamespro")
      .update({
        auth_key: c.key,
        auth_secret: c.secret,
        device_type: deviceType,
        enabled: true,
        connected_user: { id: me.id, name: me.name },
        last_tested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    revalidatePath("/admin/integrations");
    return { ok: true, user: me.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Verbinden mislukt" };
  }
}

export async function testJamesproConnection(): Promise<{
  ok: boolean;
  error?: string;
  user?: string;
}> {
  await requireSuperadmin();
  try {
    const me = await jamesproMe(await creds());
    const admin = createAdminClient();
    await admin
      .from("integration_jamespro")
      .update({
        connected_user: { id: me.id, name: me.name },
        last_tested_at: new Date().toISOString(),
      })
      .eq("id", 1);
    revalidatePath("/admin/integrations");
    return { ok: true, user: me.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Test mislukt" };
  }
}

/**
 * Best-effort list of assignable JamesPRO users for the assignee picker.
 * JamesPRO has no users endpoint, so we name the connected API user and add any
 * distinct user_ids found on recent projects (labelled by id when unknown).
 */
export async function listJamesproUsers(): Promise<{
  ok: boolean;
  users?: { id: number; name: string }[];
  error?: string;
}> {
  await requireSuperadmin();
  try {
    const c = await creds();
    const me = await jamesproMe(c);
    const map = new Map<number, string>();
    map.set(me.id, me.name);
    try {
      const { body } = await jamespro<{ user_id?: number }[]>(
        c,
        "GET",
        "/projects/?limit=200",
      );
      if (Array.isArray(body)) {
        for (const p of body) {
          const uid = p.user_id;
          if (uid && !map.has(uid)) map.set(uid, `Gebruiker #${uid}`);
        }
      }
    } catch {
      // projects scan is optional
    }
    return {
      ok: true,
      users: [...map.entries()].map(([id, name]) => ({ id, name })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Mislukt" };
  }
}

export async function saveJamesproSettings(formData: FormData) {
  await requireSuperadmin();
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v ? Number(v) : null;
  };
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  const admin = createAdminClient();
  await admin
    .from("integration_jamespro")
    .update({
      enabled: formData.get("enabled") === "on",
      default_user_id: num("default_user_id"),
      project_title_template: str("project_title_template"),
      project_briefing_template: str("project_briefing_template"),
      task_description_template: str("task_description_template"),
      task_note_template: str("task_note_template"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  revalidatePath("/admin/integrations");
}

export async function disconnectJamespro() {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin
    .from("integration_jamespro")
    .update({
      auth_key: null,
      auth_secret: null,
      enabled: false,
      connected_user: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  revalidatePath("/admin/integrations");
}

/** Relation linking (company detail). */
export async function searchJamesproRelations(
  name: string,
): Promise<{ ok: boolean; results?: JamesproCompany[]; error?: string }> {
  await requireSuperadmin();
  if (!name.trim()) return { ok: true, results: [] };
  try {
    const results = await jamesproSearchCompanies(await creds(), name.trim());
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Zoeken mislukt" };
  }
}

export async function linkCompanyRelation(
  companyId: string,
  jamesproCompanyId: number,
) {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin
    .from("companies")
    .update({ jamespro_company_id: jamesproCompanyId })
    .eq("id", companyId);
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function unlinkCompanyRelation(companyId: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin
    .from("companies")
    .update({ jamespro_company_id: null, jamespro_contact_id: null })
    .eq("id", companyId);
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function createAndLinkRelation(
  companyId: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();
  try {
    const relation = await jamesproCreateCompany(await creds(), {
      name: name.trim(),
      client: true,
      idexternal: companyId,
    });
    const admin = createAdminClient();
    await admin
      .from("companies")
      .update({ jamespro_company_id: relation.id })
      .eq("id", companyId);
    revalidatePath(`/admin/companies/${companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Aanmaken mislukt" };
  }
}

/** Manual retry of a single order's sync (from the order detail / log). */
export async function retryOrderSync(orderId: string): Promise<void> {
  await requireSuperadmin();
  await processOrderSync(orderId);
  revalidatePath(`/admin/orders/${orderId}`);
}

/**
 * Test the integration by sending a chosen order to JamesPRO now. Really
 * creates a project + task (so pick a safe test order). Returns the ids.
 */
export async function testSendOrderToJamespro(orderId: string): Promise<{
  ok: boolean;
  error?: string;
  warning?: string;
  projectId?: number;
  taskId?: number;
}> {
  await requireSuperadmin();
  if (!orderId) return { ok: false, error: "Kies eerst een bestelling." };
  const res = await processOrderSync(orderId, { force: true });
  if (!res.ok) return { ok: false, error: res.error };
  const admin = createAdminClient();
  const { data } = await admin
    .from("jamespro_sync")
    .select("jamespro_project_id, jamespro_task_id")
    .eq("order_id", orderId)
    .maybeSingle();
  revalidatePath(`/admin/orders/${orderId}`);
  return {
    ok: true,
    warning: res.warning,
    projectId: data?.jamespro_project_id ?? undefined,
    taskId: data?.jamespro_task_id ?? undefined,
  };
}
