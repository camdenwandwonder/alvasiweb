"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue } from "@/lib/ordering";
import type { OrderQuery } from "@/lib/orders/filters";
import type { OverviewData, PersonRow } from "@/lib/orders/overview";
import { formatWhen, shortVariant } from "./orders-table";
import type { Go } from "./order-filters";

type Sort = "naam" | "bestellingen" | "artikelen" | "besteed" | "laatste";

export function PeopleView({
  data,
  query,
  go,
}: {
  data: OverviewData;
  query: OrderQuery;
  go: Go;
}) {
  const [sort, setSort] = useState<Sort>("besteed");
  const [asc, setAsc] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const company = data.scope === "company";
  const showMoney = data.display !== "hidden";
  const hasBudget = data.people.some((p) => p.budget);
  const unit = data.settings?.payment === "credits" ? "credits" : "euro";

  const rows = useMemo(() => {
    const val = (p: PersonRow) =>
      sort === "naam"
        ? p.name.toLowerCase()
        : sort === "bestellingen"
          ? p.orders
          : sort === "artikelen"
            ? p.items
            : sort === "laatste"
              ? (p.last_at ?? "")
              : unit === "credits"
                ? p.credits
                : p.value;
    return [...data.people].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name, "nl");
      return asc ? c : -c;
    });
  }, [data.people, sort, asc, unit]);

  const none = data.people.filter((p) => p.orders === 0).length;

  function head(s: Sort, label: string, right = false) {
    return (
      <th className={cn("px-3 py-2.5", right && "text-right")}>
        <button
          type="button"
          onClick={() => {
            if (sort === s) setAsc(!asc);
            else {
              setSort(s);
              setAsc(s === "naam");
            }
          }}
          className="inline-flex items-center gap-1 uppercase hover:text-foreground"
        >
          {label}
          {sort === s ? asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {company ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {[
            { v: true, label: "Iedereen" },
            { v: false, label: "Alleen wie besteld heeft" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => go({ iedereen: o.v })}
              className={cn(
                "rounded-full px-3 py-1 transition",
                query.iedereen === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
          {query.iedereen && none ? (
            <span className="ml-2 text-muted-foreground">
              {none} {none === 1 ? "medewerker heeft" : "medewerkers hebben"} in deze periode niets besteld
            </span>
          ) : null}
        </div>
      ) : null}

      {!rows.length ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-14 text-center">
          <Users className="mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-medium">Niemand gevonden</p>
          <p className="mt-1 text-sm text-muted-foreground">Er is niets besteld binnen deze periode en filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs font-medium tracking-wide text-muted-foreground">
                <th className="w-8" />
                {head("naam", "Medewerker")}
                {data.scope === "admin" ? <th className="px-3 py-2.5 uppercase">Bedrijf</th> : null}
                {head("bestellingen", "Bestellingen", true)}
                {head("artikelen", "Artikelen", true)}
                {showMoney ? head("besteed", "Besteed", true) : null}
                {hasBudget ? <th className="px-3 py-2.5 uppercase">Budget nu</th> : null}
                {head("laatste", "Laatste bestelling")}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => {
                const isOpen = open === p.id;
                return (
                  <PersonRows
                    key={p.id}
                    p={p}
                    data={data}
                    isOpen={isOpen}
                    showMoney={showMoney}
                    hasBudget={hasBudget}
                    onToggle={() => setOpen(isOpen ? null : p.id)}
                    onOrders={() => go({ medewerker: [p.id], weergave: "bestellingen" })}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PersonRows({
  p,
  data,
  isOpen,
  showMoney,
  hasBudget,
  onToggle,
  onOrders,
}: {
  p: PersonRow;
  data: OverviewData;
  isOpen: boolean;
  showMoney: boolean;
  hasBudget: boolean;
  onToggle: () => void;
  onOrders: () => void;
}) {
  const use = p.budget && p.budget.total > 0 ? Math.min(1, p.budget.used / p.budget.total) : null;
  const span = 5 + (data.scope === "admin" ? 1 : 0) + (showMoney ? 1 : 0) + (hasBudget ? 1 : 0);
  return (
    <>
      <tr
        onClick={p.orders ? onToggle : undefined}
        className={cn(p.orders ? "cursor-pointer hover:bg-muted/40" : "text-muted-foreground", isOpen && "bg-muted/40")}
      >
        <td className="pl-3">
          {p.orders ? (
            isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </td>
        <td className="px-3 py-2.5">
          <span className={cn("font-medium", !p.orders && "font-normal")}>{p.name}</span>
          {p.role_name ? <span className="block text-xs text-muted-foreground">{p.role_name}</span> : null}
        </td>
        {data.scope === "admin" ? <td className="px-3 py-2.5">{p.company ?? "—"}</td> : null}
        <td className="px-3 py-2.5 text-right tabular-nums">{p.orders || "–"}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{p.items || "–"}</td>
        {showMoney ? (
          <td className="px-3 py-2.5 text-right font-medium tabular-nums">
            {p.orders ? formatValue(p.value, p.credits, data.display) : "–"}
          </td>
        ) : null}
        {hasBudget ? (
          <td className="px-3 py-2.5">
            {use != null ? (
              <div className="w-28">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      use >= 1 ? "bg-red-500" : use >= 0.8 ? "bg-amber-500" : "bg-[var(--brand)]",
                    )}
                    style={{ width: `${Math.round(use * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{Math.round(use * 100)}% gebruikt</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Geen budget</span>
            )}
          </td>
        ) : null}
        <td className="px-3 py-2.5 whitespace-nowrap">
          {p.last_at ? formatWhen(p.last_at).date : <span className="text-amber-700">Nog niets besteld</span>}
        </td>
      </tr>
      {isOpen ? (
        <tr className="bg-muted/20">
          <td />
          <td colSpan={span - 1} className="px-3 pt-1 pb-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Besteld in deze periode
            </p>
            <div className="flex flex-wrap gap-1.5">
              {p.lines.map((l, i) => (
                <span key={i} className="rounded-md border bg-background px-2 py-1 text-sm">
                  <span className="font-medium">{l.qty}×</span> {l.product}
                  {l.variant ? <span className="text-muted-foreground"> · {shortVariant(l.variant)}</span> : null}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <button type="button" onClick={onOrders} className="font-medium text-[var(--brand)] hover:underline">
                Bekijk de {p.orders} {p.orders === 1 ? "bestelling" : "bestellingen"}
              </button>
              {data.scope === "company" ? (
                <Link href={`/personeel?persoon=${p.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                  Open op Personeel
                </Link>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
