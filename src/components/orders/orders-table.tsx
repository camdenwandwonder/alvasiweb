"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Columns3,
  Loader2,
  MessageSquare,
  Printer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/format";
import { formatValue } from "@/lib/ordering";
import { PAGE_SIZE, STATUS_TABS, type OrderQuery, type OrderSort } from "@/lib/orders/filters";
import type { OrderRow, OverviewData } from "@/lib/orders/overview";
import { decideOrders } from "@/lib/orders/actions";
import { Popover } from "./popover";
import type { Go } from "./order-filters";

type Column = "functie" | "inhoud" | "artikelen" | "bedrag" | "status" | "adres" | "bedrijf";
const COLUMN_LABEL: Record<Column, string> = {
  functie: "Functie",
  inhoud: "Inhoud",
  artikelen: "Artikelen",
  bedrag: "Bedrag",
  status: "Status",
  adres: "Leveradres",
  bedrijf: "Bedrijf",
};
const STORE_KEY = "bestellingen-kolommen";

export function contentText(items: OrderRow["items"], max = 3): string {
  const parts = items.map(
    (i) => `${i.quantity}× ${i.product_name}${i.variant_label ? ` (${shortVariant(i.variant_label)})` : ""}`,
  );
  return parts.length > max
    ? `${parts.slice(0, max).join(", ")} +${parts.length - max} meer`
    : parts.join(", ");
}

/** "Maat: L, Kleur: Navy" → "L, Navy". */
export function shortVariant(label: string): string {
  return label
    .split(",")
    .map((p) => p.split(":").pop()!.trim())
    .filter(Boolean)
    .join(", ");
}

export function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }),
    time: d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }),
  };
}

export function OrdersTable({
  data,
  query,
  go,
  canApprove,
  openId,
  onOpen,
}: {
  data: OverviewData;
  query: OrderQuery;
  go: Go;
  canApprove: boolean;
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  const own = data.scope === "own";
  const admin = data.scope === "admin";
  const showMoney = data.display !== "hidden";
  const available: Column[] = [
    ...(admin ? (["bedrijf"] as Column[]) : []),
    ...(own ? [] : (["functie"] as Column[])),
    "inhoud",
    "artikelen",
    ...(showMoney ? (["bedrag"] as Column[]) : []),
    "status",
    "adres",
  ];
  const [hidden, setHidden] = useState<Column[]>(["adres"]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
      if (Array.isArray(saved)) setHidden(saved);
    } catch {
      /* geen opgeslagen voorkeur */
    }
  }, []);
  function toggleColumn(c: Column) {
    const next = hidden.includes(c) ? hidden.filter((x) => x !== c) : [...hidden, c];
    setHidden(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* opslaan is optioneel */
    }
  }
  const cols = available.filter((c) => !hidden.includes(c));
  const show = (c: Column) => cols.includes(c);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [data]);
  const selectable = !own;
  const allChecked = data.rows.length > 0 && data.rows.every((r) => selected.has(r.id));

  const counts = data.summary.statusCounts;
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const activeTab =
    STATUS_TABS.find(
      (t) =>
        t.statuses.length > 0 &&
        t.statuses.length === query.status.length &&
        t.statuses.every((s) => query.status.includes(s)),
    )?.key ?? (query.status.length ? null : "alles");

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const first = data.total ? (query.pagina - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(data.total, query.pagina * PAGE_SIZE);

  function sortBy(s: OrderSort) {
    go({
      sorteer: s,
      richting: query.sorteer === s ? (query.richting === "asc" ? "desc" : "asc") : s === "medewerker" || s === "nummer" ? "asc" : "desc",
    });
  }
  const SortHead = ({ s, children, className }: { s: OrderSort; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2.5", className)}>
      <button
        type="button"
        onClick={() => sortBy(s)}
        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
      >
        {children}
        {query.sorteer === s ? (
          query.richting === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : null}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          {STATUS_TABS.map((t) => {
            const n = t.statuses.length ? t.statuses.reduce((s, k) => s + (counts[k] ?? 0), 0) : total;
            if (t.key !== "alles" && !n && activeTab !== t.key) return null;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => go({ status: t.statuses })}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-sm transition",
                  activeTab === t.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.label} <span className="opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <Popover
          align="right"
          className="w-56"
          trigger={({ toggle }) => (
            <Button variant="ghost" size="sm" onClick={toggle} className="hidden md:inline-flex">
              <Columns3 className="h-4 w-4" /> Kolommen
              {hidden.filter((h) => available.includes(h)).length
                ? ` (${hidden.filter((h) => available.includes(h)).length} verborgen)`
                : ""}
            </Button>
          )}
        >
          {available.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <input type="checkbox" checked={show(c)} onChange={() => toggleColumn(c)} className="h-4 w-4" />
              {COLUMN_LABEL[c]}
            </label>
          ))}
        </Popover>
      </div>

      {selected.size ? (
        <BulkBar
          rows={data.rows.filter((r) => selected.has(r.id))}
          canApprove={canApprove}
          onClear={() => setSelected(new Set())}
        />
      ) : null}

      {data.rows.length === 0 ? (
        <Empty query={query} go={go} outside={data.summary.pendingOutside} />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/60 text-left text-xs font-medium tracking-wide text-muted-foreground">
                  {selectable ? (
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Alles op deze pagina selecteren"
                        checked={allChecked}
                        onChange={() =>
                          setSelected(allChecked ? new Set() : new Set(data.rows.map((r) => r.id)))
                        }
                        className="h-4 w-4"
                      />
                    </th>
                  ) : null}
                  <SortHead s="nummer">Bestelling</SortHead>
                  <SortHead s="datum">Datum</SortHead>
                  {show("bedrijf") ? <th className="px-3 py-2.5 uppercase">Bedrijf</th> : null}
                  {!own ? <SortHead s="medewerker">Medewerker</SortHead> : null}
                  {show("inhoud") ? <th className="px-3 py-2.5 uppercase">Inhoud</th> : null}
                  {show("artikelen") ? <th className="px-3 py-2.5 text-right uppercase">Art.</th> : null}
                  {show("bedrag") ? <SortHead s="bedrag" className="text-right">Bedrag</SortHead> : null}
                  {show("status") ? <SortHead s="status">Status</SortHead> : null}
                  {show("adres") ? <th className="px-3 py-2.5 uppercase">Leveradres</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((o) => {
                  const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
                  const when = formatWhen(o.created_at);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => onOpen(o.id)}
                      className={cn(
                        "cursor-pointer align-top transition hover:bg-muted/40",
                        openId === o.id && "bg-[var(--brand)]/5",
                        selected.has(o.id) && "bg-muted/50",
                      )}
                    >
                      {selectable ? (
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Selecteer ${o.order_number ?? "bestelling"}`}
                            checked={selected.has(o.id)}
                            onChange={() =>
                              setSelected((s) => {
                                const n = new Set(s);
                                if (n.has(o.id)) n.delete(o.id);
                                else n.add(o.id);
                                return n;
                              })
                            }
                            className="h-4 w-4"
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-3 font-medium whitespace-nowrap">
                        {o.order_number ?? "Bestelling"}
                        <span className="mt-0.5 flex gap-1">
                          {o.is_request ? (
                            <span className="rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800">Aanvraag</span>
                          ) : null}
                          {o.has_note ? (
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" aria-label="Met notitie" />
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {when.date}
                        <span className="block text-xs text-muted-foreground">{when.time}</span>
                      </td>
                      {show("bedrijf") ? <td className="px-3 py-3">{o.company ?? "—"}</td> : null}
                      {!own ? (
                        <td className="px-3 py-3">
                          <span className="font-medium">{o.name}</span>
                          {show("functie") && o.role_name ? (
                            <span className="block text-xs text-muted-foreground">{o.role_name}</span>
                          ) : null}
                        </td>
                      ) : null}
                      {show("inhoud") ? (
                        <td className="max-w-md px-3 py-3 text-muted-foreground">
                          <span className="line-clamp-2">{contentText(o.items)}</span>
                        </td>
                      ) : null}
                      {show("artikelen") ? <td className="px-3 py-3 text-right tabular-nums">{o.quantity}</td> : null}
                      {show("bedrag") ? (
                        <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                          {formatValue(o.total, o.credit_total, data.display)}
                        </td>
                      ) : null}
                      {show("status") ? (
                        <td className="px-3 py-3 whitespace-nowrap">
                          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        </td>
                      ) : null}
                      {show("adres") ? (
                        <td className="px-3 py-3 text-muted-foreground">
                          {o.custom_address ? <span className="text-amber-700">Afwijkend: </span> : null}
                          {o.address ?? "—"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobiel */}
          <ul className="space-y-2 md:hidden">
            {data.rows.map((o) => {
              const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
              const when = formatWhen(o.created_at);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(o.id)}
                    className="w-full rounded-xl border bg-card p-3.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{o.order_number ?? "Bestelling"}</span>
                      <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {own ? "" : `${o.name} · `}
                      {when.date}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm">{contentText(o.items, 2)}</p>
                    {showMoney ? (
                      <p className="mt-1 text-sm font-medium">{formatValue(o.total, o.credit_total, data.display)}</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {first}–{last} van {data.total}
            </span>
            {pages > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Vorige pagina"
                  disabled={query.pagina <= 1}
                  onClick={() => go({ pagina: query.pagina - 1 })}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  Pagina {query.pagina} van {pages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Volgende pagina"
                  disabled={query.pagina >= pages}
                  onClick={() => go({ pagina: query.pagina + 1 })}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function BulkBar({
  rows,
  canApprove,
  onClear,
}: {
  rows: OrderRow[];
  canApprove: boolean;
  onClear: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const waiting = rows.filter((r) => r.status === "pending_approval");

  function decide(decision: "approve" | "reject") {
    start(async () => {
      const res = await decideOrders(
        waiting.map((r) => r.id),
        decision,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const verb = decision === "approve" ? "goedgekeurd" : "afgewezen";
      if (res.failed) toast.warning(`${res.done} ${verb}, ${res.failed} mislukt`);
      else toast.success(`${res.done} ${res.done === 1 ? "bestelling" : "bestellingen"} ${verb}`);
      onClear();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-3 py-2 text-sm">
      <span className="font-medium">{rows.length} geselecteerd</span>
      <span className="mx-1 h-5 w-px bg-border" />
      {canApprove && waiting.length ? (
        <>
          <Button size="sm" disabled={pending} onClick={() => decide("approve")}>
            <Check className="h-4 w-4" /> {waiting.length} goedkeuren
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("reject")}>
            <X className="h-4 w-4" /> Afwijzen
          </Button>
        </>
      ) : null}
      <a
        href={`/print/pakbon?ids=${rows.map((r) => r.id).join(",")}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-3 hover:bg-muted"
      >
        <Printer className="h-4 w-4" /> Pakbonnen
      </a>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        Selectie wissen
      </Button>
    </div>
  );
}

function Empty({ query, go, outside }: { query: OrderQuery; go: Go; outside: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ClipboardList className="h-5 w-5" />
      </span>
      <p className="font-medium">Geen bestellingen gevonden</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Er zijn geen bestellingen die passen bij deze periode en filters.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {query.periode !== "alles" ? (
          <Button variant="outline" size="sm" onClick={() => go({ periode: "alles" })}>
            Toon alle periodes
          </Button>
        ) : null}
        {outside ? (
          <Button variant="outline" size="sm" onClick={() => go({ periode: "alles", status: ["pending_approval"] })}>
            {outside} open buiten deze periode
          </Button>
        ) : null}
      </div>
    </div>
  );
}
