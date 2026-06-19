import Link from "next/link";
import { ArrowLeft, Tags, ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/primitives";
import { NewCategoryDialog } from "./new-category-dialog";

export const dynamic = "force-dynamic";

type Cat = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  default_requires_approval: boolean;
  default_requires_proof: boolean;
  default_max_quantity: number | null;
  axes: { option_set: { name: string } | null }[];
};

export default async function CategoriesPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("categories")
    .select(
      "id, name, description, active, default_requires_approval, default_requires_proof, default_max_quantity, axes:category_option_sets(option_set:option_sets(name))",
    )
    .order("sort_order");

  const categories = (data ?? []) as unknown as Cat[];

  return (
    <div>
      <Link
        href="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Configuration
      </Link>
      <PageHeader
        title="Categories"
        description="Each category defines its option axes and default rules for products."
        action={<NewCategoryDialog />}
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Create your first product category."
          action={<NewCategoryDialog />}
        />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <Link key={c.id} href={`/admin/config/categories/${c.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:border-foreground/20">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    {!c.active ? <Badge variant="secondary">Inactive</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.axes.length ? (
                      c.axes.map((a, i) => (
                        <Badge key={i} variant="secondary">
                          {a.option_set?.name ?? "—"}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No option axes
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  {c.default_requires_approval ? <Badge variant="outline">Approval</Badge> : null}
                  {c.default_requires_proof ? <Badge variant="outline">Proof</Badge> : null}
                  {c.default_max_quantity ? (
                    <Badge variant="outline">Max {c.default_max_quantity}</Badge>
                  ) : null}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
