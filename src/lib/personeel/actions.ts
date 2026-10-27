"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/user";
import { companyGate, logAudit } from "@/lib/company-gate";
import {
  creditsFor,
  formatAmount,
  PERIOD_LABEL,
  readOrderingSettings,
  type PaymentMode,
  type Period,
} from "@/lib/ordering";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_REQUIRES,
  seesFullCatalogue,
} from "@/lib/permissions";
import { applyRoleCategories } from "@/lib/personeel/visibility";

type Result = { ok: true } | { ok: false; error: string };
const DENIED: { ok: false; error: string } = { ok: false, error: "Geen toegang" };
const PERIODS: Period[] = ["monthly", "quarterly", "yearly", "once"];

function refresh(companyId: string) {
  revalidatePath("/personeel");
  revalidatePath("/products");
  revalidatePath("/approvals");
  revalidatePath(`/admin/companies/${companyId}`);
}

function validPeriod(p: string): Period {
  return (PERIODS as string[]).includes(p) ? (p as Period) : "yearly";
}

/* ------------------------------------------------------------------ */
/* Bestelregels                                                        */
/* ------------------------------------------------------------------ */

export type OrderingInput = {
  payment: PaymentMode;
  creditRate: number;
  capsEnabled: boolean;
  uncapped: "free" | "blocked";
  showPriceWithCaps: boolean;
  approvalOver: number | null;
};

/** Freeze credit prices of all non-manual products/variants at `rate`. */
async function freezeCredits(companyId: string, rate: number, productIds?: string[]) {
  const admin = createAdminClient();
  let q = admin
    .from("products")
    .select(
      "id, base_price, credit_cost_manual, variants:product_variants(id, price_override)",
    )
    .eq("company_id", companyId);
  if (productIds) q = q.in("id", productIds.length ? productIds : ["-"]);
  const { data } = await q;
  for (const p of data ?? []) {
    if (p.credit_cost_manual) continue;
    await admin
      .from("products")
      .update({ credit_cost: creditsFor(Number(p.base_price ?? 0), rate) })
      .eq("id", p.id);
    for (const v of (p.variants as { id: string; price_override: number | null }[]) ?? []) {
      await admin
        .from("product_variants")
        .update({
          credit_cost:
            v.price_override != null ? creditsFor(Number(v.price_override), rate) : null,
        })
        .eq("id", v.id);
    }
  }
}

export async function saveOrderingSettings(
  companyId: string,
  input: OrderingInput,
): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;

  const rate = Number(input.creditRate);
  if (input.payment === "credits" && !(rate > 0))
    return { ok: false, error: "Vul een geldige creditkoers in (groter dan € 0)." };
  if (input.approvalOver != null && !(input.approvalOver >= 0))
    return { ok: false, error: "De goedkeuringsdrempel moet 0 of hoger zijn." };

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();
  const raw = (company?.settings as Record<string, unknown>) ?? {};
  const before = readOrderingSettings(raw);
  const newRate = input.payment === "credits" ? rate : before.creditRate;

  const changes: string[] = [];

  // Switching euro ↔ credits: convert budgets and approved extras so every
  // budget keeps its value.
  const wasMoney = before.payment === "euro" || before.payment === "credits";
  const isMoney = input.payment === "euro" || input.payment === "credits";
  if (wasMoney && isMoney && before.payment !== input.payment) {
    const from = before.payment === "credits" ? "credits" : "euro";
    const to = input.payment === "credits" ? "credits" : "euro";
    const convert = (amount: number) =>
      to === "credits"
        ? creditsFor(amount, newRate)
        : Math.round(amount * before.creditRate * 100) / 100;
    const { data: budgets } = await admin
      .from("budgets")
      .select("id, amount, kind")
      .eq("company_id", companyId);
    for (const b of budgets ?? []) {
      if ((b.kind === "credits" ? "credits" : "euro") !== from) continue;
      await admin
        .from("budgets")
        .update({ kind: to, amount: convert(Number(b.amount)) })
        .eq("id", b.id);
    }
    const { data: extras } = await admin
      .from("budget_requests")
      .select("id, amount")
      .eq("company_id", companyId)
      .eq("unit", from);
    for (const e of extras ?? []) {
      await admin
        .from("budget_requests")
        .update({ unit: to, amount: Math.max(0.01, convert(Number(e.amount))) })
        .eq("id", e.id);
    }
    changes.push(`budgetten omgerekend van ${from} naar ${to}`);
  }

  // Rate change while in credits: scale credit budgets, extras and manual
  // credit prices so their euro value stays the same.
  if (
    before.payment === "credits" &&
    input.payment === "credits" &&
    Math.abs(before.creditRate - newRate) > 1e-9
  ) {
    const factor = before.creditRate / newRate;
    const { data: budgets } = await admin
      .from("budgets")
      .select("id, amount")
      .eq("company_id", companyId)
      .eq("kind", "credits");
    for (const b of budgets ?? [])
      await admin
        .from("budgets")
        .update({ amount: Math.ceil(Number(b.amount) * factor - 1e-9) })
        .eq("id", b.id);
    const { data: extras } = await admin
      .from("budget_requests")
      .select("id, amount")
      .eq("company_id", companyId)
      .eq("unit", "credits");
    for (const e of extras ?? [])
      await admin
        .from("budget_requests")
        .update({ amount: Math.max(1, Math.ceil(Number(e.amount) * factor - 1e-9)) })
        .eq("id", e.id);
    const { data: manual } = await admin
      .from("products")
      .select("id, credit_cost")
      .eq("company_id", companyId)
      .eq("credit_cost_manual", true);
    for (const m of manual ?? [])
      await admin
        .from("products")
        .update({ credit_cost: Math.ceil(Number(m.credit_cost ?? 0) * factor - 1e-9) })
        .eq("id", m.id);
    changes.push(
      `creditkoers van € ${before.creditRate.toFixed(2)} naar € ${newRate.toFixed(2)}`,
    );
  }

  // Entering credit mode or changing the rate: (re)freeze calculated prices.
  if (
    input.payment === "credits" &&
    (before.payment !== "credits" || Math.abs(before.creditRate - newRate) > 1e-9)
  ) {
    await freezeCredits(companyId, newRate);
  }

  const settings = {
    ...raw,
    payment_mode: input.payment,
    credit_rate: newRate,
    caps_enabled: input.capsEnabled,
    uncapped_products: input.uncapped,
    show_price_with_caps: input.showPriceWithCaps,
    approval_over_amount: input.approvalOver ?? "",
    // kept for older readers
    budget_mode:
      input.payment === "credits"
        ? "credits"
        : input.payment === "none" && input.capsEnabled
          ? "quantity"
          : "euro",
  };
  const { error } = await admin.from("companies").update({ settings }).eq("id", companyId);
  if (error) return { ok: false, error: error.message };

  const labels: Record<PaymentMode, string> = {
    none: "geen budget",
    euro: "budget in euro",
    credits: "budget in credits",
  };
  if (before.payment !== input.payment)
    changes.unshift(`betaling: ${labels[before.payment]} → ${labels[input.payment]}`);
  if (before.capsEnabled !== input.capsEnabled)
    changes.push(`maxima per product ${input.capsEnabled ? "aan" : "uit"}`);
  if (before.approvalOver !== input.approvalOver)
    changes.push(
      input.approvalOver == null
        ? "goedkeuringsdrempel verwijderd"
        : `goedkeuring boven ${formatAmount(input.approvalOver, input.payment)}`,
    );
  if (before.uncapped !== input.uncapped)
    changes.push(
      `producten zonder maximum: ${input.uncapped === "free" ? "vrij" : "niet bestelbaar"}`,
    );
  if (before.showPriceWithCaps !== input.showPriceWithCaps)
    changes.push(`prijs bij maxima ${input.showPriceWithCaps ? "tonen" : "verbergen"}`);

  if (changes.length)
    await logAudit({
      companyId,
      actor,
      targetType: "settings",
      action: "bestelregels",
      summary: `Bestelregels gewijzigd: ${changes.join("; ")}.`,
    });
  refresh(companyId);
  return { ok: true };
}

/** Apply the suggested (rate-based) credit price to products with drift. */
export async function refreshCreditPrices(
  companyId: string,
  productIds: string[] | "all",
): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();
  const s = readOrderingSettings(company?.settings as Record<string, unknown>);
  await freezeCredits(companyId, s.creditRate, productIds === "all" ? undefined : productIds);
  await logAudit({
    companyId,
    actor,
    targetType: "settings",
    action: "creditprijzen",
    summary:
      productIds === "all"
        ? "Alle creditprijzen bijgewerkt naar de huidige europrijs."
        : `Creditprijs bijgewerkt voor ${productIds.length} product(en).`,
  });
  refresh(companyId);
  return { ok: true };
}

/** Manual credit price for a product (null = follow the rate again). */
export async function setCreditOverride(
  companyId: string,
  productId: string,
  credits: number | null,
): Promise<Result> {
  const actor = await companyGate(companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, name, base_price")
    .eq("id", productId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Product niet gevonden." };

  if (credits == null) {
    const { data: company } = await admin
      .from("companies")
      .select("settings")
      .eq("id", companyId)
      .single();
    const s = readOrderingSettings(company?.settings as Record<string, unknown>);
    await admin.from("products").update({ credit_cost_manual: false }).eq("id", productId);
    await freezeCredits(companyId, s.creditRate, [productId]);
  } else {
    if (!(credits >= 1) || !Number.isInteger(credits))
      return { ok: false, error: "Een creditprijs is een heel getal van 1 of meer." };
    await admin
      .from("products")
      .update({ credit_cost: credits, credit_cost_manual: true })
      .eq("id", productId);
  }
  await logAudit({
    companyId,
    actor,
    targetType: "settings",
    action: "creditprijs",
    summary:
      credits == null
        ? `${product.name} volgt weer de creditkoers.`
        : `${product.name} kost voortaan vast ${credits} credits.`,
  });
  refresh(companyId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Functies                                                            */
/* ------------------------------------------------------------------ */

export type RoleInput = {
  id?: string;
  name: string;
  description: string;
  permissions: string[];
  requiresApproval: boolean;
  welcomeAmount: number | null;
  budget: { amount: number; period: string } | null;
  caps: { productId: string; max: number; period: string }[];
  /** null = all categories */
  categories: string[] | null;
  /** Assortment for this functie; undefined = leave unchanged. */
  products?: { productId: string; kind: "aanbevolen" | "starterspakket"; quantity: number }[];
};

function withDependencies(perms: string[]): string[] {
  const set = new Set(perms.filter((p) => ALL_PERMISSION_KEYS.includes(p)));
  const add = (k: string) => (PERMISSION_REQUIRES[k] ?? []).forEach((d) => {
    if (!set.has(d)) {
      set.add(d);
      add(d);
    }
  });
  [...set].forEach(add);
  return ALL_PERMISSION_KEYS.filter((k) => set.has(k));
}

export async function saveRole(
  companyId: string,
  input: RoleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const actor =
    (await companyGate(companyId, "roles.manage")) ??
    (input.id ? await companyGate(companyId, "settings.manage") : null);
  if (!actor) return DENIED;
  const manageRules = actor.isSuperadmin || can(actor, "settings.manage");
  const admin = createAdminClient();

  // Without roles.manage only budget, maxima and catalogue may change.
  if (!actor.isSuperadmin && !can(actor, "roles.manage")) {
    const { data: current } = await admin
      .from("roles")
      .select("name, description, requires_order_approval, perms:role_permissions(permission)")
      .eq("id", input.id!)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!current) return { ok: false, error: "Functie niet gevonden." };
    input = {
      ...input,
      name: current.name as string,
      description: (current.description as string | null) ?? "",
      requiresApproval: !!current.requires_order_approval,
      permissions: ((current.perms as { permission: string }[] | null) ?? []).map(
        (p) => p.permission,
      ),
    };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Geef de functie een naam." };

  const { data: existing } = await admin
    .from("roles")
    .select("id, name")
    .eq("company_id", companyId);
  if (
    (existing ?? []).some(
      (r) => r.id !== input.id && (r.name as string).trim().toLowerCase() === name.toLowerCase(),
    )
  )
    return { ok: false, error: `Er bestaat al een functie "${name}".` };

  const permissions = withDependencies(input.permissions);
  // The editor's own functie must keep managing functies, or they lock themselves out.
  if (input.id && !actor.isSuperadmin && actor.roleId === input.id && !permissions.includes("roles.manage"))
    return {
      ok: false,
      error: "Je kunt je eigen functie het recht om functies te beheren niet afnemen.",
    };

  const row = {
    company_id: companyId,
    name,
    description: input.description.trim() || null,
    requires_order_approval: input.requiresApproval,
    welcome_amount:
      manageRules && input.welcomeAmount && input.welcomeAmount > 0 ? input.welcomeAmount : null,
  };

  let roleId = input.id;
  if (roleId) {
    const { error } = await admin
      .from("roles")
      .update(row)
      .eq("id", roleId)
      .eq("company_id", companyId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await admin.from("roles").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Opslaan mislukt." };
    roleId = data.id as string;
  }

  await admin.from("role_permissions").delete().eq("role_id", roleId);
  if (permissions.length)
    await admin
      .from("role_permissions")
      .insert(permissions.map((permission) => ({ role_id: roleId, permission })));

  let assortment: { kind: string; quantity: number }[] | null = null;
  if (manageRules) {
    const { data: company } = await admin
      .from("companies")
      .select("settings")
      .eq("id", companyId)
      .single();
    const s = readOrderingSettings(company?.settings as Record<string, unknown>);
    const kind = s.payment === "credits" ? "credits" : "euro";

    // Budget of this functie in the current unit.
    await admin
      .from("budgets")
      .delete()
      .eq("company_id", companyId)
      .eq("scope", "role")
      .eq("target_id", roleId)
      .eq("kind", kind);
    if (input.budget && input.budget.amount > 0)
      await admin.from("budgets").insert({
        company_id: companyId,
        scope: "role",
        target_id: roleId,
        kind,
        amount:
          kind === "credits" ? Math.round(input.budget.amount) : input.budget.amount,
        period: validPeriod(input.budget.period),
      });

    // Maxima per product.
    await admin
      .from("product_allotments")
      .delete()
      .eq("company_id", companyId)
      .eq("scope", "role")
      .eq("target_id", roleId);
    const caps = input.caps.filter((c) => c.productId && c.max > 0);
    if (caps.length)
      await admin.from("product_allotments").insert(
        caps.map((c) => ({
          company_id: companyId,
          scope: "role",
          target_id: roleId,
          product_id: c.productId,
          max_quantity: Math.floor(c.max),
          period: validPeriod(c.period),
        })),
      );

    // Catalogue: rewrite rows per category so "no rows = everyone" stays true.
    const [{ data: roles }, { data: rules }, { data: cats }] = await Promise.all([
      admin
        .from("roles")
        .select("id, perms:role_permissions(permission)")
        .eq("company_id", companyId),
      admin
        .from("category_role_visibility")
        .select("category_id, role_id")
        .eq("company_id", companyId),
      admin
        .from("products")
        .select("category_id")
        .eq("company_id", companyId)
        .not("category_id", "is", null),
    ]);
    const roleList = (roles ?? []).map((r) => ({
      id: r.id as string,
      permissions:
        r.id === roleId
          ? permissions
          : ((r.perms as { permission: string }[] | null) ?? []).map((p) => p.permission),
    }));
    const vis: Record<string, string[]> = {};
    for (const r of rules ?? []) (vis[r.category_id as string] ??= []).push(r.role_id as string);
    const categoryIds = [...new Set((cats ?? []).map((c) => c.category_id as string))];
    const thisRole = roleList.find((r) => r.id === roleId)!;
    const selected = seesFullCatalogue(thisRole.permissions) ? null : input.categories;
    const { rows, error } = applyRoleCategories(vis, roleList, categoryIds, roleId!, selected);
    if (error) return { ok: false, error };
    await admin.from("category_role_visibility").delete().eq("company_id", companyId);
    const insert = Object.entries(rows).flatMap(([category_id, ids]) =>
      ids.map((role_id) => ({ company_id: companyId, category_id, role_id })),
    );
    if (insert.length) await admin.from("category_role_visibility").insert(insert);

    // Assortment: recommended products and the starter kit of this functie.
    if (input.products) {
      const wanted = input.products.filter((p) => p.productId);
      const ids = [...new Set(wanted.map((p) => p.productId))];
      const { data: own } = ids.length
        ? await admin.from("products").select("id").eq("company_id", companyId).in("id", ids)
        : { data: [] };
      const valid = new Set((own ?? []).map((p) => p.id as string));
      const seen = new Set<string>();
      const rowsToInsert = wanted
        .filter((p) => valid.has(p.productId) && !seen.has(p.productId) && seen.add(p.productId))
        .map((p, i) => ({
          role_id: roleId!,
          product_id: p.productId,
          company_id: companyId,
          kind: p.kind === "starterspakket" ? "starterspakket" : "aanbevolen",
          quantity: Math.min(99, Math.max(1, Math.round(Number(p.quantity) || 1))),
          sort_order: i,
        }));
      await admin.from("role_products").delete().eq("role_id", roleId!);
      if (rowsToInsert.length) await admin.from("role_products").insert(rowsToInsert);
      assortment = rowsToInsert;
    }
  }

  await logAudit({
    companyId,
    actor,
    targetType: "role",
    targetId: roleId,
    action: input.id ? "bewerkt" : "aangemaakt",
    summary: input.id
      ? `Functie ${name} bijgewerkt${
          input.budget
            ? ` (budget ${input.budget.amount} ${PERIOD_LABEL[validPeriod(input.budget.period)]})`
            : ""
        }${
          assortment
            ? `; assortiment: ${assortment.filter((a) => a.kind === "aanbevolen").length} aanbevolen, pakket ${assortment
                .filter((a) => a.kind === "starterspakket")
                .reduce((s, a) => s + a.quantity, 0)} stuks`
            : ""
        }.`
      : `Functie ${name} aangemaakt.`,
  });
  refresh(companyId);
  return { ok: true, id: roleId! };
}

/** Delete a functie after moving its people to another one. */
export async function deleteRole(
  companyId: string,
  roleId: string,
  moveToRoleId: string | null,
): Promise<Result> {
  const actor = await companyGate(companyId, "roles.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();

  const { data: role } = await admin
    .from("roles")
    .select("id, name, is_system")
    .eq("id", roleId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!role) return { ok: false, error: "Functie niet gevonden." };
  if (role.is_system)
    return { ok: false, error: "Standaardfuncties kunnen niet worden verwijderd." };
  if (!actor.isSuperadmin && actor.roleId === roleId)
    return { ok: false, error: "Je kunt je eigen functie niet verwijderen." };

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role_id", roleId);
  let target: { id: string; name: string } | null = null;
  if (count && count > 0) {
    if (!moveToRoleId || moveToRoleId === roleId)
      return { ok: false, error: "Kies naar welke functie de medewerkers gaan." };
    const { data } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", moveToRoleId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!data) return { ok: false, error: "De gekozen functie bestaat niet." };
    target = { id: data.id as string, name: data.name as string };
    await admin.from("profiles").update({ role_id: target.id }).eq("role_id", roleId);
  }

  // Categories only this functie could see must not flip to "everyone" when
  // its visibility rows cascade away: give them to the receiving functie.
  const { data: rules } = await admin
    .from("category_role_visibility")
    .select("category_id, role_id")
    .eq("company_id", companyId);
  const byCat = new Map<string, string[]>();
  for (const r of rules ?? [])
    byCat.set(r.category_id as string, [...(byCat.get(r.category_id as string) ?? []), r.role_id as string]);
  const { data: fullRoles } = await admin
    .from("roles")
    .select("id, perms:role_permissions(permission)")
    .eq("company_id", companyId)
    .neq("id", roleId);
  const keepers = (fullRoles ?? [])
    .filter((r) =>
      ((r.perms as { permission: string }[] | null) ?? []).some(
        (p) => p.permission === "orders.view_all",
      ),
    )
    .map((r) => r.id as string);
  for (const [cat, ids] of byCat) {
    if (ids.length === 1 && ids[0] === roleId) {
      const add = target ? [target.id] : keepers;
      if (add.length)
        await admin
          .from("category_role_visibility")
          .insert(add.map((role_id) => ({ company_id: companyId, category_id: cat, role_id })));
    }
  }

  await admin.from("budgets").delete().eq("company_id", companyId).eq("scope", "role").eq("target_id", roleId);
  await admin
    .from("product_allotments")
    .delete()
    .eq("company_id", companyId)
    .eq("scope", "role")
    .eq("target_id", roleId);
  const { error } = await admin.from("roles").delete().eq("id", roleId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    companyId,
    actor,
    targetType: "role",
    targetId: roleId,
    action: "verwijderd",
    summary: target
      ? `Functie ${role.name} verwijderd; ${count} medewerker(s) verplaatst naar ${target.name}.`
      : `Functie ${role.name} verwijderd.`,
  });
  refresh(companyId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Medewerkers                                                         */
/* ------------------------------------------------------------------ */

async function loadCompanyUser(userId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, company_id, full_name, email, is_superadmin")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.is_superadmin || !data.company_id) return null;
  return {
    id: data.id as string,
    companyId: data.company_id as string,
    name: (data.full_name as string | null) ?? (data.email as string | null) ?? "Medewerker",
  };
}

export async function setPersonRole(userId: string, roleId: string): Promise<Result> {
  const person = await loadCompanyUser(userId);
  if (!person) return { ok: false, error: "Medewerker niet gevonden." };
  const actor = await companyGate(person.companyId, "users.update");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data: role } = await admin
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .eq("company_id", person.companyId)
    .maybeSingle();
  if (!role) return { ok: false, error: "Ongeldige functie." };
  if (!actor.isSuperadmin && actor.id === userId)
    return { ok: false, error: "Je kunt je eigen functie niet wijzigen." };
  await admin.from("profiles").update({ role_id: roleId }).eq("id", userId);
  await logAudit({
    companyId: person.companyId,
    actor,
    targetType: "user",
    targetId: userId,
    action: "functie",
    summary: `${person.name} heeft nu de functie ${role.name}.`,
  });
  refresh(person.companyId);
  return { ok: true };
}

/** Personal budget exception (null = follow the functie again). */
export async function setPersonBudget(
  userId: string,
  budget: { amount: number; period: string } | null,
): Promise<Result> {
  const person = await loadCompanyUser(userId);
  if (!person) return { ok: false, error: "Medewerker niet gevonden." };
  const actor = await companyGate(person.companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("settings")
    .eq("id", person.companyId)
    .single();
  const s = readOrderingSettings(company?.settings as Record<string, unknown>);
  if (s.payment === "none")
    return { ok: false, error: "Er geldt geen budget in deze organisatie." };
  const kind = s.payment === "credits" ? "credits" : "euro";

  await admin
    .from("budgets")
    .delete()
    .eq("company_id", person.companyId)
    .eq("scope", "user")
    .eq("target_id", userId)
    .eq("kind", kind);
  if (budget) {
    if (!(budget.amount > 0)) return { ok: false, error: "Vul een bedrag groter dan 0 in." };
    await admin.from("budgets").insert({
      company_id: person.companyId,
      scope: "user",
      target_id: userId,
      kind,
      amount: kind === "credits" ? Math.round(budget.amount) : budget.amount,
      period: validPeriod(budget.period),
    });
  }
  await logAudit({
    companyId: person.companyId,
    actor,
    targetType: "user",
    targetId: userId,
    action: "budget",
    summary: budget
      ? `Eigen budget voor ${person.name}: ${formatAmount(budget.amount, s.payment)} ${PERIOD_LABEL[validPeriod(budget.period)]}.`
      : `${person.name} volgt weer het budget van de functie.`,
  });
  refresh(person.companyId);
  return { ok: true };
}

/** Personal maximum for one product (null = follow the functie again). */
export async function setPersonCap(
  userId: string,
  productId: string,
  cap: { max: number; period: string } | null,
): Promise<Result> {
  const person = await loadCompanyUser(userId);
  if (!person) return { ok: false, error: "Medewerker niet gevonden." };
  const actor = await companyGate(person.companyId, "settings.manage");
  if (!actor) return DENIED;
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .eq("company_id", person.companyId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Product niet gevonden." };

  await admin
    .from("product_allotments")
    .delete()
    .eq("company_id", person.companyId)
    .eq("scope", "user")
    .eq("target_id", userId)
    .eq("product_id", productId);
  if (cap) {
    if (!(cap.max >= 0)) return { ok: false, error: "Vul een aantal van 0 of meer in." };
    await admin.from("product_allotments").insert({
      company_id: person.companyId,
      scope: "user",
      target_id: userId,
      product_id: productId,
      max_quantity: Math.floor(cap.max),
      period: validPeriod(cap.period),
    });
  }
  await logAudit({
    companyId: person.companyId,
    actor,
    targetType: "user",
    targetId: userId,
    action: "maximum",
    summary: cap
      ? `${person.name} mag ${product.name} ${cap.max}× ${PERIOD_LABEL[validPeriod(cap.period)]} bestellen.`
      : `${person.name} volgt voor ${product.name} weer de functie.`,
  });
  refresh(person.companyId);
  return { ok: true };
}

export type BulkAction =
  | { type: "role"; roleId: string }
  | { type: "status"; status: "active" | "disabled" };

export async function bulkPeople(
  companyId: string,
  userIds: string[],
  action: BulkAction,
): Promise<Result> {
  const actor = await companyGate(companyId, "users.update");
  if (!actor) return DENIED;
  const ids = userIds.filter((id) => actor.isSuperadmin || id !== actor.id);
  if (!ids.length) return { ok: false, error: "Geen medewerkers geselecteerd." };
  const admin = createAdminClient();

  // Only people of this company.
  const { data: people } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_superadmin", false)
    .in("id", ids);
  const valid = (people ?? []).map((p) => p.id as string);
  if (!valid.length) return { ok: false, error: "Geen geldige medewerkers geselecteerd." };

  let summary = "";
  if (action.type === "role") {
    const { data: role } = await admin
      .from("roles")
      .select("id, name")
      .eq("id", action.roleId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!role) return { ok: false, error: "Ongeldige functie." };
    await admin.from("profiles").update({ role_id: role.id }).in("id", valid);
    summary = `${valid.length} medewerker(s) naar functie ${role.name}.`;
  } else {
    for (const id of valid)
      await admin.auth.admin.updateUserById(id, {
        ban_duration: action.status === "disabled" ? "876000h" : "none",
      });
    await admin.from("profiles").update({ status: action.status }).in("id", valid);
    summary = `${valid.length} medewerker(s) ${action.status === "disabled" ? "gedeactiveerd" : "geactiveerd"}.`;
  }
  await logAudit({ companyId, actor, targetType: "user", action: "bulk", summary });
  refresh(companyId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Activiteit                                                          */
/* ------------------------------------------------------------------ */

export type ActivityOrder = {
  id: string;
  order_number: string | null;
  created_at: string;
  total: number;
  credit_total: number;
  status: string;
};
export type HistoryEntry = {
  id: string;
  actor_name: string | null;
  summary: string;
  created_at: string;
};

export async function getPersonActivity(
  userId: string,
): Promise<{ ok: true; orders: ActivityOrder[]; history: HistoryEntry[] } | { ok: false; error: string }> {
  const person = await loadCompanyUser(userId);
  if (!person) return { ok: false, error: "Medewerker niet gevonden." };
  if (!(await companyGate(person.companyId, "users.view"))) return DENIED;
  const admin = createAdminClient();
  const [{ data: orders }, { data: history }] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, created_at, total, credit_total, status")
      .eq("ordered_by", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("audit_log")
      .select("id, actor_name, summary, created_at")
      .eq("target_type", "user")
      .eq("target_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  return {
    ok: true,
    orders: (orders ?? []).map((o) => ({
      id: o.id as string,
      order_number: (o.order_number as string | null) ?? null,
      created_at: o.created_at as string,
      total: Number(o.total ?? 0),
      credit_total: Number(o.credit_total ?? 0),
      status: o.status as string,
    })),
    history: (history ?? []) as HistoryEntry[],
  };
}

export async function getHistory(
  companyId: string,
  target: { type: "role" | "settings"; id?: string },
): Promise<{ ok: true; history: HistoryEntry[] } | { ok: false; error: string }> {
  if (
    !(await companyGate(companyId, "users.view")) &&
    !(await companyGate(companyId, "settings.manage"))
  )
    return DENIED;
  let q = createAdminClient()
    .from("audit_log")
    .select("id, actor_name, summary, created_at")
    .eq("company_id", companyId)
    .eq("target_type", target.type)
    .order("created_at", { ascending: false })
    .limit(20);
  if (target.id) q = q.eq("target_id", target.id);
  const { data } = await q;
  return { ok: true, history: (data ?? []) as HistoryEntry[] };
}
