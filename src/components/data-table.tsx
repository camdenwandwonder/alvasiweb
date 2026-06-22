"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/primitives";
import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortAccessor?: (row: T) => string | number;
  className?: string;
  headClassName?: string;
};

export type FilterDef<T> = {
  id: string;
  label: string;
  accessor: (row: T) => string | null | undefined;
  options: { value: string; label: string }[];
};

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchAccessor,
  searchPlaceholder = "Zoeken…",
  filters = [],
  rowHref,
  pageSize = 12,
  emptyTitle = "Niets gevonden",
  emptyDescription,
}: {
  data: T[];
  columns: Column<T>[];
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  rowHref?: (row: T) => string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(
    null,
  );
  const [page, setPage] = useState(0);

  const processed = useMemo(() => {
    let rows = data;
    const q = query.trim().toLowerCase();
    if (q && searchAccessor) {
      rows = rows.filter((r) => searchAccessor(r).toLowerCase().includes(q));
    }
    for (const f of filters) {
      const v = filterValues[f.id];
      if (v) rows = rows.filter((r) => (f.accessor(r) ?? "") === v);
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortAccessor) {
        rows = [...rows].sort((a, b) => {
          const av = col.sortAccessor!(a);
          const bv = col.sortAccessor!(b);
          if (av < bv) return sort.dir === "asc" ? -1 : 1;
          if (av > bv) return sort.dir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }
    return rows;
  }, [data, query, filterValues, filters, sort, columns, searchAccessor]);

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const pageRows = processed.slice(current * pageSize, current * pageSize + pageSize);

  const activeChips = filters
    .map((f) => ({ f, v: filterValues[f.id] }))
    .filter((x) => x.v);

  function toggleSort(id: string) {
    setSort((s) =>
      s?.id === id
        ? { id, dir: s.dir === "asc" ? "desc" : "asc" }
        : { id, dir: "asc" },
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {searchAccessor ? (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
          </div>
        ) : null}
        {filters.map((f) => (
          <NativeSelect
            key={f.id}
            value={filterValues[f.id] ?? ""}
            onChange={(e) => {
              setFilterValues((v) => ({ ...v, [f.id]: e.target.value }));
              setPage(0);
            }}
            className="h-9 w-auto"
          >
            <option value="">{f.label}: alle</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        ))}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {activeChips.map(({ f, v }) => {
            const opt = f.options.find((o) => o.value === v);
            return (
              <button
                key={f.id}
                onClick={() =>
                  setFilterValues((vals) => ({ ...vals, [f.id]: "" }))
                }
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs hover:bg-border"
              >
                {f.label}: {opt?.label ?? v}
                <X className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.id} className={c.headClassName}>
                  {c.sortAccessor ? (
                    <button
                      onClick={() => toggleSort(c.id)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.header}
                      {sort?.id === c.id ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-28 text-center">
                  <p className="font-medium">{emptyTitle}</p>
                  {emptyDescription ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {emptyDescription}
                    </p>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={
                    rowHref ? () => router.push(rowHref(row)) : undefined
                  }
                  className={cn(rowHref && "cursor-pointer")}
                >
                  {columns.map((c) => (
                    <TableCell key={c.id} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {processed.length > pageSize ? (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {processed.length} resultaten · pagina {current + 1} van {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Vorige
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Volgende
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
