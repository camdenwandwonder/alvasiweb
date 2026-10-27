"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { companyGate, logAudit } from "@/lib/company-gate";
import { normalizeHex } from "@/lib/contrast";
import { writeOrderPrefs, type OrderPrefs, type ReferenceMode } from "@/lib/company-prefs";

type Result = { ok: true } | { ok: false; error: string };
const DENIED: Result = { ok: false, error: "Geen toegang" };

function refresh(companyId: string) {
  revalidatePath("/settings", "layout");
  revalidatePath("/", "layout");
  revalidatePath(`/admin/companies/${companyId}`);
}

const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

export async function saveCompanyGeneral(
  companyId: string,
  input: {
    name: string;
    short_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
  },
): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const name = clean(input.name, 80);
  if (!name) return { ok: false, error: "Geef het bedrijf een naam." };
  const email = clean(input.contact_email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "Dat e-mailadres lijkt niet te kloppen." };
  const { error } = await createAdminClient()
    .from("companies")
    .update({
      name,
      short_name: clean(input.short_name, 30),
      contact_name: clean(input.contact_name, 80),
      contact_email: email,
      contact_phone: clean(input.contact_phone, 30),
    })
    .eq("id", companyId);
  if (error) return { ok: false, error: "Opslaan is mislukt." };
  await logAudit({
    companyId,
    actor,
    targetType: "settings",
    action: "algemeen",
    summary: "Bedrijfsgegevens bijgewerkt.",
  });
  refresh(companyId);
  return { ok: true };
}

export async function saveOrderPreferences(companyId: string, prefs: OrderPrefs): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data: company } = await admin.from("companies").select("settings").eq("id", companyId).maybeSingle();
  const current = (company?.settings as Record<string, unknown>) ?? {};
  const mode = (m: ReferenceMode): ReferenceMode => (["off", "ask", "required"].includes(m) ? m : "off");
  const costCenters = [...new Set(prefs.costCenters.map((c) => c.trim().slice(0, 60)).filter(Boolean))].slice(0, 100);
  const next: OrderPrefs = {
    reference: mode(prefs.reference),
    referenceLabel: prefs.referenceLabel.trim().slice(0, 40) || "Bestelreferentie",
    costCenter: costCenters.length ? mode(prefs.costCenter) : "off",
    costCenters,
  };
  const { error } = await admin
    .from("companies")
    .update({ settings: { ...current, ...writeOrderPrefs(next) } })
    .eq("id", companyId);
  if (error) return { ok: false, error: "Opslaan is mislukt." };
  const label = (m: ReferenceMode) => (m === "off" ? "uit" : m === "ask" ? "vragen" : "verplicht");
  await logAudit({
    companyId,
    actor,
    targetType: "settings",
    action: "bestelvoorkeuren",
    summary: `Bestelvoorkeuren: ${next.referenceLabel} ${label(next.reference)}, kostenplaats ${label(next.costCenter)}${
      next.costCenters.length ? ` (${next.costCenters.length})` : ""
    }.`,
  });
  refresh(companyId);
  return { ok: true };
}

export async function saveBranding(
  companyId: string,
  input: { logo_url: string; logo_icon_url: string; primary_color: string; secondary_color: string },
): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const primary = normalizeHex(input.primary_color);
  const secondary = normalizeHex(input.secondary_color);
  if (!primary || !secondary) return { ok: false, error: "Gebruik een geldige kleurcode, bijvoorbeeld #1F2A44." };
  const url = (v: string) => (v && /^https:\/\//.test(v) ? v.slice(0, 500) : null);
  const { error } = await createAdminClient()
    .from("companies")
    .update({
      logo_url: url(input.logo_url),
      logo_icon_url: url(input.logo_icon_url),
      primary_color: primary,
      secondary_color: secondary,
    })
    .eq("id", companyId);
  if (error) return { ok: false, error: "Opslaan is mislukt." };
  await logAudit({
    companyId,
    actor,
    targetType: "settings",
    action: "huisstijl",
    summary: `Huisstijl bijgewerkt (kleuren ${primary} en ${secondary}).`,
  });
  refresh(companyId);
  return { ok: true };
}

export async function saveStartPage(
  companyId: string,
  input: {
    welcome_text: string;
    announcement_text: string;
    announcement_from: string;
    announcement_until: string;
  },
): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = day(input.announcement_from);
  const until = day(input.announcement_until);
  if (from && until && until < from)
    return { ok: false, error: "De einddatum ligt vóór de begindatum." };
  const { error } = await createAdminClient()
    .from("companies")
    .update({
      welcome_text: clean(input.welcome_text, 140),
      announcement_text: clean(input.announcement_text, 160),
      announcement_from: from,
      announcement_until: until,
    })
    .eq("id", companyId);
  if (error) return { ok: false, error: "Opslaan is mislukt." };
  await logAudit({
    companyId,
    actor,
    targetType: "settings",
    action: "startpagina",
    summary: "Welkomsttekst en mededeling bijgewerkt.",
  });
  refresh(companyId);
  return { ok: true };
}

export async function addStartImage(companyId: string, url: string): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  if (!/^https:\/\//.test(url)) return { ok: false, error: "Ongeldige afbeelding." };
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("company_media")
    .select("sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin
    .from("company_media")
    .insert({ company_id: companyId, url, sort_order: Number(last?.sort_order ?? 0) + 1 });
  if (error) return { ok: false, error: "Toevoegen is mislukt." };
  await logAudit({ companyId, actor, targetType: "settings", action: "sfeerbeeld", summary: "Sfeerbeeld toegevoegd." });
  refresh(companyId);
  return { ok: true };
}

export async function removeStartImage(companyId: string, id: string): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const { error } = await createAdminClient()
    .from("company_media")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) return { ok: false, error: "Verwijderen is mislukt." };
  await logAudit({ companyId, actor, targetType: "settings", action: "sfeerbeeld", summary: "Sfeerbeeld verwijderd." });
  refresh(companyId);
  return { ok: true };
}

/** Moves one image up or down by swapping sort order with its neighbour. */
export async function moveStartImage(companyId: string, id: string, direction: -1 | 1): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data } = await admin
    .from("company_media")
    .select("id, sort_order")
    .eq("company_id", companyId)
    .order("sort_order")
    .order("created_at");
  const list = (data ?? []).map((m, i) => ({ id: m.id as string, sort: i }));
  const idx = list.findIndex((m) => m.id === id);
  const other = idx + direction;
  if (idx < 0 || other < 0 || other >= list.length) return { ok: true };
  [list[idx]!.sort, list[other]!.sort] = [list[other]!.sort, list[idx]!.sort];
  for (const m of list)
    await admin.from("company_media").update({ sort_order: m.sort }).eq("id", m.id).eq("company_id", companyId);
  refresh(companyId);
  return { ok: true };
}

/** Alvasi fills in its own contact person for the company. */
export async function saveAlvasiContact(
  companyId: string,
  input: { name: string; email: string; phone: string },
): Promise<Result> {
  const actor = await companyGate(companyId, "__superadmin_only__");
  if (!actor?.isSuperadmin) return DENIED;
  const { error } = await createAdminClient()
    .from("companies")
    .update({
      alvasi_contact_name: clean(input.name, 80),
      alvasi_contact_email: clean(input.email, 120),
      alvasi_contact_phone: clean(input.phone, 30),
    })
    .eq("id", companyId);
  if (error) return { ok: false, error: "Opslaan is mislukt." };
  await logAudit({
    companyId,
    actor,
    targetType: "settings",
    action: "contact_alvasi",
    summary: "Contactpersoon bij Alvasi bijgewerkt.",
  });
  refresh(companyId);
  return { ok: true };
}

export type SettingsHistoryEntry = {
  id: string;
  actor_name: string | null;
  summary: string;
  target_type: string;
  created_at: string;
};

export async function loadSettingsHistory(
  companyId: string,
  offset: number,
): Promise<{ ok: true; entries: SettingsHistoryEntry[]; more: boolean } | { ok: false; error: string }> {
  if (!(await companyGate(companyId, "settings.manage"))) return { ok: false, error: "Geen toegang" };
  const size = 30;
  const { data } = await createAdminClient()
    .from("audit_log")
    .select("id, actor_name, summary, target_type, created_at")
    .eq("company_id", companyId)
    .in("target_type", ["settings", "address", "company"])
    .order("created_at", { ascending: false })
    .range(offset, offset + size);
  const rows = (data ?? []) as SettingsHistoryEntry[];
  return { ok: true, entries: rows.slice(0, size), more: rows.length > size };
}

