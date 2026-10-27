import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES, getAllowanceFor, type CapState, type PersonAllowance } from "@/lib/allowance";
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

export type SizeChart = {
  columns: string[];
  rows: { size: string; values: string[] }[];
  note: string | null;
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
  /** Attribute keys that hold the size and the colour, when present. */
  sizeKey: string | null;
  colorKey: string | null;
  sizes: string[];
  colors: string[];
  /** The variant in the viewer's own size (only when that settles the choice). */
  myVariantId: string | null;
  /** The viewer's size exists for this product. */
  mySize: string | null;
  isNew: boolean;
  leadTimeDays: number | null;
  requiresProof: boolean;
  needsApproval: boolean;
  maxPerOrder: number | null;
  favorite: boolean;
  lastOrdered: { at: string; quantity: number; variantId: string | null; variantLabel: string | null } | null;
  roleKind: "aanbevolen" | "starterspakket" | null;
  kitQuantity: number | null;
  sizeChart: SizeChart | null;
};

export type ShopViewer = {
  id: string;
  companyId: string;
  roleId: string | null;
  permissions: string[];
  /** Members see one unit (or none); managers see euros as well. */
  kind: "member" | "manager";
  /** Whose favourites to show (the signed-in user when ordering for someone). */
  favoritesOf?: string;
};

export type ShopData = {
  settings: OrderingSettings;
  allowance: PersonAllowance;
  display: Display;
  products: ShopProduct[];
  categories: { id: string; name: string }[];
  preferredSizes: string[];
  missingSizes: boolean;
  /** Orders the viewer placed so far (0 = new employee: show the starter kit). */
  orderCount: number;
};

type RawProduct = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  credit_cost: number | null;
  credit_cost_manual: boolean;
  category_id: string | null;
  created_at: string;
  lead_time_days: number | null;
  requires_proof: boolean | null;
  requires_approval_override: boolean | null;
  max_quantity_per_order: number | null;
  category: { name: string } | null;
  variants: {
    id: string;
    attributes: Record<string, unknown>;
    price_override: number | null;
    credit_cost: number | null;
  }[];
  images: { url: string; is_primary: boolean }[];
};

const SIZE_KEY = /^(maat|maten|size|afmeting|formaat)$/i;
const COLOR_KEY = /^(kleur|kleuren|colou?r)$/i;
const NEW_DAYS = 30;

function axis(variants: RawProduct["variants"], test: RegExp) {
  const key =
    variants.flatMap((v) => Object.keys(v.attributes ?? {})).find((k) => test.test(k.trim())) ?? null;
  const values = key
    ? [...new Set(variants.map((v) => String(v.attributes?.[key] ?? "")).filter(Boolean))]
    : [];
  return { key, values };
}

/** Everything the shop shows for one viewer — used by the shop and its preview. */
export async function buildShop(viewer: ShopViewer): Promise<ShopData> {
  const admin = createAdminClient();
  const [
    { data },
    { settings, allowance },
    { data: profile },
    { data: sizeSets },
    { data: rules },
    { data: role },
    { data: favorites },
    { data: ordered },
    { data: roleProducts },
  ] = await Promise.all([
    admin
      .from("products")
      .select(
        "id, name, description, base_price, credit_cost, credit_cost_manual, category_id, created_at, lead_time_days, requires_proof, requires_approval_override, max_quantity_per_order, category:categories(name), variants:product_variants(id, attributes, price_override, credit_cost), images:product_images(url, is_primary)",
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
    viewer.roleId
      ? admin.from("roles").select("requires_order_approval").eq("id", viewer.roleId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("product_favorites")
      .select("product_id")
      .eq("user_id", viewer.favoritesOf ?? viewer.id),
    admin
      .from("orders")
      .select("id, created_at, items:order_items(product_id, variant_id, variant_label, quantity)")
      .eq("ordered_by", viewer.id)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(200),
    viewer.roleId
      ? admin
          .from("role_products")
          .select("product_id, kind, quantity, sort_order")
          .eq("role_id", viewer.roleId)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
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

  // Size charts: the product's own, otherwise the one of its size system.
  const ids = raw.map((p) => p.id);
  const [{ data: productOptions }, { data: charts }] = await Promise.all([
    admin
      .from("product_options")
      .select("product_id, option_set_id")
      .in("product_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("size_charts").select("option_set_id, product_id, columns, rows, note"),
  ]);
  const sizeSetIds = new Set((sizeSets ?? []).map((s) => s.id as string));
  const chartOf = (c: { columns: string[] | null; rows: unknown; note: string | null }): SizeChart => ({
    columns: c.columns ?? [],
    rows: Array.isArray(c.rows) ? (c.rows as SizeChart["rows"]) : [],
    note: c.note,
  });
  const chartByProduct = new Map<string, SizeChart>();
  const chartBySet = new Map<string, SizeChart>();
  for (const c of charts ?? []) {
    if (c.product_id) chartByProduct.set(c.product_id as string, chartOf(c));
    else if (c.option_set_id) chartBySet.set(c.option_set_id as string, chartOf(c));
  }
  const setOfProduct = new Map<string, string>();
  for (const po of productOptions ?? [])
    if (sizeSetIds.has(po.option_set_id as string))
      setOfProduct.set(po.product_id as string, po.option_set_id as string);

  // Last order per product.
  const last = new Map<string, ShopProduct["lastOrdered"]>();
  for (const o of (ordered ?? []) as {
    created_at: string;
    items: { product_id: string | null; variant_id: string | null; variant_label: string | null; quantity: number }[];
  }[]) {
    for (const i of o.items ?? []) {
      if (!i.product_id || last.has(i.product_id)) continue;
      last.set(i.product_id, {
        at: o.created_at,
        quantity: i.quantity,
        variantId: i.variant_id,
        variantLabel: i.variant_label,
      });
    }
  }

  const favoriteIds = new Set((favorites ?? []).map((f) => f.product_id as string));
  const kindOf = new Map(
    ((roleProducts ?? []) as { product_id: string; kind: string; quantity: number }[]).map((r) => [
      r.product_id,
      r,
    ]),
  );
  const roleApproval = !!(role as { requires_order_approval?: boolean } | null)?.requires_order_approval;
  const newSince = Date.now() - NEW_DAYS * 86400000;

  const rate = settings.creditRate;
  const products: ShopProduct[] = raw.map((p) => {
    const variants = p.variants ?? [];
    const size = axis(variants, SIZE_KEY);
    const color = axis(variants, COLOR_KEY);
    const mySize = size.values.find((v) => preferred.has(v)) ?? null;
    const mine = mySize ? variants.filter((v) => String(v.attributes?.[size.key!]) === mySize) : [];
    const myVariantId =
      variants.length === 1 ? variants[0]!.id : mine.length === 1 ? mine[0]!.id : null;
    const rp = kindOf.get(p.id);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      category_id: p.category_id,
      category_name: p.category?.name ?? null,
      images: [...(p.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
      euro: Number(p.base_price ?? 0),
      credits: effectiveCredits(p, null, rate),
      variants: variants.map((v) => ({
        id: v.id,
        attributes: v.attributes,
        euro: v.price_override != null ? Number(v.price_override) : Number(p.base_price ?? 0),
        credits: effectiveCredits(p, v, rate),
      })),
      cap: allowance.caps[p.id] ?? null,
      sizeKey: size.key,
      colorKey: color.key,
      sizes: size.values,
      colors: color.values,
      myVariantId,
      mySize,
      isNew: new Date(p.created_at).getTime() > newSince,
      leadTimeDays: p.lead_time_days,
      requiresProof: !!p.requires_proof,
      needsApproval: roleApproval || p.requires_approval_override === true,
      maxPerOrder: p.max_quantity_per_order,
      favorite: favoriteIds.has(p.id),
      lastOrdered: last.get(p.id) ?? null,
      roleKind: rp ? (rp.kind === "starterspakket" ? "starterspakket" : "aanbevolen") : null,
      kitQuantity: rp?.kind === "starterspakket" ? rp.quantity : null,
      sizeChart:
        chartByProduct.get(p.id) ??
        (setOfProduct.has(p.id) ? (chartBySet.get(setOfProduct.get(p.id)!) ?? null) : null),
    };
  });

  const catMap = new Map<string, string>();
  for (const p of products)
    if (p.category_id && p.category_name) catMap.set(p.category_id, p.category_name);

  return {
    settings,
    allowance,
    display: displayFor(settings, viewer.kind),
    products,
    categories: [...catMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    preferredSizes: [...preferred],
    missingSizes: (sizeSets ?? []).length > 0 && Object.values(userSizes).every((v) => !v),
    orderCount: (ordered ?? []).length,
  };
}
