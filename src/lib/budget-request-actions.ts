"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { getAllowance } from "@/lib/allowance";
import { companyGate, logAudit } from "@/lib/company-gate";
import { formatAmount } from "@/lib/ordering";
import { sendEmail } from "@/lib/email";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/approvals");
  revalidatePath("/products");
  revalidatePath("/personeel");
}

/** E-mail addresses of active company users whose functie may approve. */
async function approverEmails(companyId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: perms } = await admin
    .from("role_permissions")
    .select("role_id, role:roles!inner(company_id)")
    .eq("permission", "orders.approve")
    .eq("role.company_id", companyId);
  const roleIds = [...new Set((perms ?? []).map((p) => p.role_id as string))];
  if (!roleIds.length) return [];
  const { data: people } = await admin
    .from("profiles")
    .select("email")
    .eq("company_id", companyId)
    .eq("status", "active")
    .in("role_id", roleIds);
  return (people ?? []).map((p) => p.email as string | null).filter((e): e is string => !!e);
}

export async function requestExtraBudget(fd: FormData): Promise<Result> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.create"))
    return { ok: false, error: "Geen toegang" };

  const { settings, allowance } = await getAllowance(user);
  if (settings.payment === "none" || !allowance.budget)
    return { ok: false, error: "Voor jou geldt geen budget, dus extra budget is niet nodig." };

  const amount = Number(String(fd.get("amount") ?? "").replace(",", "."));
  const reason = String(fd.get("reason") ?? "").trim();
  if (!(amount > 0)) return { ok: false, error: "Vul een bedrag groter dan 0 in." };
  if (!reason) return { ok: false, error: "Geef een reden op voor je aanvraag." };

  const admin = createAdminClient();
  const { count } = await admin
    .from("budget_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (count && count > 0)
    return { ok: false, error: "Je hebt al een openstaande aanvraag. Wacht op het besluit." };

  const unit = settings.payment === "credits" ? "credits" : "euro";
  const value = unit === "credits" ? Math.ceil(amount) : Math.round(amount * 100) / 100;
  const { data: row, error } = await admin
    .from("budget_requests")
    .insert({
      company_id: user.companyId,
      user_id: user.id,
      kind: "request",
      unit,
      amount: value,
      reason,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: "Aanvraag indienen is mislukt." };

  const name = user.fullName ?? user.email ?? "Een medewerker";
  const label = formatAmount(value, settings.payment);
  await logAudit({
    companyId: user.companyId,
    actor: user,
    targetType: "budget_request",
    targetId: row.id,
    action: "request",
    summary: `${name} vroeg ${label} extra budget aan: ${reason}`,
  });

  for (const to of await approverEmails(user.companyId)) {
    await sendEmail({
      to,
      subject: `Budgetaanvraag van ${name}`,
      html: `<p>${name} vraagt <strong>${label}</strong> extra budget aan.</p>
        <p>Reden: ${reason}</p>
        <p>Beoordeel de aanvraag onder Goedkeuringen in het bestelportaal.</p>`,
    });
  }

  refresh();
  return { ok: true };
}

export async function decideBudgetRequest(
  id: string,
  approve: boolean,
  note?: string,
): Promise<Result> {
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("budget_requests")
    .select("id, company_id, user_id, unit, amount, status, reason")
    .eq("id", id)
    .maybeSingle();
  if (!req) return { ok: false, error: "Aanvraag niet gevonden." };

  const actor = await companyGate(req.company_id, "orders.approve");
  if (!actor) return { ok: false, error: "Geen toegang" };
  if (req.status !== "pending")
    return { ok: false, error: "Over deze aanvraag is al besloten." };
  if (actor.id === req.user_id)
    return { ok: false, error: "Je kunt je eigen aanvraag niet beoordelen." };

  const { error } = await admin
    .from("budget_requests")
    .update({
      status: approve ? "approved" : "declined",
      decided_by: actor.id,
      decided_at: new Date().toISOString(),
      decision_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: "Opslaan is mislukt." };

  const { data: person } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", req.user_id)
    .maybeSingle();
  const label = formatAmount(Number(req.amount), req.unit === "credits" ? "credits" : "euro");
  const who = person?.full_name ?? person?.email ?? "medewerker";

  await logAudit({
    companyId: req.company_id,
    actor,
    targetType: "budget_request",
    targetId: req.user_id,
    action: approve ? "approve" : "decline",
    summary: `${approve ? "Goedgekeurd" : "Afgewezen"}: ${label} extra budget voor ${who}`,
  });

  if (person?.email) {
    await sendEmail({
      to: person.email,
      subject: approve ? "Je budgetaanvraag is goedgekeurd" : "Je budgetaanvraag is afgewezen",
      html: approve
        ? `<p>Je aanvraag voor <strong>${label}</strong> extra budget is goedgekeurd. Het bedrag is direct beschikbaar in de winkel.</p>`
        : `<p>Je aanvraag voor <strong>${label}</strong> extra budget is afgewezen.${
            note?.trim() ? `</p><p>Toelichting: ${note.trim()}` : ""
          }</p>`,
    });
  }

  refresh();
  return { ok: true };
}
