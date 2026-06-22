"use client";

import { DataTable, type Column } from "@/components/data-table";

export type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  productCount: number;
  userCount: number;
};

export function CompaniesTable({ companies }: { companies: CompanyRow[] }) {
  const columns: Column<CompanyRow>[] = [
    {
      id: "name",
      header: "Bedrijf",
      sortAccessor: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div className="flex items-center gap-3">
          {c.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.logo_url}
              alt=""
              className="h-8 w-8 rounded-md object-contain"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ background: c.primary_color }}
            >
              {c.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-medium">{c.name}</div>
            <div className="text-xs text-muted-foreground">/{c.slug}</div>
          </div>
        </div>
      ),
    },
    {
      id: "products",
      header: "Producten",
      sortAccessor: (c) => c.productCount,
      cell: (c) => c.productCount,
    },
    {
      id: "users",
      header: "Gebruikers",
      sortAccessor: (c) => c.userCount,
      cell: (c) => c.userCount,
    },
    {
      id: "colors",
      header: "Huisstijl",
      cell: (c) => (
        <div className="flex gap-1.5">
          <span
            className="h-5 w-5 rounded-full border"
            style={{ background: c.primary_color }}
          />
          <span
            className="h-5 w-5 rounded-full border"
            style={{ background: c.secondary_color }}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={companies}
      columns={columns}
      searchAccessor={(c) => `${c.name} ${c.slug}`}
      searchPlaceholder="Zoek op naam of slug…"
      rowHref={(c) => `/admin/companies/${c.id}`}
      emptyTitle="Geen bedrijven gevonden"
    />
  );
}
