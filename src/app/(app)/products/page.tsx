import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { PageHeader } from "@/components/primitives";
import { ShopGrid, type ShopProduct } from "@/components/shop-grid";
import { AllowanceBanner } from "@/components/allowance-banner";
import { getAllowance } from "@/lib/allowance";

export const dynamic = "force-dynamic";

type Raw = {
  id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  credit_cost: number | null;
  category_id: string | null;
  category: { name: string } | null;
  variants: ShopProduct["variants"];
  images: ShopProduct["images"];
};

export default async function ProductsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data }, allowance, { data: profile }, { data: sizeSets }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, description, base_price, credit_cost, category_id, category:categories(name), variants:product_variants(id, attributes, price_override), images:product_images(url, is_primary)",
        )
        .eq("status", "active")
        .order("name"),
      getAllowance(user),
      supabase.from("profiles").select("sizes").eq("id", user?.id ?? "").maybeSingle(),
      supabase
        .from("option_sets")
        .select("id, values:option_values(value, label)")
        .eq("kind", "size"),
    ]);

  // The member's preferred size values/labels — used to pre-select variants.
  const userSizes = (profile?.sizes as Record<string, string>) ?? {};
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
  const preferredSizes = [...preferred];

  let raw = (data ?? []) as unknown as Raw[];

  // Role-based catalog visibility (members only see allowed categories).
  if (user?.companyId && !can(user, "orders.view_all")) {
    const { data: rules } = await supabase
      .from("category_role_visibility")
      .select("category_id, role_id")
      .eq("company_id", user.companyId);
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
      return user.roleId ? set.has(user.roleId) : false;
    });
  }

  const products: ShopProduct[] = raw.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    base_price: p.base_price,
    credit_cost: p.credit_cost,
    category_id: p.category_id,
    category_name: p.category?.name ?? null,
    variants: p.variants ?? [],
    images: p.images ?? [],
  }));

  const catMap = new Map<string, string>();
  for (const p of products)
    if (p.category_id && p.category_name) catMap.set(p.category_id, p.category_name);
  const categories = [...catMap.entries()].map(([id, name]) => ({ id, name }));

  return (
    <div>
      <PageHeader
        title="Winkel"
        description="Blader door en bestel de producten van jouw bedrijf."
      />

      <AllowanceBanner allowance={allowance} />

      <ShopGrid
        products={products}
        categories={categories}
        canOrder={can(user, "orders.create")}
        mode={allowance.mode}
        perProduct={allowance.perProduct}
        preferredSizes={preferredSizes}
      />
    </div>
  );
}
