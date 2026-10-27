"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Ruler, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteSizeChart,
  saveSizeChart,
  type SizeChartInput,
  type SizeChartTarget,
} from "@/lib/size-chart-actions";

const DEFAULT_COLUMNS = ["Borstomvang (cm)", "Lengte (cm)"];

/** Small table editor for one size chart (one row per size). */
export function SizeChartEditor({
  target,
  sizes,
  initial,
  emptyText,
}: {
  target: SizeChartTarget;
  /** Sizes to prefill (in order), e.g. the values of the size system. */
  sizes: string[];
  initial: SizeChartInput | null;
  emptyText?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!initial);
  const [columns, setColumns] = useState<string[]>(initial?.columns.length ? initial.columns : DEFAULT_COLUMNS);
  const [rows, setRows] = useState<{ size: string; values: string[] }[]>(() => {
    const base = initial?.rows ?? [];
    const known = new Set(base.map((r) => r.size));
    return [
      ...base,
      ...sizes.filter((s) => !known.has(s)).map((size) => ({ size, values: [] as string[] })),
    ];
  });
  const [note, setNote] = useState(initial?.note ?? "");
  const [pending, start] = useTransition();

  function setCell(i: number, c: number, value: string) {
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const values = [...r.values];
        values[c] = value;
        return { ...r, values };
      }),
    );
  }
  function removeColumn(c: number) {
    setColumns((cs) => cs.filter((_, j) => j !== c));
    setRows((rs) => rs.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== c) })));
  }

  function save() {
    start(async () => {
      const res = await saveSizeChart(target, { columns, rows, note: note || null });
      if (res.ok) {
        toast.success("Maattabel opgeslagen");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function remove() {
    start(async () => {
      const res = await deleteSizeChart(target);
      if (res.ok) {
        toast.success("Maattabel verwijderd");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!open)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Ruler className="h-4 w-4" /> {emptyText ?? "Nog geen maattabel."}
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Maattabel maken
        </Button>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="w-24 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Maat</th>
              {columns.map((c, i) => (
                <th key={i} className="px-1 py-1">
                  <div className="flex items-center gap-1">
                    <Input
                      value={c}
                      onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === i ? e.target.value : x)))}
                      className="h-8 min-w-28 text-xs font-medium"
                      aria-label={`Kolom ${i + 1}`}
                    />
                    {columns.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeColumn(i)}
                        aria-label="Kolom verwijderen"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="w-8 px-1">
                {columns.length < 8 ? (
                  <button
                    type="button"
                    onClick={() => setColumns((cs) => [...cs, "Nieuwe maat (cm)"])}
                    aria-label="Kolom toevoegen"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-1 py-1">
                  <Input
                    value={r.size}
                    onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))}
                    className="h-8 font-medium"
                    aria-label="Maat"
                  />
                </td>
                {columns.map((_, c) => (
                  <td key={c} className="px-1 py-1">
                    <Input
                      value={r.values[c] ?? ""}
                      onChange={(e) => setCell(i, c, e.target.value)}
                      placeholder="bijv. 96–100"
                      className="h-8"
                      aria-label={`${r.size} ${columns[c]}`}
                    />
                  </td>
                ))}
                <td className="px-1">
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    aria-label="Maat verwijderen"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rows.length < 30 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRows((rs) => [...rs, { size: "", values: [] }])}
          >
            <Plus className="h-3.5 w-3.5" /> Maat toevoegen
          </Button>
        ) : null}
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Toelichting, bijv. 'Valt klein: kies bij twijfel een maat groter'"
          className="h-9 min-w-64 flex-1"
          maxLength={300}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Opslaan
        </Button>
        {initial ? (
          <Button size="sm" variant="ghost" className="text-red-600" onClick={remove} disabled={pending}>
            <Trash2 className="h-4 w-4" /> Verwijderen
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuleren
          </Button>
        )}
      </div>
    </div>
  );
}
