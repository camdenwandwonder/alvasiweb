import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getAllowanceFor, type CapState, type PersonAllowance } from "@/lib/allowance";
import {
  displayFor,
  effectiveCredits,
  type Display,
  type OrderingSettings,
} from "@/lib/ordering";
import { seesFullCatalogue } from "@/lib/permissions";

export type ShopVariant = {
  id: string;
  attributes: Record<string, unknown>;
  euro: number;
  credits: number;
};

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  images: { url: string; is_primary: boolean }[];
  euro: number;
  credits: number;
  variants: ShopVariant[];
  cap: CapState | null;
};

export type ShopViewer = {
  id: string;
  companyId: string;
  roleId: string | null;
  permissions: string[];
  /** Members see one unit (or none); managers see euros as well. */
  kind: "member" | "manager";
};

export type ShopData = {
  settings: OrderingSettings;
  allowance: PersonAllowance;
  display: Display;
  products: ShopProduct[];
  categories: { id: string; name: string }[];
  preferredSizes: string[];
  missingSizes: boolean;
};

type RawProduct = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  credit_cost: number | null;
  credit_cost_manual: boolean;
  category_id: string | null;
  category: { name: string } | null;
  variants: {
    id: string;
    attributes: Record<string, unknown>;
    price_override: number | null;
    credit_cost: number | null;
  }[];
  images: { url: string; is_primary: boolean }[];
};

/** Everything the shop shows for one viewer — used by the shop and its preview. */
export async function buildShop(viewer: ShopViewer): Promise<ShopData> {
  const admin = createAdminClient();
  const [{ data }, { settings, allowance }, { data: profile }, { data: sizeSets }, { data: rules }] =
    await Promise.all([
      admin
        .from("products")
        .select(
          "id, name, description, base_price, credit_cost, credit_cost_manual, category_id, category:categories(name), variants:product_variants(id, attributes, price_override, credit_cost), images:product_images(url, is_primary)",
        )
        .eq("company_id", viewer.companyId)
        .eq("status", "active")
        .order("name"),
      getAllowanceFor(viewer.companyId, viewer.id),
      admin.from("profiles").select("sizes").eq("id", viewer.id).maybeSingle(),
      admin.from("option_sets").select("id, values:option_values(value, label)").eq("kind", "size"),
      admin
        .from("category_role_visibility")
        .select("category_id, role_id")
        .eq("company_id", viewer.companyId),
    ]);

  // Preferred size values/labels pre-select (and lock) the size in the shop.
  const userSizes = (profile?.sizes as Record<string, string> | null) ?? {};
  const preferred = new Set<string>();
  for (const [setId, val] of Object.entries(userSizes)) {
    if (!val) continue;
    preferred.add(String(val));
    const set = (sizeSets ?? []).find((s) => s.id === setId) as
      | { values: { value: string; label: string | null }[] }
      | undefined;
    const ov = set?.values?.find((v) => v.value === val);
    if (ov?.label) preferred.add(ov.label);
  }

  let raw = (data ?? []) as unknown as RawProduct[];

  // Catalogue per functie; functies that see all orders see everything.
  if (!seesFullCatalogue(viewer.permissions)) {
    const allowed = new Map<string, Set<string>>();
    for (const r of rules ?? []) {
      const s = allowed.get(r.category_id) ?? new Set<string>();
      s.add(r.role_id);
      allowed.set(r.category_id, s);
    }
    raw = raw.filter((p) => {
      if (!p.category_id) return true;
      const set = allowed.get(p.category_id);
      if (!set) return true;
      return viewer.roleId ? set.has(viewer.roleId) : false;
    });
  }

  // With maxima on and "producten zonder limiet: niet bestelbaar".
  if (settings.capsEnabled && settings.uncapped === "blocked") {
    raw = raw.filter((p) => allowance.caps[p.id]);
  }

  const rate = settings.creditRate;
  const products: ShopProduct[] = raw.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category_id: p.category_id,
    category_name: p.category?.name ?? null,
    images: p.images ?? [],
    euro: Number(p.base_price ?? 0),
    credits: effectiveCredits(p, null, rate),
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      attributes: v.attributes,
      euro: v.price_override != null ? Number(v.price_override) : Number(p.base_price ?? 0),
      credits: effectiveCredits(p, v, rate),
    })),
    cap: allowance.caps[p.id] ?? null,
  }));

  const catMap = new Map<string, string>();
  for (const p of products)
    if (p.category_id && p.category_name) catMap.set(p.category_id, p.category_name);

  return {
    settings,
    allowance,
    display: displayFor(settings, viewer.kind),
    products,
    categories: [...catMap.entries()].map(([id, name]) => ({ id, name })),
    preferredSizes: [...preferred],
    missingSizes: (sizeSets ?? []).length > 0 && Object.values(userSizes).every((v) => !v),
  };
}
