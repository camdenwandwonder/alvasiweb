"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue } from "@/lib/ordering";
import type { OverviewData, ProductRow } from "@/lib/orders/overview";
import { shortVariant } from "./orders-table";
import type { Go } from "./order-filters";

export function ProductsView({ data, go }: { data: OverviewData; go: Go }) {
  const [open, setOpen] = useState<string | null>(null);
  const showMoney = data.display !== "hidden";
  const own = data.scope === "own";
  const max = Math.max(1, ...data.products.map((p) => p.quantity));

  if (!data.products.length)
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed py-14 text-center">
        <Package className="mb-3 h-6 w-6 text-muted-foreground" />
        <p className="font-medium">Niets besteld</p>
        <p className="mt-1 text-sm text-muted-foreground">Er is niets besteld binnen deze periode en filters.</p>
      </div>
    );

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <th className="w-8" />
            <th className="px-3 py-2.5">Product</th>
            <th className="px-3 py-2.5 text-right">Aantal</th>
            <th className="px-3 py-2.5">Varianten en maten</th>
            {!own ? <th className="px-3 py-2.5 text-right">Medewerkers</th> : null}
            {showMoney ? <th className="px-3 py-2.5 text-right">Besteed</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.products.map((p) => (
            <ProductRows
              key={p.key}
              p={p}
              data={data}
              max={max}
              own={own}
              showMoney={showMoney}
              isOpen={open === p.key}
              onToggle={() => setOpen(open === p.key ? null : p.key)}
              onOrders={() =>
                p.product_id
                  ? go({ product: [p.product_id], weergave: "bestellingen" })
                  : go({ zoek: p.name, weergave: "bestellingen" })
              }
              onPerson={(id) => go({ medewerker: [id], weergave: "medewerkers" })}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductRows({
  p,
  data,
  max,
  own,
  showMoney,
  isOpen,
  onToggle,
  onOrders,
  onPerson,
}: {
  p: ProductRow;
  data: OverviewData;
  max: number;
  own: boolean;
  showMoney: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onOrders: () => void;
  onPerson: (id: string) => void;
}) {
  const span = 4 + (own ? 0 : 1) + (showMoney ? 1 : 0);
  return (
    <>
      <tr onClick={onToggle} className={cn("cursor-pointer align-top hover:bg-muted/40", isOpen && "bg-muted/40")}>
        <td className="pt-3 pl-3">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </td>
        <td className="px-3 py-2.5">
          <span className="font-medium">{p.name}</span>
          <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.round((p.quantity / max) * 100)}%` }} />
          </div>
        </td>
        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{p.quantity}</td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {p.variants.map((v, i) => (
              <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                {v.label ? shortVariant(v.label) : "Standaard"} <span className="font-semibold">{v.quantity}</span>
              </span>
            ))}
          </div>
        </td>
        {!own ? <td className="px-3 py-2.5 text-right tabular-nums">{p.buyers}</td> : null}
        {showMoney ? (
          <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">
            {formatValue(p.value, p.credits, data.display)}
          </td>
        ) : null}
      </tr>
      {isOpen ? (
        <tr className="bg-muted/20">
          <td />
          <td colSpan={span - 1} className="px-3 pt-1 pb-4">
            {!own ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {p.variants.map((v, i) => (
                  <div key={i} className="rounded-lg border bg-background p-3">
                    <p className="mb-1.5 text-sm font-medium">
                      {v.label ? shortVariant(v.label) : "Standaard"}{" "}
                      <span className="font-normal text-muted-foreground">· {v.quantity} stuks</span>
                    </p>
                    <ul className="space-y-0.5 text-sm">
                      {v.buyers.map((b) => (
                        <li key={b.id} className="flex justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onPerson(b.id)}
                            className="truncate text-left hover:underline"
                          >
                            {b.name}
                          </button>
                          <span className="tabular-nums text-muted-foreground">{b.qty}×</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
            <button type="button" onClick={onOrders} className="mt-3 text-sm font-medium text-[var(--brand)] hover:underline">
              Bekijk de bestellingen met dit product
            </button>
          </td>
        </tr>
      ) : null}
    </>
  );
}
