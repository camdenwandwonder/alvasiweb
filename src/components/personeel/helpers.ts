import type { PersonAllowance } from "@/lib/allowance";
import {
  formatAmount,
  PERIOD_LABEL,
  type OrderingSettings,
  type Period,
} from "@/lib/ordering";
import { seesFullCatalogue } from "@/lib/permissions";
import { roleSees } from "@/lib/personeel/visibility";
import type {
  PAllot,
  PBudget,
  PersoneelData,
  PPerson,
  PRole,
} from "@/lib/personeel/data";

export type Perms = {
  view: boolean;
  invite: boolean;
  update: boolean;
  remove: boolean;
  roles: boolean;
  settings: boolean;
};

export const budgetKind = (s: OrderingSettings) =>
  s.payment === "credits" ? "credits" : "euro";

export function periodText(p: string): string {
  return PERIOD_LABEL[p as Period] ?? p;
}

export function roleBudget(data: PersoneelData, roleId: string | null): PBudget | null {
  if (!roleId || data.settings.payment === "none") return null;
  const kind = budgetKind(data.settings);
  return (
    data.budgets.find(
      (b) => b.scope === "role" && b.target_id === roleId && (b.kind === "credits" ? "credits" : "euro") === kind,
    ) ?? null
  );
}

export function personBudget(data: PersoneelData, userId: string): PBudget | null {
  if (data.settings.payment === "none") return null;
  const kind = budgetKind(data.settings);
  return (
    data.budgets.find(
      (b) => b.scope === "user" && b.target_id === userId && (b.kind === "credits" ? "credits" : "euro") === kind,
    ) ?? null
  );
}

export function roleCaps(data: PersoneelData, roleId: string): PAllot[] {
  return data.allotments.filter((a) => a.scope === "role" && a.target_id === roleId);
}

export function personCaps(data: PersoneelData, userId: string): PAllot[] {
  return data.allotments.filter((a) => a.scope === "user" && a.target_id === userId);
}

export function hasException(data: PersoneelData, userId: string): boolean {
  return (
    !!personBudget(data, userId) ||
    (data.settings.capsEnabled && personCaps(data, userId).length > 0)
  );
}

export function budgetUse(a: PersonAllowance | undefined): number | null {
  if (!a?.budget || a.budget.total <= 0) return null;
  return Math.min(1, Math.max(0, a.budget.used / a.budget.total));
}

export function missingSizes(data: PersoneelData, p: PPerson): boolean {
  if (!data.sizeSets.length) return false;
  return !p.sizes || Object.values(p.sizes).every((v) => !v);
}

export function sizeSummary(data: PersoneelData, sizes: Record<string, string> | null): string {
  if (!sizes) return "";
  return data.sizeSets
    .filter((s) => sizes[s.id])
    .map((s) => s.values.find((v) => v.value === sizes[s.id])?.label ?? sizes[s.id])
    .join(" · ");
}

export function roleName(data: PersoneelData, roleId: string | null): string {
  return data.roles.find((r) => r.id === roleId)?.name ?? "Geen functie";
}

export function membersOf(data: PersoneelData, roleId: string): PPerson[] {
  return data.people.filter((p) => p.role_id === roleId);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type CanLine = { ok: boolean | "warn"; text: string; source?: string };

/** Plain-language summary of what one person can do, with where it comes from. */
export function whatCan(data: PersoneelData, p: PPerson): CanLine[] {
  const role = data.roles.find((r) => r.id === p.role_id);
  const lines: CanLine[] = [];
  if (p.status === "disabled")
    return [{ ok: false, text: "Kan niet inloggen (gedeactiveerd)" }];
  if (!role) return [{ ok: false, text: "Heeft geen functie en kan daardoor niets" }];
  const via = `via ${role.name}`;
  const perms = role.permissions;
  const s = data.settings;

  if (!perms.includes("orders.create")) {
    lines.push({
      ok: perms.includes("products.view") ? "warn" : false,
      text: perms.includes("products.view")
        ? "Kan de winkel bekijken, maar niet bestellen"
        : "Heeft geen toegang tot de winkel",
      source: via,
    });
  } else {
    const cats = data.categories;
    let catText = "Bestellen uit de hele catalogus";
    if (!seesFullCatalogue(perms) && cats.length) {
      const seen = cats.filter((c) => roleSees(data.visibility, c.id, role));
      catText =
        seen.length === cats.length
          ? "Bestellen uit de hele catalogus"
          : seen.length
            ? `Bestellen uit ${seen.map((c) => c.name).join(", ")}`
            : "Ziet geen enkele categorie in de winkel";
    }
    lines.push({ ok: true, text: catText, source: via });
  }

  const a = data.allowances[p.id];
  if (s.payment === "none") {
    lines.push({ ok: true, text: "Geen budgetlimiet", source: "bestelregels" });
  } else if (a?.budget) {
    const b = a.budget;
    const reset = b.resetsAt ? `, reset ${formatDate(b.resetsAt)}` : "";
    lines.push({
      ok: b.remaining > 0 ? true : "warn",
      text: `${formatAmount(Math.max(0, b.remaining), s.payment)} over van ${formatAmount(b.total, s.payment)}${reset}`,
      source:
        b.source === "user"
          ? "persoonlijke uitzondering"
          : `via ${role.name}${b.extra > 0 ? ` + ${formatAmount(b.extra, s.payment)} extra` : ""}`,
    });
  } else {
    lines.push({
      ok: "warn",
      text: "Geen budget ingesteld: bestellen kan zonder limiet",
      source: via,
    });
  }

  if (s.capsEnabled) {
    const caps = Object.values(a?.caps ?? {});
    const full = caps.filter((c) => c.remaining <= 0).length;
    lines.push({
      ok: full ? "warn" : true,
      text: caps.length
        ? `Maximum per product voor ${caps.length} product(en)${full ? `, ${full} bereikt` : ""}`
        : s.uncapped === "blocked"
          ? "Geen producten met een maximum, dus niets bestelbaar"
          : "Geen maxima per product",
      source: personCaps(data, p.id).length ? "deels persoonlijke uitzondering" : via,
    });
  }

  if (role.requires_order_approval) {
    lines.push({ ok: "warn", text: "Elke bestelling moet worden goedgekeurd", source: via });
  } else if (s.approvalOver != null) {
    lines.push({
      ok: "warn",
      text: `Bestellingen boven ${formatAmount(s.approvalOver, s.payment)} moeten worden goedgekeurd`,
      source: "bestelregels",
    });
  } else {
    lines.push({ ok: true, text: "Bestellingen gaan direct door", source: via });
  }

  if (perms.includes("orders.approve"))
    lines.push({ ok: true, text: "Kan bestellingen van anderen goedkeuren", source: via });
  else if (!perms.includes("orders.view_all"))
    lines.push({ ok: false, text: "Ziet geen bestellingen van anderen", source: via });

  return lines;
}

export function roleSummary(data: PersoneelData, role: PRole) {
  const budget = roleBudget(data, role.id);
  const caps = roleCaps(data, role.id);
  const cats = data.categories;
  const seen = seesFullCatalogue(role.permissions)
    ? null
    : cats.filter((c) => roleSees(data.visibility, c.id, role));
  return {
    members: membersOf(data, role.id),
    budget,
    budgetText: budget
      ? `${formatAmount(budget.amount, data.settings.payment)} ${periodText(budget.period)}`
      : data.settings.payment === "none"
        ? "Geen budget"
        : "Geen budget ingesteld",
    caps,
    seesText:
      seen === null || seen.length === cats.length
        ? "Alle categorieën"
        : seen.length
          ? seen.map((c) => c.name).join(" · ")
          : "Geen categorieën",
    approvalText: role.requires_order_approval
      ? "Altijd"
      : data.settings.approvalOver != null
        ? `Boven ${formatAmount(data.settings.approvalOver, data.settings.payment)}`
        : "Nooit",
  };
}
