"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { variantLabel } from "@/lib/format";
import {
  AlertTriangle,
  Check,
  Clock,
  FileImage,
  History,
  Minus,
  Package,
  Plus,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/components/cart";
import { cn } from "@/lib/utils";
import { ProductImg } from "./product-img";
import { formatAmount, formatValue, type Display, type OrderingSettings } from "@/lib/ordering";
import type { PersonAllowance } from "@/lib/allowance";
import type { ShopProduct } from "@/lib/shop";
import { FavoriteButton, productBadges } from "./product-card";
import {
  capText,
  colorHex,
  priceText,
  shortVariant,
  useAddToCart,
  variantFor,
} from "./shop-utils";

export function ProductPanel({
  p,
  display,
  settings,
  allowance,
  canOrder,
  preview,
  manager,
  forName,
  onClose,
  onFavorite,
}: {
  p: ShopProduct;
  display: Display;
  settings: OrderingSettings;
  allowance: PersonAllowance;
  canOrder: boolean;
  preview: boolean;
  manager: boolean;
  /** First name of the employee when ordering on someone's behalf. */
  forName: string | null;
  onClose: () => void;
  onFavorite: (on: boolean) => void;
}) {
  const [image, setImage] = useState(0);
  const [size, setSize] = useState<string | null>(p.mySize ?? (p.sizes.length === 1 ? p.sizes[0]! : null));
  const [color, setColor] = useState<string | null>(p.colors.length === 1 ? p.colors[0]! : null);
  const [qty, setQty] = useState(p.kitQuantity ?? 1);
  const [matrix, setMatrix] = useState(false);
  const [chart, setChart] = useState(false);
  const add = useAddToCart();

  useEffect(() => {
    setImage(0);
    setSize(p.mySize ?? (p.sizes.length === 1 ? p.sizes[0]! : null));
    setColor(p.colors.length === 1 ? p.colors[0]! : null);
    setQty(p.kitQuantity ?? 1);
    setMatrix(false);
  }, [p]);

  // Products with attributes beyond size/colour fall back to a plain list.
  const simpleAxes = p.variants.every((v) =>
    Object.keys(v.attributes).every((k) => k === p.sizeKey || k === p.colorKey),
  );
  const [otherId, setOtherId] = useState<string>("");
  const variant = simpleAxes
    ? variantFor(p, { size, color })
    : (p.variants.find((v) => v.id === otherId) ?? (p.variants.length === 1 ? p.variants[0]! : null));
  const exists = (s: string, c: string | null) =>
    p.variants.some(
      (v) =>
        String(v.attributes[p.sizeKey!]) === s &&
        (!p.colorKey || !c || String(v.attributes[p.colorKey]) === c),
    );

  const max = p.maxPerOrder ?? 99;
  const badges = productBadges(p);
  const unitEuro = variant?.euro ?? p.euro;
  const unitCredits = variant?.credits ?? p.credits;
  const ready = canOrder && !preview && (variant || !p.variants.length);
  const who = forName ?? "je";

  return (
    <Sheet open onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent className="flex w-full flex-col p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{p.name}</SheetTitle>
          <SheetDescription>Productdetails en bestellen</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Galerij */}
          <div className="relative bg-[#f4f4f2]">
            <div className="relative mx-auto aspect-[4/5] max-h-[52vh]">
              {p.images[image] ? (
                <ProductImg src={p.images[image]!.url} alt={p.name} sizes="576px" className="p-6" priority />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Package className="h-10 w-10" />
                </div>
              )}
            </div>
            <FavoriteButton p={p} className="absolute top-3 left-3" onChange={onFavorite} />
          </div>
          {p.images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-5 pt-3">
              {p.images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  aria-label={`Toon foto ${i + 1}`}
                  onClick={() => setImage(i)}
                  className={cn(
                    "relative h-16 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-[#f4f4f2]",
                    i === image ? "border-[var(--brand)]" : "border-transparent",
                  )}
                >
                  <ProductImg src={img.url} alt="" sizes="56px" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-5 px-5 pt-4 pb-6">
            <div>
              {badges.length ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {badges.map((b) => (
                    <span
                      key={b.text}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                        b.tone === "amber" && "bg-amber-100 text-amber-900",
                        b.tone === "brand" && "bg-[var(--brand)] text-[var(--brand-foreground)]",
                        b.tone === "muted" && "bg-muted",
                      )}
                    >
                      {b.text}
                    </span>
                  ))}
                </div>
              ) : null}
              <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
              <p className="text-sm text-muted-foreground">{p.category_name}</p>
              {display !== "hidden" ? (
                <p className="mt-2 text-lg font-semibold">
                  {variant ? formatValue(unitEuro, unitCredits, display) : priceText(p, display)}
                </p>
              ) : null}
              {capText(p) ? (
                <p className={cn("text-sm", capText(p)!.full ? "font-medium text-amber-700" : "text-muted-foreground")}>
                  {capText(p)!.text}
                </p>
              ) : null}
            </div>

            {matrix ? (
              <SizeMatrix p={p} display={display} onDone={() => setMatrix(false)} />
            ) : (
              <>
                {simpleAxes && p.colors.length > 1 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">
                      Kleur{color ? <span className="font-normal text-muted-foreground">: {color}</span> : null}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {p.colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          aria-pressed={color === c}
                          className={cn(
                            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                            color === c ? "border-foreground ring-1 ring-foreground" : "hover:bg-muted",
                          )}
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-foreground/20"
                            style={{ background: colorHex(c) ?? "transparent" }}
                          />
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {simpleAxes && p.sizes.length > 1 ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Maat{size ? <span className="font-normal text-muted-foreground">: {size}</span> : null}
                      </p>
                      {p.sizeChart ? (
                        <button
                          type="button"
                          onClick={() => setChart(!chart)}
                          className="flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
                        >
                          <Ruler className="h-3.5 w-3.5" /> Maattabel
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.sizes.map((s) => {
                        const ok = exists(s, color);
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={!ok}
                            onClick={() => setSize(s)}
                            aria-pressed={size === s}
                            className={cn(
                              "relative min-w-12 rounded-lg border px-3 py-2 text-sm font-medium transition",
                              size === s
                                ? "border-foreground bg-foreground text-background"
                                : ok
                                  ? "hover:border-foreground/50"
                                  : "cursor-not-allowed text-muted-foreground line-through opacity-50",
                            )}
                          >
                            {s}
                            {p.mySize === s ? (
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-[var(--brand)] px-1 text-[9px] font-semibold whitespace-nowrap text-[var(--brand-foreground)]">
                                jouw maat
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {!p.mySize && !forName ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Tip:{" "}
                        <Link href="/profile" className="underline">
                          vul je standaardmaten in
                        </Link>
                        , dan staat je maat voortaan klaar.
                      </p>
                    ) : null}
                    {chart && p.sizeChart ? <ChartTable chart={p.sizeChart} highlight={size} /> : null}
                  </div>
                ) : null}

                {!simpleAxes && p.variants.length > 1 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">Uitvoering</p>
                    <div className="flex flex-wrap gap-2">
                      {p.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setOtherId(v.id)}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm",
                            otherId === v.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                          )}
                        >
                          {Object.values(v.attributes).map(String).join(", ")}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {p.sizes.length === 1 && simpleAxes ? (
                  <p className="text-sm text-muted-foreground">Formaat: {p.sizes[0]}</p>
                ) : null}

                {canOrder || preview ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-lg border">
                      <button
                        type="button"
                        aria-label="Minder"
                        onClick={() => setQty(Math.max(1, qty - 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-muted"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        value={qty}
                        onChange={(e) => setQty(Math.min(max, Math.max(1, Number(e.target.value) || 1)))}
                        inputMode="numeric"
                        aria-label="Aantal"
                        className="h-10 w-12 border-x bg-transparent text-center text-sm outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Meer"
                        onClick={() => setQty(Math.min(max, qty + 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {display !== "hidden" && variant && qty > 1 ? (
                      <span className="text-sm text-muted-foreground">
                        Samen {formatValue(unitEuro * qty, unitCredits * qty, display)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {p.maxPerOrder ? (
                  <p className="-mt-3 text-xs text-muted-foreground">Maximaal {p.maxPerOrder} per bestelling.</p>
                ) : null}

                <Consequence
                  p={p}
                  qty={qty}
                  unitEuro={unitEuro}
                  unitCredits={unitCredits}
                  settings={settings}
                  allowance={allowance}
                  display={display}
                  who={who}
                />
              </>
            )}

            <ul className="space-y-2 text-sm">
              {p.leadTimeDays ? (
                <Fact icon={Clock}>Levertijd ongeveer {p.leadTimeDays} werkdagen</Fact>
              ) : null}
              {p.requiresProof ? (
                <Fact icon={FileImage}>Je krijgt eerst een proef om goed te keuren</Fact>
              ) : null}
              {p.needsApproval ? (
                <Fact icon={ShieldCheck}>Deze bestelling gaat ter goedkeuring naar de leidinggevende</Fact>
              ) : null}
              {p.lastOrdered ? (
                <Fact icon={History}>
                  {forName ? `${forName} bestelde` : "Je bestelde"} eerder {p.lastOrdered.quantity}×
                  {p.lastOrdered.variantLabel ? ` ${shortVariant(p.lastOrdered.variantLabel)}` : ""} op{" "}
                  {new Date(p.lastOrdered.at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                </Fact>
              ) : null}
            </ul>

            {p.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{p.description}</p>
            ) : null}
          </div>
        </div>

        {!matrix && (canOrder || preview) ? (
          <div className="flex flex-wrap items-center gap-2 border-t bg-background px-5 py-3">
            {manager && !preview && simpleAxes && p.sizes.length > 1 ? (
              <Button variant="ghost" onClick={() => setMatrix(true)}>
                Meerdere maten tegelijk
              </Button>
            ) : null}
            <Button
              className="ml-auto min-w-44"
              disabled={!ready}
              onClick={() => {
                add(p, variant, qty);
                onClose();
              }}
            >
              <Plus className="h-4 w-4" />
              {preview
                ? "Voorbeeld: bestellen uit"
                : !variant && p.variants.length
                  ? p.sizes.length > 1 && !size
                    ? "Kies eerst een maat"
                    : "Kies eerst een uitvoering"
                  : "In winkelwagen"}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </li>
  );
}

function ChartTable({ chart, highlight }: { chart: NonNullable<ShopProduct["sizeChart"]>; highlight: string | null }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Maat</th>
            {chart.columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {chart.rows.map((r) => (
            <tr key={r.size} className={cn(highlight === r.size && "bg-[var(--brand)]/10 font-medium")}>
              <td className="px-3 py-1.5">{r.size}</td>
              {r.values.map((v, i) => (
                <td key={i} className="px-3 py-1.5">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {chart.note ? <p className="px-3 py-2 text-xs text-muted-foreground">{chart.note}</p> : null}
    </div>
  );
}

/** Live effect of this choice on budget, maximum and approval. */
function Consequence({
  p,
  qty,
  unitEuro,
  unitCredits,
  settings,
  allowance,
  display,
  who,
}: {
  p: ShopProduct;
  qty: number;
  unitEuro: number;
  unitCredits: number;
  settings: OrderingSettings;
  allowance: PersonAllowance;
  display: Display;
  who: string;
}) {
  const cart = useCart();
  const lines: { warn: boolean; text: string }[] = [];
  const inCartQty = cart.items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.qty, 0);

  const budget = allowance.budget;
  if (budget && settings.payment !== "none") {
    const credits = settings.payment === "credits";
    const cartTotal = credits ? cart.creditsSubtotal : cart.subtotal;
    const left = budget.remaining - cartTotal - (credits ? unitCredits : unitEuro) * qty;
    const hidden = display === "hidden";
    if (left >= 0)
      lines.push({
        warn: false,
        text: hidden
          ? "Past binnen het budget."
          : `Na deze bestelling: ${formatAmount(left, settings.payment)} over${cart.count ? " (inclusief je winkelwagen)" : ""}.`,
      });
    else
      lines.push({
        warn: true,
        text: `Dit gaat boven ${who === "je" ? "je" : `het budget van ${who}`}${who === "je" ? " budget" : ""} en wordt een aanvraag voor de leidinggevende.`,
      });
  }
  if (p.cap) {
    const left = p.cap.remaining - inCartQty - qty;
    lines.push(
      left >= 0
        ? { warn: false, text: `Na deze bestelling nog ${left} van ${p.cap.max} over.` }
        : { warn: true, text: "Boven het maximum: dit wordt een aanvraag voor de leidinggevende." },
    );
  }
  if (!lines.length) return null;

  return (
    <div className="space-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
      {lines.map((l, i) => (
        <p key={i} className={cn("flex items-start gap-2", l.warn && "text-amber-800")}>
          {l.warn ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          )}
          {l.text}
        </p>
      ))}
    </div>
  );
}

/** Managers: a quantity per size (and colour) in one go. */
function SizeMatrix({ p, display, onDone }: { p: ShopProduct; display: Display; onDone: () => void }) {
  const add = useAddToCart();
  const colors = p.colors.length ? p.colors : [null];
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = (s: string, c: string | null) => `${s}|${c ?? ""}`;
  const lines = useMemo(
    () =>
      Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => {
          const [s, c] = k.split("|");
          return { variant: variantFor(p, { size: s, color: c || null }), qty: n };
        })
        .filter((l) => l.variant),
    [counts, p],
  );
  const total = lines.reduce((s, l) => s + l.qty, 0);
  const euro = lines.reduce((s, l) => s + l.qty * l.variant!.euro, 0);
  const credits = lines.reduce((s, l) => s + l.qty * l.variant!.credits, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Aantal per maat</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-xs text-muted-foreground">
              {p.colors.length > 1 ? <th className="px-2 py-2 text-left font-medium">Kleur</th> : null}
              {p.sizes.map((s) => (
                <th key={s} className="px-1 py-2 font-medium">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((c) => (
              <tr key={c ?? "-"}>
                {p.colors.length > 1 ? <td className="px-2 py-1.5">{c}</td> : null}
                {p.sizes.map((s) => {
                  const ok = !!variantFor(p, { size: s, color: c });
                  return (
                    <td key={s} className="px-1 py-1.5 text-center">
                      <input
                        inputMode="numeric"
                        disabled={!ok}
                        aria-label={`Aantal ${s}${c ? ` ${c}` : ""}`}
                        value={counts[key(s, c)] ? String(counts[key(s, c)]) : ""}
                        placeholder={ok ? "0" : "–"}
                        onChange={(e) =>
                          setCounts({
                            ...counts,
                            [key(s, c)]: Math.min(999, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                          })
                        }
                        className="h-9 w-12 rounded-md border bg-transparent text-center outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {total} stuks{display !== "hidden" && total ? ` · ${formatValue(euro, credits, display)}` : ""}
        </span>
        <Button variant="ghost" className="ml-auto" onClick={onDone}>
          Terug
        </Button>
        <Button
          disabled={!total}
          onClick={() => {
            lines.forEach((l) => add(p, l.variant, l.qty, true));
            toast.success(`${total} stuks ${p.name} in je winkelwagen`, {
              description: lines.map((l) => `${l.qty}× ${shortVariant(variantLabel(l.variant!.attributes))}`).join(", "),
            });
            onDone();
          }}
        >
          <Plus className="h-4 w-4" /> {total} in winkelwagen
        </Button>
      </div>
    </div>
  );
}
