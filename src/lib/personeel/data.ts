import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { computeAllowances, type PersonAllowance } from "@/lib/allowance";
import type { OrderingSettings } from "@/lib/ordering";
import type { SizeSet } from "@/components/user-sizes-dialog";

export type PRole = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  requires_order_approval: boolean;
  welcome_amount: number | null;
  permissions: string[];
};

export type PPerson = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  role_id: string | null;
  sizes: Record<string, string> | null;
  created_at: string;
  last_order_at: string | null;
  order_count: number;
};

export type PBudget = {
  id: string;
  scope: "role" | "user";
  target_id: string;
  amount: number;
  period: string;
  kind: string;
};

export type PAllot = {
  id: string;
  scope: "role" | "user";
  target_id: string;
  product_id: string;
  max_quantity: number;
  period: string;
};

export type PProduct = {
  id: string;
  name: string;
  status: string;
  base_price: number | null;
  credit_cost: number | null;
  credit_cost_manual: boolean;
  category_id: string | null;
  variants: {
    id: string;
    label: string;
    price_override: number | null;
    credit_cost: number | null;
  }[];
};

export type PersoneelData = {
  companyId: string;
  companyName: string;
  settings: OrderingSettings;
  roles: PRole[];
  people: PPerson[];
  sizeSets: SizeSet[];
  budgets: PBudget[];
  allotments: PAllot[];
  products: PProduct[];
  categories: { id: string; name: string }[];
  /** category id → role ids allowed; absent = everyone. */
  visibility: Record<string, string[]>;
  allowances: Record<string, PersonAllowance>;
  pendingRequests: number;
  /** Assortment per functie: recommended products and the starter kit. */
  roleProducts: PRoleProduct[];
};

export type PRoleProduct = {
  role_id: string;
  product_id: string;
  kind: "aanbevolen" | "starterspakket";
  quantity: number;
  sort_order: number;
};

function variantLabel(attrs: Record<string, unknown> | null): string {
  if (!attrs) return "";
  return Object.entries(attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

/** Everything the Personeel workspace needs. Authorise before calling. */
export async function loadPersoneel(companyId: string): Promise<PersoneelData> {
  const admin = createAdminClient();

  const [
    { data: company },
    { data: roles },
    { data: people },
    { data: sizeSets },
    { data: budgets },
    { data: allotments },
    { data: products },
    { data: rules },
    { data: orders },
    { count: pendingRequests },
    allowanceResult,
    { data: roleProducts },
  ] = await Promise.all([
    admin.from("companies").select("name").eq("id", companyId).maybeSingle(),
    admin
      .from("roles")
      .select(
        "id, name, description, is_system, requires_order_approval, welcome_amount, perms:role_permissions(permission)",
      )
      .eq("company_id", companyId)
      .order("name"),
    admin
      .from("profiles")
      .select("id, full_name, email, status, role_id, sizes, created_at")
      .eq("company_id", companyId)
      .order("full_name"),
    admin
      .from("option_sets")
      .select("id, name, values:option_values(id, value, label, sort_order)")
      .eq("kind", "size")
      .order("name"),
    admin
      .from("budgets")
      .select("id, scope, target_id, amount, period, kind")
      .eq("company_id", companyId),
    admin
      .from("product_allotments")
      .select("id, scope, target_id, product_id, max_quantity, period")
      .eq("company_id", companyId),
    admin
      .from("products")
      .select(
        "id, name, status, base_price, credit_cost, credit_cost_manual, category_id, category:categories(id, name), variants:product_variants(id, attributes, price_override, credit_cost)",
      )
      .eq("company_id", companyId)
      .neq("status", "archived")
      .order("name"),
    admin
      .from("category_role_visibility")
      .select("category_id, role_id")
      .eq("company_id", companyId),
    admin
      .from("orders")
      .select("ordered_by, created_at")
      .eq("company_id", companyId)
      .not("status", "in", "(rejected,cancelled)"),
    admin
      .from("budget_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending"),
    computeAllowances(companyId),
    admin
      .from("role_products")
      .select("role_id, product_id, kind, quantity, sort_order")
      .eq("company_id", companyId)
      .order("sort_order"),
  ]);

  const lastOrder = new Map<string, string>();
  const orderCount = new Map<string, number>();
  for (const o of orders ?? []) {
    const id = o.ordered_by as string;
    orderCount.set(id, (orderCount.get(id) ?? 0) + 1);
    const prev = lastOrder.get(id);
    if (!prev || (o.created_at as string) > prev) lastOrder.set(id, o.created_at as string);
  }

  const categoryMap = new Map<string, string>();
  for (const p of products ?? []) {
    const c = p.category as unknown as { id: string; name: string } | null;
    if (c) categoryMap.set(c.id, c.name);
  }

  const visibility: Record<string, string[]> = {};
  for (const r of rules ?? []) {
    (visibility[r.category_id as string] ??= []).push(r.role_id as string);
  }

  return {
    companyId,
    companyName: (company?.name as string) ?? "",
    settings: allowanceResult.settings,
    roles: (roles ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      is_system: !!r.is_system,
      requires_order_approval: !!r.requires_order_approval,
      welcome_amount: r.welcome_amount != null ? Number(r.welcome_amount) : null,
      permissions: ((r.perms as { permission: string }[] | null) ?? []).map(
        (p) => p.permission,
      ),
    })),
    people: (people ?? []).map((p) => ({
      id: p.id as string,
      full_name: (p.full_name as string | null) ?? null,
      email: (p.email as string | null) ?? null,
      status: p.status as string,
      role_id: (p.role_id as string | null) ?? null,
      sizes: (p.sizes as Record<string, string> | null) ?? null,
      created_at: p.created_at as string,
      last_order_at: lastOrder.get(p.id as string) ?? null,
      order_count: orderCount.get(p.id as string) ?? 0,
    })),
    sizeSets: (sizeSets ?? []) as unknown as SizeSet[],
    budgets: (budgets ?? []).map((b) => ({
      id: b.id as string,
      scope: b.scope as "role" | "user",
      target_id: b.target_id as string,
      amount: Number(b.amount),
      period: b.period as string,
      kind: (b.kind as string) ?? "euro",
    })),
    allotments: (allotments ?? []).map((a) => ({
      id: a.id as string,
      scope: a.scope as "role" | "user",
      target_id: a.target_id as string,
      product_id: a.product_id as string,
      max_quantity: Number(a.max_quantity),
      period: a.period as string,
    })),
    products: (products ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      status: p.status as string,
      base_price: p.base_price != null ? Number(p.base_price) : null,
      credit_cost: p.credit_cost != null ? Number(p.credit_cost) : null,
      credit_cost_manual: !!p.credit_cost_manual,
      category_id: (p.category_id as string | null) ?? null,
      variants: (
        (p.variants as
          | {
              id: string;
              attributes: Record<string, unknown> | null;
              price_override: number | null;
              credit_cost: number | null;
            }[]
          | null) ?? []
      ).map((v) => ({
        id: v.id,
        label: variantLabel(v.attributes),
        price_override: v.price_override != null ? Number(v.price_override) : null,
        credit_cost: v.credit_cost != null ? Number(v.credit_cost) : null,
      })),
    })),
    categories: [...categoryMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    visibility,
    allowances: Object.fromEntries(allowanceResult.byUser),
    pendingRequests: pendingRequests ?? 0,
    roleProducts: (roleProducts ?? []).map((r) => ({
      role_id: r.role_id as string,
      product_id: r.product_id as string,
      kind: r.kind === "starterspakket" ? "starterspakket" : "aanbevolen",
      quantity: Number(r.quantity) || 1,
      sort_order: Number(r.sort_order) || 0,
    })),
  };
}
