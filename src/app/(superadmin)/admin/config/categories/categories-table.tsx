"use client";

import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  requiresApproval: boolean;
  requiresProof: boolean;
  maxQty: number | null;
  leadDays: number | null;
  axes: string[];
  productCount: number;
};

export function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  const columns: Column<CategoryRow>[] = [
    {
      id: "name",
      header: "Categorie",
      sortAccessor: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div>
          <div className="flex items-center gap-2 font-medium">
            {c.name}
            {!c.active ? <Badge variant="secondary">Inactief</Badge> : null}
          </div>
          {c.description ? (
            <div className="text-xs text-muted-foreground">{c.description}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "axes",
      header: "Optie-assen",
      cell: (c) =>
        c.axes.length ? (
          <div className="flex flex-wrap gap-1">
            {c.axes.map((a) => (
              <Badge key={a} variant="secondary">
                {a}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "rules",
      header: "Standaardregels",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.requiresApproval ? <Badge variant="outline">Goedkeuring</Badge> : null}
          {c.requiresProof ? <Badge variant="outline">Proef</Badge> : null}
          {c.maxQty ? <Badge variant="outline">Max {c.maxQty}</Badge> : null}
          {c.leadDays ? (
            <Badge variant="outline">{c.leadDays} dgn</Badge>
          ) : null}
          {!c.requiresApproval &&
          !c.requiresProof &&
          !c.maxQty &&
          !c.leadDays ? (
            <span className="text-xs text-muted-foreground">Geen</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "products",
      header: "Producten",
      sortAccessor: (c) => c.productCount,
      cell: (c) => c.productCount,
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      searchAccessor={(c) => `${c.name} ${c.description ?? ""}`}
      searchPlaceholder="Zoek categorie…"
      rowHref={(c) => `/admin/config/categories/${c.id}`}
      emptyTitle="Geen categorieën gevonden"
    />
  );
}
