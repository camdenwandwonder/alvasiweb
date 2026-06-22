import Link from "next/link";
import { ArrowLeft, Tags } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/primitives";
import { NewCategoryDialog } from "./new-category-dialog";
import { CategoriesTable, type CategoryRow } from "./categories-table";

export const dynamic = "force-dynamic";

type Raw = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  default_requires_approval: boolean;
  default_requires_proof: boolean;
  default_max_quantity: number | null;
  default_lead_time_days: number | null;
  axes: { option_set: { name: string } | null }[];
  products: { count: number }[];
};

export default async function CategoriesPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("categories")
    .select(
      "id, name, description, active, default_requires_approval, default_requires_proof, default_max_quantity, default_lead_time_days, axes:category_option_sets(option_set:option_sets(name)), products:products(count)",
    )
    .order("sort_order");

  const raw = (data ?? []) as unknown as Raw[];
  const rows: CategoryRow[] = raw.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    active: c.active,
    requiresApproval: c.default_requires_approval,
    requiresProof: c.default_requires_proof,
    maxQty: c.default_max_quantity,
    leadDays: c.default_lead_time_days,
    axes: c.axes.map((a) => a.option_set?.name ?? "").filter(Boolean),
    productCount: c.products?.[0]?.count ?? 0,
  }));

  return (
    <div>
      <Link
        href="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Configuratie
      </Link>
      <PageHeader
        title="Categorieën"
        description="Elke categorie bepaalt de optie-assen (maten/kleuren) en standaardregels voor producten."
        action={<NewCategoryDialog />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nog geen categorieën"
          description="Maak je eerste productcategorie aan."
          action={<NewCategoryDialog />}
        />
      ) : (
        <CategoriesTable rows={rows} />
      )}
    </div>
  );
}
