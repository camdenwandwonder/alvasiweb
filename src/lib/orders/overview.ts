import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { computeAllowances } from "@/lib/allowance";
import {
  displayFor,
  readOrderingSettings,
  type Display,
  type OrderingSettings,
} from "@/lib/ordering";
import { PAGE_SIZE, periodRange, type OrderQuery } from "./filters";

/** Who is looking: one's own orders, a whole company, or Alvasi across companies. */
export type OverviewScope =
  | { mode: "own"; companyId: string; userId: string; member: boolean }
  | { mode: "company"; companyId: string; userId: string }
  | { mode: "admin"; userId: string };

export type Option = { id: string; name: string; hint?: string };

export type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  credit_total: number;
  created_at: string;
  ordered_by: string;
  name: string;
  role_name: string | null;
  company: string | null;
  address: string | null;
  custom_address: boolean;
  is_request: boolean;
  has_note: boolean;
  items: { product_name: string; variant_label: string | null; quantity: number }[];
  quantity: number;
};

export type PersonRow = {
  id: string;
  name: string;
  email: string | null;
  role_name: string | null;
  company: string | null;
  active: boolean;
  orders: number;
  items: number;
  value: number;
  credits: number;
  last_at: string | null;
  lines: { product: string; variant: string | null; qty: number }[];
  budget: { used: number; total: number } | null;
};

export type ProductRow = {
  key: string;
  product_id: string | null;
  name: string;
  quantity: number;
  value: number;
  credits: number;
  buyers: number;
  variants: {
    label: string | null;
    quantity: number;
    buyers: { id: string; name: string; qty: number }[];
  }[];
};

export type Summary = {
  orders: number;
  activeOrders: number;
  value: number;
  credits: number;
  items: number;
  orderers: number;
  pending: number;
  pendingOutside: number;
  statusCounts: Record<string, number>;
};

export type SavedView = { id: string; name: string; query: string };

export type OverviewData = {
  scope: OverviewScope["mode"];
  companyId: string | null;
  range: { label: string; prevLabel: string | null; from: string | null; to: string | null };
  settings: OrderingSettings | null;
  display: Display;
  summary: Summary;
  previous: { orders: number; value: number; credits: number } | null;
  rows: OrderRow[];
  total: number;
  people: PersonRow[];
  products: ProductRow[];
  headcount: number | null;
  options: {
    people: Option[];
    roles: Option[];
    products: Option[];
    categories: Option[];
    companies: Option[];
    addresses: string[];
    hasCustom: boolean;
    approvers: Option[];
  };
  savedViews: SavedView[];
};

const num = (v: unknown) => Number(v ?? 0) || 0;

export function savedViewScope(scope: OverviewScope): string {
  return scope.mode === "admin" ? "admin" : scope.mode === "own" ? "own" : `company:${scope.companyId}`;
}

/** The jsonb filter object the database functions understand. */
export function filterObject(q: OrderQuery, scope: OverviewScope, unit: "euro" | "credits") {
  const range = periodRange(q);
  return {
    company: scope.mode === "admin" ? q.bedrijf : [scope.companyId],
    from: range.from?.toISOString() ?? null,
    to: range.to?.toISOString() ?? null,
    status: q.status,
    users: scope.mode === "own" ? [] : q.medewerker,
    roles: scope.mode === "own" ? [] : q.functie,
    products: q.product,
    categories: q.categorie,
    approvers: scope.mode === "own" ? [] : q.goedgekeurd,
    address: q.adres || null,
    unit,
    min: q.min ? q.min.replace(",", ".") : null,
    max: q.max ? q.max.replace(",", ".") : null,
    request: q.aanvraag,
    note: q.notitie,
    proof: q.proef,
    own: scope.mode === "own",
    q: q.zoek || null,
  };
}

function parseSummary(raw: Record<string, unknown> | null): Summary {
  const counts = (raw?.status_counts as Record<string, number> | undefined) ?? {};
  const pending = num(raw?.pending);
  return {
    orders: num(raw?.orders),
    activeOrders: num(raw?.active_orders),
    value: num(raw?.value),
    credits: num(raw?.credits),
    items: num(raw?.items),
    orderers: num(raw?.orderers),
    pending,
    pendingOutside: Math.max(0, num(raw?.pending_anytime) - num(counts.pending_approval)),
    statusCounts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, num(v)])),
  };
}

const ORDER_COLUMNS =
  "id, order_number, status, total, credit_total, created_at, ordered_by, ordered_by_name, role_name, ship_to_address, ship_to_city, ship_to_custom, is_request, note, company:companies(name), items:order_items(product_name, variant_label, quantity)";

type RawOrder = {
  id: string;
  order_number: string | null;
  status: string;
  total: number | null;
  credit_total: number | null;
  created_at: string;
  ordered_by: string;
  ordered_by_name: string | null;
  role_name: string | null;
  ship_to_address: string | null;
  ship_to_city: string | null;
  ship_to_custom: boolean | null;
  is_request: boolean | null;
  note: string | null;
  company: { name: string } | { name: string }[] | null;
  items: { product_name: string; variant_label: string | null; quantity: number }[] | null;
};

function mapOrder(o: RawOrder): OrderRow {
  const company = Array.isArray(o.company) ? o.company[0] : o.company;
  const items = o.items ?? [];
  return {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total: num(o.total),
    credit_total: num(o.credit_total),
    created_at: o.created_at,
    ordered_by: o.ordered_by,
    name: o.ordered_by_name ?? "Onbekend",
    role_name: o.role_name,
    company: company?.name ?? null,
    address: [o.ship_to_address, o.ship_to_city].filter(Boolean).join(", ") || null,
    custom_address: !!o.ship_to_custom,
    is_request: !!o.is_request,
    has_note: !!o.note?.trim(),
    items,
    quantity: items.reduce((s, i) => s + i.quantity, 0),
  };
}

/** Orders matching the selection (one page, or all of them for an export). */
export async function fetchOrders(
  f: ReturnType<typeof filterObject>,
  q: OrderQuery,
  page: { offset: number; limit: number },
): Promise<{ rows: OrderRow[]; total: number }> {
  const supabase = await createClient();
  const sortColumn =
    q.sorteer === "nummer"
      ? "order_number"
      : q.sorteer === "medewerker"
        ? "ordered_by_name"
        : q.sorteer === "bedrag"
          ? f.unit === "credits"
            ? "credit_total"
            : "total"
          : q.sorteer === "status"
            ? "status"
            : "created_at";
  const { data, count, error } = await supabase
    .rpc("order_search", { f }, { count: "exact" })
    .select(ORDER_COLUMNS)
    .order(sortColumn, { ascending: q.richting === "asc", nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(page.offset, page.offset + page.limit - 1);
  if (error) throw new Error(error.message);
  return { rows: ((data ?? []) as unknown as RawOrder[]).map(mapOrder), total: count ?? 0 };
}

export async function fetchPeople(f: ReturnType<typeof filterObject>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_by_person", { f });
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    user_id: string;
    name: string | null;
    role_name: string | null;
    company_id: string | null;
    orders: number;
    items: number;
    value: number;
    credits: number;
    last_at: string | null;
    lines: { product: string; variant: string | null; qty: number }[];
  }[];
}

export async function fetchProducts(f: ReturnType<typeof filterObject>): Promise<ProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_by_product", { f });
  if (error) throw new Error(error.message);
  const groups = new Map<string, ProductRow>();
  for (const r of (data ?? []) as {
    product_id: string | null;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    value: number;
    credits: number;
    buyers: { user_id: string; name: string | null; qty: number }[] | null;
  }[]) {
    const key = r.product_id ?? `naam:${r.product_name}`;
    const g =
      groups.get(key) ??
      ({
        key,
        product_id: r.product_id,
        name: r.product_name,
        quantity: 0,
        value: 0,
        credits: 0,
        buyers: 0,
        variants: [],
      } satisfies ProductRow);
    g.quantity += num(r.quantity);
    g.value += num(r.value);
    g.credits += num(r.credits);
    g.variants.push({
      label: r.variant_label,
      quantity: num(r.quantity),
      buyers: (r.buyers ?? []).map((b) => ({ id: b.user_id, name: b.name ?? "Onbekend", qty: num(b.qty) })),
    });
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      value: Math.round(g.value * 100) / 100,
      buyers: new Set(g.variants.flatMap((v) => v.buyers.map((b) => b.id))).size,
      variants: g.variants.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", "nl", { numeric: true })),
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

export async function fetchSummary(f: ReturnType<typeof filterObject>): Promise<Summary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_summary", { f });
  if (error) throw new Error(error.message);
  return parseSummary(data as Record<string, unknown> | null);
}

/** Everything one overview page needs. Call only after the page's permission gate. */
export async function loadOverview(scope: OverviewScope, q: OrderQuery): Promise<OverviewData> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const range = periodRange(q);

  const companyId = scope.mode === "admin" ? (q.bedrijf.length === 1 ? q.bedrijf[0]! : null) : scope.companyId;
  let settings: OrderingSettings | null = null;
  if (companyId) {
    const { data } = await admin.from("companies").select("settings").eq("id", companyId).maybeSingle();
    settings = readOrderingSettings((data?.settings as Record<string, unknown>) ?? {});
  }
  const display: Display =
    scope.mode === "admin"
      ? "euro"
      : displayFor(settings!, scope.mode === "own" && scope.member ? "member" : "manager");
  const unit = settings?.payment === "credits" && scope.mode !== "admin" ? "credits" : "euro";

  const f = filterObject(q, scope, unit);
  const prevF = range.prev
    ? { ...f, from: range.prev.from.toISOString(), to: range.prev.to.toISOString() }
    : null;

  const [summary, previous, view, options, savedViews] = await Promise.all([
    fetchSummary(f),
    prevF ? fetchSummary(prevF) : Promise.resolve(null),
    q.weergave === "medewerkers" && scope.mode !== "own"
      ? fetchPeople(f).then((p) => ({ kind: "people" as const, p }))
      : q.weergave === "producten"
        ? fetchProducts(f).then((p) => ({ kind: "products" as const, p }))
        : fetchOrders(f, q, { offset: (q.pagina - 1) * PAGE_SIZE, limit: PAGE_SIZE }).then((p) => ({
            kind: "orders" as const,
            p,
          })),
    loadOptions(scope, f),
    supabase
      .from("order_views")
      .select("id, name, query")
      .eq("scope", savedViewScope(scope))
      .order("name")
      .then(({ data }) => (data ?? []) as SavedView[]),
  ]);

  // People view: add everyone who did not order (company scope) and budgets.
  let people: PersonRow[] = [];
  if (view.kind === "people") {
    const companyName = new Map(options.companies.map((c) => [c.id, c.name]));
    people = view.p.map((r) => ({
      id: r.user_id,
      name: r.name ?? "Onbekend",
      email: null,
      role_name: r.role_name,
      company: r.company_id ? (companyName.get(r.company_id) ?? null) : null,
      active: true,
      orders: num(r.orders),
      items: num(r.items),
      value: num(r.value),
      credits: num(r.credits),
      last_at: r.last_at,
      lines: r.lines ?? [],
      budget: null,
    }));
    if (scope.mode === "company") {
      const byId = new Map(people.map((p) => [p.id, p]));
      const { data: everyone } = await admin
        .from("profiles")
        .select("id, full_name, email, status, role_id, role:roles(name)")
        .eq("company_id", scope.companyId);
      const roleFilter = new Set(q.functie);
      const userFilter = new Set(q.medewerker);
      for (const p of everyone ?? []) {
        const row = byId.get(p.id as string);
        const role = (Array.isArray(p.role) ? p.role[0] : p.role) as { name: string } | null;
        if (row) {
          row.email = (p.email as string | null) ?? null;
          row.active = p.status !== "disabled";
          continue;
        }
        if (!q.iedereen || p.status === "disabled") continue;
        if (roleFilter.size && !roleFilter.has(p.role_id as string)) continue;
        if (userFilter.size && !userFilter.has(p.id as string)) continue;
        people.push({
          id: p.id as string,
          name: (p.full_name as string | null) || (p.email as string | null) || "Onbekend",
          email: (p.email as string | null) ?? null,
          role_name: role?.name ?? null,
          company: null,
          active: true,
          orders: 0,
          items: 0,
          value: 0,
          credits: 0,
          last_at: null,
          lines: [],
          budget: null,
        });
      }
      if (settings && settings.payment !== "none") {
        const { byUser } = await computeAllowances(scope.companyId);
        for (const row of people) {
          const b = byUser.get(row.id)?.budget;
          if (b) row.budget = { used: b.used, total: b.total };
        }
      }
    }
    people.sort((a, b) => b.value - a.value || b.orders - a.orders || a.name.localeCompare(b.name, "nl"));
  }

  let headcount: number | null = null;
  if (scope.mode === "company") {
    let hq = admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", scope.companyId)
      .neq("status", "disabled");
    if (q.functie.length) hq = hq.in("role_id", q.functie);
    if (q.medewerker.length) hq = hq.in("id", q.medewerker);
    const { count } = await hq;
    headcount = count ?? 0;
  }

  return {
    scope: scope.mode,
    companyId,
    range: {
      label: range.label,
      prevLabel: range.prev?.label ?? null,
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    },
    settings,
    display,
    summary,
    previous: previous ? { orders: previous.activeOrders, value: previous.value, credits: previous.credits } : null,
    rows: view.kind === "orders" ? view.p.rows : [],
    total: view.kind === "orders" ? view.p.total : 0,
    people,
    products: view.kind === "products" ? view.p : [],
    headcount,
    options,
    savedViews,
  };
}

async function loadOptions(scope: OverviewScope, f: ReturnType<typeof filterObject>) {
  const admin = createAdminClient();
  const supabase = await createClient();
  const companyIds = scope.mode === "admin" ? (f.company.length ? f.company : null) : [scope.companyId];

  let peopleQ = admin.from("profiles").select("id, full_name, email, company_id").order("full_name");
  let rolesQ = admin.from("roles").select("id, name, company_id").order("name");
  let productsQ = admin
    .from("products")
    .select("id, name, company_id, category:categories(id, name)")
    .order("name");
  if (companyIds) {
    peopleQ = peopleQ.in("company_id", companyIds);
    rolesQ = rolesQ.in("company_id", companyIds);
    productsQ = productsQ.in("company_id", companyIds);
  }
  const own = scope.mode === "own";

  const [people, roles, products, companies, fromOrders] = await Promise.all([
    own ? Promise.resolve({ data: [] }) : peopleQ,
    own ? Promise.resolve({ data: [] }) : rolesQ,
    productsQ,
    scope.mode === "admin"
      ? admin.from("companies").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
    supabase.rpc("order_filter_options", { f: { company: f.company } }),
  ]);

  const companyName = new Map(
    ((companies.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );
  const multi = scope.mode === "admin" && !(companyIds && companyIds.length === 1);
  const cats = new Map<string, string>();
  for (const p of (products.data ?? []) as { category: unknown }[]) {
    const c = (Array.isArray(p.category) ? p.category[0] : p.category) as { id: string; name: string } | null;
    if (c) cats.set(c.id, c.name);
  }
  const opts = (fromOrders.data ?? {}) as {
    addresses?: string[];
    has_custom?: boolean;
    approvers?: { id: string; name: string }[];
  };

  return {
    people: ((people.data ?? []) as { id: string; full_name: string | null; email: string | null; company_id: string }[]).map(
      (p) => ({
        id: p.id,
        name: p.full_name || p.email || "Onbekend",
        hint: multi ? companyName.get(p.company_id) : (p.email ?? undefined),
      }),
    ),
    roles: ((roles.data ?? []) as { id: string; name: string; company_id: string }[]).map((r) => ({
      id: r.id,
      name: r.name,
      hint: multi ? companyName.get(r.company_id) : undefined,
    })),
    products: ((products.data ?? []) as { id: string; name: string; company_id: string }[]).map((p) => ({
      id: p.id,
      name: p.name,
      hint: multi ? companyName.get(p.company_id) : undefined,
    })),
    categories: [...cats.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    companies: [...companyName.entries()].map(([id, name]) => ({ id, name })),
    addresses: opts.addresses ?? [],
    hasCustom: !!opts.has_custom,
    approvers: opts.approvers ?? [],
  };
}
