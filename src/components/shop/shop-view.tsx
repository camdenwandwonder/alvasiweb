"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, LayoutGrid, List, Megaphone, Package, Ruler, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImg } from "./product-img";
import type { ShopData, ShopProduct } from "@/lib/shop";
import { AllowanceChip } from "./allowance-chip";
import { ProductCard, type CardMode } from "./product-card";
import { ProductPanel } from "./product-panel";
import { ProductRow } from "./product-row";
import { RecipientSwitch, type RecipientOption } from "./recipient-switch";
import { priceText, useAddToCart } from "./shop-utils";

type Sort = "aanbevolen" | "naam" | "prijs-op" | "prijs-af";
type View = "raster" | "lijst";
const PAGE = 40;
const VIEW_KEY = "winkel-weergave";

export type ShopInitial = {
  categorie?: string;
  maat?: string;
  zoek?: string;
  sorteer?: string;
  product?: string;
  weergave?: string;
};

export function ShopView({
  data,
  canOrder,
  preview = false,
  manager,
  forName = null,
  canRequest,
  title,
  description,
  recipients,
  announcement = null,
  initial = {},
}: {
  data: ShopData;
  canOrder: boolean;
  preview?: boolean;
  manager: boolean;
  /** First name of the employee a manager orders for. */
  forName?: string | null;
  canRequest: boolean;
  title: string;
  description: string;
  /** Managers who may order for others: the people to choose from. */
  recipients?: { people: RecipientOption[]; current: { id: string; name: string } | null };
  initial?: ShopInitial;
  /** Company announcement shown above the shop (already date-checked). */
  announcement?: string | null;
}) {
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const products = useMemo(
    () => data.products.map((p) => (p.id in favs ? { ...p, favorite: favs[p.id]! } : p)),
    [data.products, favs],
  );

  const favoritesOnLoad = useMemo(
    () => new Set(data.products.filter((p) => p.favorite).map((p) => p.id)),
    [data.products],
  );

  const sizeOptions = useMemo(() => {
    const seen: string[] = [];
    for (const p of products) if (p.sizes.length > 1) for (const s of p.sizes) if (!seen.includes(s)) seen.push(s);
    return seen;
  }, [products]);
  const mySize = data.preferredSizes.find((s) => sizeOptions.includes(s)) ?? null;

  const [term, setTerm] = useState(initial.zoek ?? "");
  const [category, setCategory] = useState(initial.categorie ?? "");
  const [size, setSize] = useState<string>(
    initial.maat === "alle" ? "" : (initial.maat ?? mySize ?? ""),
  );
  const [sort, setSort] = useState<Sort>(
    (["aanbevolen", "naam", "prijs-op", "prijs-af"].includes(initial.sorteer ?? "")
      ? initial.sorteer
      : "aanbevolen") as Sort,
  );
  const [view, setView] = useState<View>(initial.weergave === "lijst" ? "lijst" : "raster");
  const [open, setOpen] = useState<string | null>(initial.product ?? null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (initial.weergave) return;
    try {
      if (localStorage.getItem(VIEW_KEY) === "lijst") setView("lijst");
    } catch {
      /* geen voorkeur */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the selection in the link (back button, sharing) without a reload.
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set("zoek", term.trim() || null);
    set("categorie", category || null);
    set("maat", size === (mySize ?? "") ? null : size || "alle");
    set("sorteer", sort === "aanbevolen" ? null : sort);
    set("weergave", view === "lijst" ? "lijst" : null);
    set("product", open);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [term, category, size, sort, view, open, mySize]);

  useEffect(() => setLimit(PAGE), [term, category, size, sort]);

  const priced = data.display !== "hidden";
  const unitOf = (p: ShopProduct) => {
    const v = p.variants[0] ?? p;
    return data.display === "credits" ? v.credits : v.euro;
  };
  const q = term.trim().toLowerCase();
  const matches = (p: ShopProduct) =>
    !q ||
    [p.name, p.category_name, p.description, p.colors.join(" "), p.sizes.join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);

  const shown = useMemo(() => {
    const list = products.filter(
      (p) =>
        matches(p) &&
        (!category ||
          (category === "__fav" ? p.favorite : category === "__rol" ? !!p.roleKind : p.category_id === category)) &&
        (!size || p.sizes.length <= 1 || p.sizes.includes(size)),
    );
    const byName = (a: ShopProduct, b: ShopProduct) => a.name.localeCompare(b.name, "nl");
    // Favourites as they were on load, so marking one doesn't make it jump.
    const score = (p: ShopProduct) =>
      (p.roleKind ? 8 : 0) +
      (favoritesOnLoad.has(p.id) ? 4 : 0) +
      (p.lastOrdered ? 2 : 0) +
      (p.isNew ? 1 : 0);
    return [...list].sort((a, b) =>
      sort === "naam"
        ? byName(a, b)
        : sort === "prijs-op" && priced
          ? unitOf(a) - unitOf(b) || byName(a, b)
          : sort === "prijs-af" && priced
            ? unitOf(b) - unitOf(a) || byName(a, b)
            : score(b) - score(a) || byName(a, b),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, q, category, size, sort, priced, favoritesOnLoad]);

  const counts = useMemo(() => {
    const base = products.filter((p) => matches(p) && (!size || p.sizes.length <= 1 || p.sizes.includes(size)));
    const by = new Map<string, number>();
    for (const p of base) if (p.category_id) by.set(p.category_id, (by.get(p.category_id) ?? 0) + 1);
    return {
      all: base.length,
      fav: base.filter((p) => p.favorite).length,
      rol: base.filter((p) => p.roleKind).length,
      by,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, q, size]);

  const plain = !q && !category;
  const kit = products.filter((p) => p.roleKind === "starterspakket");
  const recommended = products.filter((p) => p.roleKind === "aanbevolen");
  const reorder = [...products]
    .filter((p) => p.lastOrdered)
    .sort((a, b) => b.lastOrdered!.at.localeCompare(a.lastOrdered!.at))
    .slice(0, 10);
  const opened = open ? products.find((p) => p.id === open) : undefined;

  const card = (p: ShopProduct, mode: CardMode = "grid") => (
    <ProductCard
      key={`${mode}-${p.id}`}
      p={p}
      display={data.display}
      canOrder={canOrder}
      preview={preview}
      mode={mode}
      onOpen={() => setOpen(p.id)}
      onFavorite={(on) => setFavs((f) => ({ ...f, [p.id]: on }))}
    />
  );

  return (
    <div className="@container">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* In the shop itself the budget sits in the header; the preview has no header. */}
          {preview ? (
            <AllowanceChip
              settings={data.settings}
              allowance={data.allowance}
              canRequest={false}
              forName={forName}
            />
          ) : null}
          {recipients && recipients.people.length ? (
            <RecipientSwitch people={recipients.people} current={recipients.current} />
          ) : null}
        </div>
      </div>

      {announcement ? (
        <div
          role="note"
          className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-2.5 text-sm"
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
          <p className="whitespace-pre-line">{announcement}</p>
        </div>
      ) : null}

      {/* Plakkende balk */}
      <div className="-mx-4 mb-5 space-y-2.5 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:sticky md:top-14 md:z-20 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            term={term}
            setTerm={setTerm}
            products={products}
            display={data.display}
            onPick={(id) => setOpen(id)}
          />
          {sizeOptions.length ? (
            <SelectChip
              icon={Ruler}
              value={size}
              onChange={setSize}
              label={size ? `Maat: ${size}${size === mySize ? " (jouw maat)" : ""}` : "Alle maten"}
              options={[
                { value: "", label: "Alle maten" },
                ...sizeOptions.map((s) => ({ value: s, label: s === mySize ? `${s} (jouw maat)` : s })),
              ]}
              active={!!size}
            />
          ) : null}
          <SelectChip
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            label={
              sort === "naam"
                ? "Naam A–Z"
                : sort === "prijs-op"
                  ? "Prijs laag–hoog"
                  : sort === "prijs-af"
                    ? "Prijs hoog–laag"
                    : "Aanbevolen"
            }
            options={[
              { value: "aanbevolen", label: "Aanbevolen voor jou" },
              { value: "naam", label: "Naam A–Z" },
              ...(priced
                ? [
                    { value: "prijs-op", label: "Prijs laag–hoog" },
                    { value: "prijs-af", label: "Prijs hoog–laag" },
                  ]
                : []),
            ]}
          />
          <div className="ml-auto flex rounded-lg border p-0.5" role="group" aria-label="Weergave">
            {(
              [
                { v: "raster", icon: LayoutGrid, label: "Raster" },
                { v: "lijst", icon: List, label: "Lijst" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={view === o.v}
                aria-label={o.label}
                title={o.label}
                onClick={() => {
                  setView(o.v);
                  try {
                    localStorage.setItem(VIEW_KEY, o.v);
                  } catch {
                    /* optioneel */
                  }
                }}
                className={cn(
                  "flex h-8 w-9 items-center justify-center rounded-md transition",
                  view === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <o.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Chip active={!category} onClick={() => setCategory("")}>
            Alles <span className="opacity-60">{counts.all}</span>
          </Chip>
          {counts.rol ? (
            <Chip active={category === "__rol"} onClick={() => setCategory("__rol")}>
              Voor {forName ? `${forName}` : "jouw functie"} <span className="opacity-60">{counts.rol}</span>
            </Chip>
          ) : null}
          {data.categories.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.name} <span className="opacity-60">{counts.by.get(c.id) ?? 0}</span>
            </Chip>
          ))}
          {counts.fav || category === "__fav" ? (
            <Chip active={category === "__fav"} onClick={() => setCategory("__fav")}>
              Favorieten <span className="opacity-60">{counts.fav}</span>
            </Chip>
          ) : null}
        </div>
      </div>

      {plain ? (
        <>
          {kit.length ? (
            <KitShelf
              products={kit}
              welcome={data.orderCount === 0}
              forName={forName}
              canOrder={canOrder && !preview}
              render={(p) => card(p, "shelf")}
            />
          ) : null}
          {recommended.length ? (
            <Shelf title={forName ? `Aanbevolen voor de functie van ${forName}` : "Aanbevolen voor jouw functie"}>
              {recommended.map((p) => card(p, "shelf"))}
            </Shelf>
          ) : null}
          {reorder.length && canOrder ? (
            <Shelf title={forName ? `Eerder besteld door ${forName}` : "Eerder besteld"}>
              {reorder.map((p) => card(p, "reorder"))}
            </Shelf>
          ) : null}
        </>
      ) : null}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">
          {plain && (kit.length || recommended.length || reorder.length) ? "Alle producten " : ""}
          <span className="font-normal text-muted-foreground">
            {shown.length} {shown.length === 1 ? "product" : "producten"}
          </span>
        </h2>
        {size && size === mySize ? (
          <p className="text-xs text-muted-foreground">Producten in één formaat blijven zichtbaar</p>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Package className="mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-medium">Geen producten gevonden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length === 0 ? "Er zijn (nog) geen producten beschikbaar." : "Pas je zoekopdracht of filters aan."}
          </p>
          {products.length ? (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                setCategory("");
                setSize("");
              }}
              className="mt-4 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Alle filters wissen
            </button>
          ) : null}
        </div>
      ) : view === "lijst" ? (
        <ul className="divide-y rounded-xl border bg-card">
          {shown.slice(0, limit).map((p) => (
            <ProductRow
              key={p.id}
              p={p}
              display={data.display}
              canOrder={canOrder}
              preview={preview}
              onOpen={() => setOpen(p.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5 sm:gap-4">
          {shown.slice(0, limit).map((p) => card(p))}
        </div>
      )}

      {shown.length > limit ? (
        <div className="mt-6 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => setLimit(limit + PAGE)}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Meer laden
          </button>
          <span className="text-xs text-muted-foreground">
            {limit} van {shown.length}
          </span>
        </div>
      ) : null}

      {opened ? (
        <ProductPanel
          p={opened}
          display={data.display}
          settings={data.settings}
          allowance={data.allowance}
          canOrder={canOrder}
          preview={preview}
          manager={manager}
          forName={forName}
          onClose={() => setOpen(null)}
          onFavorite={(on) => setFavs((f) => ({ ...f, [opened.id]: on }))}
        />
      ) : null}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "bg-background hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function SelectChip({
  value,
  onChange,
  label,
  options,
  icon: Icon,
  active,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
  icon?: typeof Ruler;
  active?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition hover:bg-muted",
        active && "border-[var(--brand)] bg-[var(--brand)]/5 font-medium",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span className="whitespace-nowrap">{label}</span>
      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchBox({
  term,
  setTerm,
  products,
  display,
  onPick,
}: {
  term: string;
  setTerm: (t: string) => void;
  products: ShopProduct[];
  display: ShopData["display"];
  onPick: (id: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const q = term.trim().toLowerCase();
  const hits = q ? products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6) : [];

  return (
    <div
      ref={box}
      className="relative w-full sm:w-80"
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) setFocus(false);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setFocus(true)}
        onKeyDown={(e) => e.key === "Escape" && setFocus(false)}
        placeholder="Zoek een product"
        aria-label="Zoek een product"
        className="h-9 w-full rounded-lg border bg-background pr-8 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {term ? (
        <button
          type="button"
          aria-label="Zoekopdracht wissen"
          onClick={() => setTerm("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {focus && hits.length ? (
        <ul className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setFocus(false);
                  onPick(p.id);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              >
                <span className="relative h-10 w-8 shrink-0 overflow-hidden rounded bg-[#f4f4f2]">
                  {p.images[0] ? <ProductImg src={p.images[0].url} alt="" sizes="32px" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.category_name}</span>
                </span>
                {priceText(p, display) ? (
                  <span className="text-xs text-muted-foreground">{priceText(p, display)}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Shelf({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">{children}</div>
    </section>
  );
}

function KitShelf({
  products,
  welcome,
  forName,
  canOrder,
  render,
}: {
  products: ShopProduct[];
  welcome: boolean;
  forName: string | null;
  canOrder: boolean;
  render: (p: ShopProduct) => React.ReactNode;
}) {
  const add = useAddToCart();
  function addAll() {
    const missing: string[] = [];
    let added = 0;
    for (const p of products) {
      const variant = p.myVariantId
        ? (p.variants.find((v) => v.id === p.myVariantId) ?? null)
        : p.variants.length === 1
          ? p.variants[0]!
          : null;
      if (p.variants.length && !variant) {
        missing.push(p.name);
        continue;
      }
      add(p, variant, p.kitQuantity ?? 1, true);
      added++;
    }
    if (added) toast.success(`${added} ${added === 1 ? "product" : "producten"} uit het starterspakket in je winkelwagen`);
    if (missing.length) toast.warning(`Kies nog een maat voor: ${missing.join(", ")}`);
  }

  return (
    <section
      className={cn(
        "mb-7 rounded-2xl border p-4",
        welcome && !forName ? "border-[var(--brand)]/30 bg-[var(--brand)]/5" : "bg-card",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[var(--brand)]" />
            {welcome && !forName
              ? "Welkom! Dit hoort bij jouw functie"
              : forName
                ? `Starterspakket voor ${forName}`
                : "Starterspakket voor jouw functie"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {products.reduce((s, p) => s + (p.kitQuantity ?? 1), 0)} stuks, in
            {forName ? ` de maat van ${forName}` : " jouw maat"} waar die bekend is.
          </p>
        </div>
        {canOrder ? (
          <button
            type="button"
            onClick={addAll}
            className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--brand-foreground)] hover:opacity-90"
          >
            Alles in winkelwagen
          </button>
        ) : null}
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">{products.map(render)}</div>
    </section>
  );
}
