"use client";

import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

export type OptionSetRow = {
  id: string;
  name: string;
  kind: string;
  valueCount: number;
};

const KIND: Record<string, string> = {
  size: "Matensysteem",
  color: "Kleurpalet",
  text: "Kenmerk",
};

export function OptionsTable({ rows }: { rows: OptionSetRow[] }) {
  const columns: Column<OptionSetRow>[] = [
    {
      id: "name",
      header: "Naam",
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: "kind",
      header: "Type",
      cell: (r) => <Badge variant="secondary">{KIND[r.kind] ?? r.kind}</Badge>,
    },
    {
      id: "values",
      header: "Waarden",
      sortAccessor: (r) => r.valueCount,
      cell: (r) => r.valueCount,
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      searchAccessor={(r) => r.name}
      searchPlaceholder="Zoek optieset…"
      rowHref={(r) => `/admin/config/options/${r.id}`}
      emptyTitle="Geen optiesets gevonden"
    />
  );
}
