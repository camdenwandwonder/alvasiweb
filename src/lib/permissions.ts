/**
 * Permissions managers can toggle on company functies (roles), written as
 * plain Dutch sentences, plus starter templates and automatic dependencies.
 */
export type PermissionItem = { key: string; label: string; hint?: string };

export const PERMISSION_GROUPS: { title: string; items: PermissionItem[] }[] = [
  {
    title: "Bestellen",
    items: [
      { key: "products.view", label: "Kan de winkel bekijken" },
      { key: "orders.create", label: "Kan bestellingen plaatsen" },
      { key: "orders.view_own", label: "Kan eigen bestellingen bekijken" },
      {
        key: "orders.cancel",
        label: "Kan eigen bestellingen annuleren",
        hint: "Zolang de bestelling nog op goedkeuring wacht.",
      },
      {
        key: "orders.view_all",
        label: "Kan alle bestellingen van het bedrijf zien",
        hint: "Ziet in de winkel ook altijd de volledige catalogus.",
      },
      { key: "orders.approve", label: "Kan bestellingen en budgetaanvragen goedkeuren" },
      {
        key: "orders.order_for_others",
        label: "Kan bestellen namens medewerkers",
        hint: "Met de maat, het budget en de maxima van die medewerker.",
      },
    ],
  },
  {
    title: "Team",
    items: [
      { key: "users.view", label: "Kan het personeel bekijken" },
      { key: "users.invite", label: "Kan medewerkers toevoegen" },
      { key: "users.update", label: "Kan medewerkers bewerken", hint: "Gegevens, functie, wachtwoord en maten." },
      { key: "users.remove", label: "Kan medewerkers verwijderen" },
      { key: "roles.manage", label: "Kan functies en rechten beheren" },
    ],
  },
  {
    title: "Instellingen",
    items: [
      {
        key: "settings.manage",
        label: "Kan bestelregels, budgetten en huisstijl beheren",
        hint: "Bestelwijze, credits, maxima, catalogus en leveradressen.",
      },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
);

/** Turning on the key also turns on everything it needs. */
export const PERMISSION_REQUIRES: Record<string, string[]> = {
  "orders.create": ["products.view", "orders.view_own"],
  "orders.cancel": ["orders.view_own"],
  "orders.view_all": ["orders.view_own"],
  "orders.approve": ["orders.view_all", "orders.view_own"],
  "orders.order_for_others": ["orders.create", "users.view"],
  "users.invite": ["users.view"],
  "users.update": ["users.view"],
  "users.remove": ["users.view"],
  "roles.manage": ["users.view"],
};

/** Adds dependencies for on, removes dependents for off. */
export function togglePermission(current: string[], key: string, on: boolean): string[] {
  const set = new Set(current);
  if (on) {
    const add = (k: string) => {
      if (set.has(k)) return;
      set.add(k);
      (PERMISSION_REQUIRES[k] ?? []).forEach(add);
    };
    add(key);
  } else {
    const remove = (k: string) => {
      set.delete(k);
      for (const [dep, needs] of Object.entries(PERMISSION_REQUIRES))
        if (needs.includes(k) && set.has(dep)) remove(dep);
    };
    remove(key);
  }
  return ALL_PERMISSION_KEYS.filter((k) => set.has(k));
}

export const ROLE_TEMPLATES: {
  key: string;
  label: string;
  description: string;
  permissions: string[];
}[] = [
  {
    key: "medewerker",
    label: "Medewerker",
    description: "Kan bestellen voor zichzelf.",
    permissions: ["products.view", "orders.create", "orders.view_own", "orders.cancel"],
  },
  {
    key: "leidinggevende",
    label: "Leidinggevende",
    description: "Bestelt zelf en keurt bestellingen van het team goed.",
    permissions: [
      "products.view",
      "orders.create",
      "orders.view_own",
      "orders.cancel",
      "orders.view_all",
      "orders.approve",
      "users.view",
    ],
  },
  {
    key: "beheerder",
    label: "Beheerder",
    description: "Beheert alles: personeel, functies, bestelregels en instellingen.",
    permissions: ALL_PERMISSION_KEYS,
  },
];

/** One-line summary of what a set of permissions allows. */
export function summarizePermissions(perms: string[]): string {
  const has = (k: string) => perms.includes(k);
  if (has("settings.manage") && has("roles.manage")) return "Beheert alles binnen het bedrijf.";
  if (has("orders.approve")) return "Bestelt zelf en keurt bestellingen goed.";
  if (has("orders.view_all")) return "Bestelt zelf en ziet alle bestellingen.";
  if (has("orders.create")) return "Kan bestellen voor zichzelf.";
  if (has("products.view")) return "Kan de winkel alleen bekijken.";
  return "Heeft geen toegang tot de winkel.";
}

/** Functies with these rights see the full catalogue regardless of visibility rules. */
export function seesFullCatalogue(perms: string[]): boolean {
  return perms.includes("orders.view_all");
}
