"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/format";
import { formatCredits } from "@/lib/ordering";
import {
  activeFilterCount,
  EMPTY_QUERY,
  PERIODS,
  type OrderQuery,
  type PeriodKey,
} from "@/lib/orders/filters";
import type { OverviewData } from "@/lib/orders/overview";
import { FilterSelect, Popover, type SelectOption } from "./popover";

export const STATUS_OPTIONS: SelectOption[] = [
  "pending_approval",
  "in_production",
  "shipped",
  "delivered",
  "rejected",
  "cancelled",
].map((s) => ({ id: s, name: ORDER_STATUS[s]?.label ?? s }));

export type Go = (patch: Partial<OrderQuery>) => void;

export function OrderFilters({
  data,
  query,
  go,
  pending,
}: {
  data: OverviewData;
  query: OrderQuery;
  go: Go;
  pending: boolean;
}) {
  const own = data.scope === "own";
  const admin = data.scope === "admin";
  const o = data.options;
  const [term, setTerm] = useState(query.zoek);
  const last = useRef(query.zoek);

  // Follow outside changes (chips, saved views) without fighting the user's typing.
  useEffect(() => {
    if (query.zoek !== last.current) {
      last.current = query.zoek;
      setTerm(query.zoek);
    }
  }, [query.zoek]);

  useEffect(() => {
    if (term.trim() === query.zoek) return;
    const t = setTimeout(() => {
      last.current = term.trim();
      go({ zoek: term.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const addressOptions: SelectOption[] = [
    ...o.addresses.map((a) => ({ id: a, name: a })),
    ...(o.hasCustom ? [{ id: "__custom", name: "Afwijkend adres" }] : []),
  ];
  const moreCount =
    (query.min || query.max ? 1 : 0) +
    (query.aanvraag ? 1 : 0) +
    (query.notitie ? 1 : 0) +
    (query.proef ? 1 : 0) +
    (query.goedgekeurd.length ? 1 : 0);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <PeriodPicker query={query} go={go} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={
              own
                ? "Zoek op bestelnummer of product"
                : "Zoek op bestelnummer, naam, product of maat"
            }
            className="h-9 pl-9"
            aria-label="Zoeken"
          />
          {pending ? (
            <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : term ? (
            <button
              type="button"
              aria-label="Zoekopdracht wissen"
              onClick={() => setTerm("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect label="Status" options={STATUS_OPTIONS} value={query.status} onChange={(status) => go({ status })} />
        {admin && o.companies.length ? (
          <FilterSelect label="Bedrijf" options={o.companies} value={query.bedrijf} onChange={(bedrijf) => go({ bedrijf, medewerker: [], functie: [], product: [] })} />
        ) : null}
        {!own ? (
          <FilterSelect label="Medewerker" options={o.people} value={query.medewerker} onChange={(medewerker) => go({ medewerker })} searchable />
        ) : null}
        {!own && o.roles.length ? (
          <FilterSelect label="Functie" options={o.roles} value={query.functie} onChange={(functie) => go({ functie })} />
        ) : null}
        {o.products.length ? (
          <FilterSelect label="Product" options={o.products} value={query.product} onChange={(product) => go({ product })} searchable />
        ) : null}
        {o.categories.length > 1 ? (
          <FilterSelect label="Categorie" options={o.categories} value={query.categorie} onChange={(categorie) => go({ categorie })} />
        ) : null}
        {addressOptions.length > 1 ? (
          <FilterSelect
            label="Leveradres"
            options={addressOptions}
            value={query.adres ? [query.adres] : []}
            onChange={(v) => go({ adres: v[0] ?? "" })}
            single
          />
        ) : null}
        <MoreFilters data={data} query={query} go={go} count={moreCount} />
      </div>

      <Chips data={data} query={query} go={go} />
    </div>
  );
}

function PeriodPicker({ query, go }: { query: OrderQuery; go: Go }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <NativeSelect
          value={query.periode}
          onChange={(e) => go({ periode: e.target.value as PeriodKey })}
          className="h-9 w-52 pl-9 font-medium"
          aria-label="Periode"
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {query.periode === "aangepast" ? (
        <div className="flex items-center gap-1.5 text-sm">
          <Input
            type="date"
            value={query.van}
            onChange={(e) => go({ van: e.target.value })}
            className="h-9 w-40"
            aria-label="Van"
          />
          <span className="text-muted-foreground">t/m</span>
          <Input
            type="date"
            value={query.tot}
            onChange={(e) => go({ tot: e.target.value })}
            className="h-9 w-40"
            aria-label="Tot en met"
          />
        </div>
      ) : null}
    </div>
  );
}

function MoreFilters({
  data,
  query,
  go,
  count,
}: {
  data: OverviewData;
  query: OrderQuery;
  go: Go;
  count: number;
}) {
  const [min, setMin] = useState(query.min);
  const [max, setMax] = useState(query.max);
  useEffect(() => {
    setMin(query.min);
    setMax(query.max);
  }, [query.min, query.max]);
  const credits = data.settings?.payment === "credits" && data.scope !== "admin";
  const hideMoney = data.display === "hidden";

  const toggle = (key: "aanvraag" | "notitie" | "proef", label: string) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
      <input
        type="checkbox"
        checked={query[key]}
        onChange={(e) => go({ [key]: e.target.checked })}
        className="h-4 w-4"
      />
      {label}
    </label>
  );

  return (
    <Popover
      className="w-80 p-3"
      trigger={({ open, toggle: t }) => (
        <button
          type="button"
          onClick={t}
          aria-expanded={open}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition",
            count ? "border-[var(--brand)] bg-[var(--brand)]/5 font-medium" : "hover:bg-muted",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Meer filters{count ? ` (${count})` : ""}
        </button>
      )}
    >
      <div className="space-y-3">
        {!hideMoney ? (
          <div>
            <p className="mb-1.5 text-sm font-medium">Bedrag {credits ? "in credits" : "in euro"}</p>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                go({ min: min.trim(), max: max.trim() });
              }}
            >
              <Input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="Van" className="h-9" />
              <span className="text-muted-foreground">–</span>
              <Input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="Tot" className="h-9" />
              <button type="submit" className="h-9 rounded-lg border px-3 text-sm hover:bg-muted">
                OK
              </button>
            </form>
          </div>
        ) : null}
        <div className="-mx-2">
          {toggle("aanvraag", "Aangevraagd buiten budget of maximum")}
          {toggle("notitie", "Met een notitie")}
          {toggle("proef", "Met een proef")}
        </div>
        {data.scope !== "own" && data.options.approvers.length ? (
          <div>
            <p className="mb-1.5 text-sm font-medium">Goedgekeurd door</p>
            <FilterSelect
              label="Goedkeurder"
              options={data.options.approvers}
              value={query.goedgekeurd}
              onChange={(goedgekeurd) => go({ goedgekeurd })}
            />
          </div>
        ) : null}
      </div>
    </Popover>
  );
}

function Chips({ data, query, go }: { data: OverviewData; query: OrderQuery; go: Go }) {
  const o = data.options;
  const names = (ids: string[], list: SelectOption[]) =>
    ids.map((id) => list.find((x) => x.id === id)?.name ?? "Onbekend").join(", ");
  const credits = data.settings?.payment === "credits" && data.scope !== "admin";
  const money = (v: string) =>
    credits ? formatCredits(Number(v.replace(",", "."))) : `€ ${v}`;

  const chips: { key: string; label: string; clear: Partial<OrderQuery> }[] = [];
  if (query.zoek) chips.push({ key: "zoek", label: `Zoekt "${query.zoek}"`, clear: { zoek: "" } });
  if (query.status.length)
    chips.push({ key: "status", label: `Status: ${names(query.status, STATUS_OPTIONS)}`, clear: { status: [] } });
  if (query.bedrijf.length)
    chips.push({ key: "bedrijf", label: `Bedrijf: ${names(query.bedrijf, o.companies)}`, clear: { bedrijf: [] } });
  if (query.medewerker.length)
    chips.push({ key: "medewerker", label: `Medewerker: ${names(query.medewerker, o.people)}`, clear: { medewerker: [] } });
  if (query.functie.length)
    chips.push({ key: "functie", label: `Functie: ${names(query.functie, o.roles)}`, clear: { functie: [] } });
  if (query.product.length)
    chips.push({ key: "product", label: `Product: ${names(query.product, o.products)}`, clear: { product: [] } });
  if (query.categorie.length)
    chips.push({ key: "categorie", label: `Categorie: ${names(query.categorie, o.categories)}`, clear: { categorie: [] } });
  if (query.adres)
    chips.push({
      key: "adres",
      label: `Leveradres: ${query.adres === "__custom" ? "afwijkend" : query.adres}`,
      clear: { adres: "" },
    });
  if (query.min || query.max)
    chips.push({
      key: "bedrag",
      label: `Bedrag ${query.min ? `vanaf ${money(query.min)}` : ""}${query.min && query.max ? " " : ""}${query.max ? `tot ${money(query.max)}` : ""}`,
      clear: { min: "", max: "" },
    });
  if (query.aanvraag) chips.push({ key: "aanvraag", label: "Aanvragen", clear: { aanvraag: false } });
  if (query.notitie) chips.push({ key: "notitie", label: "Met notitie", clear: { notitie: false } });
  if (query.proef) chips.push({ key: "proef", label: "Met proef", clear: { proef: false } });
  if (query.goedgekeurd.length)
    chips.push({
      key: "goedgekeurd",
      label: `Goedgekeurd door: ${names(query.goedgekeurd, o.approvers)}`,
      clear: { goedgekeurd: [] },
    });

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--brand)]/10 py-0.5 pr-1 pl-3 text-sm"
        >
          <span className="truncate">{c.label}</span>
          <button
            type="button"
            aria-label={`Filter ${c.label} verwijderen`}
            onClick={() => go(c.clear)}
            className="rounded-full p-0.5 hover:bg-[var(--brand)]/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {activeFilterCount(query) > 1 ? (
        <button
          type="button"
          onClick={() =>
            go({
              ...EMPTY_QUERY,
              periode: query.periode,
              van: query.van,
              tot: query.tot,
              weergave: query.weergave,
            })
          }
          className="px-2 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Alles wissen
        </button>
      ) : null}
    </div>
  );
}
