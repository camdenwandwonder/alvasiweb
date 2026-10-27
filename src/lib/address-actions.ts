"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { companyGate, logAudit } from "@/lib/company-gate";

export type CompanyAddress = {
  id: string;
  company_id: string;
  label: string;
  recipient: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  contact_name: string | null;
  phone: string | null;
  instructions: string | null;
  is_default: boolean;
  sort_order: number;
  archived_at: string | null;
};

export type AddressInput = {
  id?: string;
  label: string;
  recipient: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  contact_name: string;
  phone: string;
  instructions: string;
  is_default: boolean;
};

type Result = { ok: true } | { ok: false; error: string };
const DENIED: Result = { ok: false, error: "Geen toegang" };
const OPEN = ["pending_approval", "approved", "in_production", "shipped"];

function revalidate(companyId: string) {
  revalidatePath("/settings", "layout");
  revalidatePath("/cart");
  revalidatePath(`/admin/companies/${companyId}`);
}

const clean = (v: unknown, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

/** Dutch postcodes are stored as "1234 AB". */
function postcode(v: string): string | null {
  const s = v.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{4}[A-Z]{2}$/.test(s)) return `${s.slice(0, 4)} ${s.slice(4)}`;
  return clean(v, 12);
}

export async function saveAddress(companyId: string, input: AddressInput): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const label = clean(input.label, 60);
  if (!label) return { ok: false, error: "Geef het adres een naam, bijvoorbeeld Hoofdkantoor." };
  if (!clean(input.street, 120) || !clean(input.city, 80))
    return { ok: false, error: "Vul ten minste straat en plaats in." };

  const admin = createAdminClient();
  const row = {
    label,
    recipient: clean(input.recipient, 80),
    street: clean(input.street, 120),
    postal_code: postcode(input.postal_code),
    city: clean(input.city, 80),
    country: clean(input.country, 60),
    contact_name: clean(input.contact_name, 80),
    phone: clean(input.phone, 30),
    instructions: clean(input.instructions, 300),
  };

  if (input.id) {
    const { error } = await admin
      .from("company_addresses")
      .update({ ...row, ...(input.is_default ? { is_default: true } : {}) })
      .eq("id", input.id)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: "Opslaan is mislukt." };
  } else {
    const { count } = await admin
      .from("company_addresses")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("archived_at", null);
    const { error } = await admin.from("company_addresses").insert({
      company_id: companyId,
      ...row,
      // The first address is always the default.
      is_default: input.is_default || (count ?? 0) === 0,
      sort_order: count ?? 0,
    });
    if (error) return { ok: false, error: "Opslaan is mislukt." };
  }
  await logAudit({
    companyId,
    actor,
    targetType: "address",
    targetId: input.id ?? null,
    action: input.id ? "bewerkt" : "toegevoegd",
    summary: `Leveradres ${label} ${input.id ? "bewerkt" : "toegevoegd"}.`,
  });
  revalidate(companyId);
  return { ok: true };
}

export async function setDefaultAddress(companyId: string, addressId: string): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  // A database trigger keeps exactly one default per company.
  const { data, error } = await admin
    .from("company_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .select("label")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Dat is niet gelukt." };
  await logAudit({
    companyId,
    actor,
    targetType: "address",
    targetId: addressId,
    action: "standaard",
    summary: `${data.label} is nu het standaard leveradres.`,
  });
  revalidate(companyId);
  return { ok: true };
}

/** Open orders that still deliver to this address (matched on street + city). */
export async function openOrdersForAddress(companyId: string, addressId: string): Promise<number> {
  if (!(await companyGate(companyId, "settings.manage"))) return 0;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("company_addresses")
    .select("street, city")
    .eq("id", addressId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!a?.street || !a.city) return 0;
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", OPEN)
    .eq("ship_to_address", a.street)
    .eq("ship_to_city", a.city);
  return count ?? 0;
}

export async function archiveAddress(companyId: string, addressId: string): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("company_addresses")
    .select("label, is_default")
    .eq("id", addressId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!a) return { ok: false, error: "Adres niet gevonden." };
  if (a.is_default)
    return { ok: false, error: "Maak eerst een ander adres standaard voordat je dit adres archiveert." };
  const { error } = await admin
    .from("company_addresses")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", addressId)
    .eq("company_id", companyId);
  if (error) return { ok: false, error: "Archiveren is mislukt." };
  await logAudit({
    companyId,
    actor,
    targetType: "address",
    targetId: addressId,
    action: "gearchiveerd",
    summary: `Leveradres ${a.label} gearchiveerd.`,
  });
  revalidate(companyId);
  return { ok: true };
}

export async function restoreAddress(companyId: string, addressId: string): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const { data, error } = await createAdminClient()
    .from("company_addresses")
    .update({ archived_at: null })
    .eq("id", addressId)
    .eq("company_id", companyId)
    .select("label")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Terugzetten is mislukt." };
  await logAudit({
    companyId,
    actor,
    targetType: "address",
    targetId: addressId,
    action: "teruggezet",
    summary: `Leveradres ${data.label} teruggezet.`,
  });
  revalidate(companyId);
  return { ok: true };
}
