import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { PageHeader } from "@/components/primitives";
import { ShopGrid, type ShopProduct } from "@/components/shop-grid";
import { getAllowance } from "@/lib/allowance";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

const PERIOD: Record<string, string> = {
  monthly: "deze maand",
  quarterly: "dit kwartaal",
  yearly: "dit jaar",
  once: "totaal",
};

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

  const [{ data }, allowance] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, description, base_price, credit_cost, category_id, category:categories(name), variants:product_variants(id, attributes, price_override), images:product_images(url, is_primary)",
      )
      .eq("status", "active")
      .order("name"),
    getAllowance(user),
  ]);

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

  const pct =
    allowance.hasLimit && allowance.total
      ? Math.min(100, Math.max(0, (allowance.used / allowance.total) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        title="Winkel"
        description="Blader door en bestel de producten van jouw bedrijf."
      />

      {allowance.hasLimit &&
      (allowance.mode === "euro" || allowance.mode === "credits") ? (
        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4 text-[var(--brand)]" /> Resterend{" "}
              {allowance.mode === "credits" ? "credits" : "budget"}
              {allowance.period ? ` (${PERIOD[allowance.period]})` : ""}
            </span>
            <span className="text-sm">
              <span className="font-semibold">
                {allowance.mode === "credits"
                  ? `${allowance.remaining} credits`
                  : formatPrice(allowance.remaining)}
              </span>{" "}
              <span className="text-muted-foreground">
                van{" "}
                {allowance.mode === "credits"
                  ? `${allowance.total} credits`
                  : formatPrice(allowance.total)}
              </span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--brand)]"
              style={{ width: `${100 - pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {allowance.mode === "quantity" && allowance.hasLimit ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4 text-[var(--brand)]" /> Je hebt een vast
          aantal per product. Het resterende aantal staat per product
          aangegeven.
        </div>
      ) : null}

      <ShopGrid
        products={products}
        categories={categories}
        canOrder={can(user, "orders.create")}
        mode={allowance.mode}
        perProduct={allowance.perProduct}
      />
    </div>
  );
}
