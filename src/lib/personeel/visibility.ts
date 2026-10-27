/**
 * Catalogue visibility, edited per functie but stored per category
 * (category → allowed functies; no rows = everyone).
 */
import { seesFullCatalogue } from "@/lib/permissions";

export type Visibility = Record<string, string[]>;
type RoleLike = { id: string; permissions: string[] };

export function roleSees(vis: Visibility, categoryId: string, role: RoleLike): boolean {
  if (seesFullCatalogue(role.permissions)) return true;
  const rows = vis[categoryId];
  return !rows || rows.length === 0 || rows.includes(role.id);
}

/** Category ids a functie sees, or null when it sees everything. */
export function visibleCategories(
  vis: Visibility,
  categoryIds: string[],
  role: RoleLike,
): string[] | null {
  if (seesFullCatalogue(role.permissions)) return null;
  const seen = categoryIds.filter((c) => roleSees(vis, c, role));
  return seen.length === categoryIds.length ? null : seen;
}

/**
 * New rows after setting what one functie sees (`selected` null = everything).
 * A category nobody may see is kept restricted to the functies that always see
 * the full catalogue, because "no rows" would mean "everyone".
 */
export function applyRoleCategories(
  vis: Visibility,
  roles: RoleLike[],
  categoryIds: string[],
  roleId: string,
  selected: string[] | null,
): { rows: Visibility; error?: string } {
  const restricted = roles.filter((r) => !seesFullCatalogue(r.permissions));
  const full = roles.filter((r) => seesFullCatalogue(r.permissions));
  const rows: Visibility = {};

  for (const cat of categoryIds) {
    const desired = restricted.filter((r) =>
      r.id === roleId
        ? selected === null || selected.includes(cat)
        : roleSees(vis, cat, r),
    );
    if (desired.length === restricted.length) continue; // everyone → no rows
    if (desired.length === 0) {
      if (!full.length)
        return {
          rows: {},
          error:
            "Minstens één functie moet deze categorie kunnen zien. Maak eerst een beheerfunctie aan.",
        };
      rows[cat] = full.map((r) => r.id);
      continue;
    }
    rows[cat] = desired.map((r) => r.id);
  }
  return { rows };
}
