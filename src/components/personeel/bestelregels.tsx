"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Coins, Loader2, Settings2, Sparkles, Wallet, Ban, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  creditsFor,
  formatAmount,
  formatCredits,
  roundingGap,
  suggestRate,
  type PaymentMode,
} from "@/lib/ordering";
import { formatPrice } from "@/lib/format";
import { saveOrderingSettings } from "@/lib/personeel/actions";
import type { PersoneelData } from "@/lib/personeel/data";
import { CreditPricesDialog } from "./credit-prices";

const PAYMENT: Record<PaymentMode, { label: string; text: string; icon: typeof Wallet }> = {
  none: {
    label: "Geen budget",
    text: "Het bedrijf betaalt alles. Eventueel met een maximum per product.",
    icon: Ban,
  },
  euro: {
    label: "Budget in euro",
    text: "Medewerkers zien europrijzen en hebben een eurobudget per periode.",
    icon: Wallet,
  },
  credits: {
    label: "Budget in credits",
    text: "Medewerkers zien alleen credits. Jij bepaalt wat één credit waard is.",
    icon: Coins,
  },
};

export function BestelregelsBar({
  data,
  canEdit,
}: {
  data: PersoneelData;
  canEdit: boolean;
}) {
  const s = data.settings;
  const [open, setOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);

  const parts = [PAYMENT[s.payment].label];
  if (s.payment === "credits") parts.push(`1 credit = ${formatPrice(s.creditRate)}`);
  if (s.capsEnabled) parts.push("maximum per product aan");
  parts.push(
    s.approvalOver != null
      ? `goedkeuring boven ${formatAmount(s.approvalOver, s.payment)}`
      : "geen goedkeuringsdrempel",
  );

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
          <Settings2 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium">Bestelregels</p>
          <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>
        </div>
      </div>
      {canEdit ? (
        <div className="flex gap-2">
          {s.payment === "credits" ? (
            <Button variant="outline" size="sm" onClick={() => setPricesOpen(true)}>
              <Coins className="h-4 w-4" /> Creditprijzen
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setOpen(true)}>
            Wijzigen
          </Button>
        </div>
      ) : null}
      {open ? <OrderingDialog data={data} onClose={() => setOpen(false)} /> : null}
      {pricesOpen ? (
        <CreditPricesDialog data={data} onClose={() => setPricesOpen(false)} />
      ) : null}
    </div>
  );
}

function OrderingDialog({ data, onClose }: { data: PersoneelData; onClose: () => void }) {
  const s = data.settings;
  const [payment, setPayment] = useState<PaymentMode>(s.payment);
  const [rate, setRate] = useState(String(s.creditRate));
  const [capsEnabled, setCapsEnabled] = useState(s.capsEnabled);
  const [uncapped, setUncapped] = useState(s.uncapped);
  const [showPrice, setShowPrice] = useState(s.showPriceWithCaps);
  const [threshold, setThreshold] = useState(s.approvalOver != null ? String(s.approvalOver) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const prices = useMemo(
    () =>
      data.products.flatMap((p) => [
        Number(p.base_price ?? 0),
        ...p.variants.filter((v) => v.price_override != null).map((v) => Number(v.price_override)),
      ]),
    [data.products],
  );
  const suggested = suggestRate(prices);
  const rateNum = Number(rate.replace(",", "."));
  const rateOk = rateNum > 0;

  // Threshold follows the unit when switching between euro and credits.
  function choosePayment(next: PaymentMode) {
    const t = Number(threshold.replace(",", "."));
    if (threshold && t > 0) {
      if (payment !== "credits" && next === "credits" && rateOk)
        setThreshold(String(creditsFor(t, rateNum)));
      if (payment === "credits" && next !== "credits")
        setThreshold(String(Math.round(t * (rateOk ? rateNum : 1) * 100) / 100));
    }
    setPayment(next);
  }

  // What changes for existing budgets.
  const impact = useMemo(() => {
    const lines: string[] = [];
    const roleName = (id: string) =>
      data.roles.find((r) => r.id === id)?.name ??
      data.people.find((p) => p.id === id)?.full_name ??
      "medewerker";
    const from = s.payment;
    if ((from === "euro" && payment === "credits") || (from === "credits" && payment === "euro")) {
      const kind = from === "credits" ? "credits" : "euro";
      for (const b of data.budgets.filter((x) => (x.kind === "credits" ? "credits" : "euro") === kind)) {
        const to =
          payment === "credits"
            ? formatCredits(creditsFor(b.amount, rateOk ? rateNum : 1))
            : formatPrice(b.amount * s.creditRate);
        lines.push(
          `${roleName(b.target_id)}: ${formatAmount(b.amount, from)} wordt ${to}`,
        );
      }
    }
    if (from === "credits" && payment === "credits" && rateOk && Math.abs(rateNum - s.creditRate) > 1e-9) {
      const factor = s.creditRate / rateNum;
      for (const b of data.budgets.filter((x) => x.kind === "credits"))
        lines.push(
          `${roleName(b.target_id)}: ${formatCredits(b.amount)} wordt ${formatCredits(Math.ceil(b.amount * factor - 1e-9))}`,
        );
      lines.push("Alle creditprijzen worden opnieuw berekend; de eurowaarde blijft gelijk.");
    }
    if (from === "none" && payment !== "none")
      lines.push("Stel daarna per functie een budget in (tabblad Functies).");
    return lines;
  }, [data, payment, rateNum, rateOk, s]);

  // Example with the organisation's own products.
  const example = useMemo(() => {
    if (payment !== "credits" || !rateOk) return null;
    const list = [...data.products]
      .filter((p) => Number(p.base_price ?? 0) > 0)
      .sort((a, b) => Number(b.base_price) - Number(a.base_price))
      .slice(0, 4)
      .map((p) => {
        const eur = Number(p.base_price ?? 0);
        const credits = p.credit_cost_manual && p.credit_cost != null ? p.credit_cost : creditsFor(eur, rateNum);
        return { name: p.name, eur, credits, rounded: Math.abs(credits * rateNum - eur) > 0.005 };
      });
    const budgetRow = data.budgets.find((b) => b.scope === "role");
    const budget = budgetRow
      ? s.payment === "credits"
        ? Math.ceil((budgetRow.amount * s.creditRate) / rateNum - 1e-9)
        : creditsFor(budgetRow.amount, rateNum)
      : null;
    const sample = list[list.length - 1];
    return { list, budget, sample, gap: roundingGap(prices, rateNum) };
  }, [payment, rateNum, rateOk, data, s, prices]);

  function save() {
    setError(null);
    const t = threshold.trim() === "" ? null : Number(threshold.replace(",", "."));
    start(async () => {
      const res = await saveOrderingSettings(data.companyId, {
        payment,
        creditRate: payment === "credits" ? rateNum : s.creditRate,
        capsEnabled,
        uncapped,
        showPriceWithCaps: showPrice,
        approvalOver: t,
      });
      if (res.ok) {
        toast.success("Bestelregels opgeslagen");
        onClose();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bestelregels</DialogTitle>
          <DialogDescription>
            Gelden voor de hele organisatie. Budgetten en maxima per functie stel
            je in bij de functie zelf.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">1. Hoe betalen medewerkers?</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(PAYMENT) as PaymentMode[]).map((m) => {
              const Icon = PAYMENT[m].icon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => choosePayment(m)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition hover:border-foreground/30",
                    payment === m && "border-[var(--brand)] bg-[var(--brand)]/5 ring-1 ring-[var(--brand)]",
                  )}
                >
                  <Icon className="mb-2 h-5 w-5 text-[var(--brand)]" />
                  <p className="text-sm font-medium">{PAYMENT[m].label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{PAYMENT[m].text}</p>
                </button>
              );
            })}
          </div>
        </section>

        {payment === "credits" ? (
          <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">2. Wat is één credit waard?</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>1 credit =</span>
              <span className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                  €
                </span>
                <Input
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  inputMode="decimal"
                  className="w-32 pl-7"
                />
              </span>
              {Math.abs(suggested - rateNum) > 1e-9 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setRate(String(suggested))}>
                  <Sparkles className="h-4 w-4" /> Gebruik voorstel ({formatPrice(suggested)})
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Dit is de voorgestelde koers.</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Creditprijs = europrijs ÷ koers, naar boven afgerond op hele credits.
              Een credit kost de organisatie dus nooit meer dan {rateOk ? formatPrice(rateNum) : "de koers"}.
            </p>
            {example ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="mb-2 font-medium">Rekenvoorbeeld met jullie producten</p>
                <ul className="space-y-1">
                  {example.list.map((r) => (
                    <li key={r.name} className="flex justify-between gap-3">
                      <span className="truncate">{r.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatPrice(r.eur)} → <span className="font-medium text-foreground">{formatCredits(r.credits)}</span>
                        {r.rounded ? " (afgerond)" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {example.budget && example.sample ? (
                  <p className="mt-2 text-muted-foreground">
                    Met een budget van {formatCredits(example.budget)} kan iemand bijvoorbeeld{" "}
                    {Math.floor(example.budget / Math.max(1, example.sample.credits))}× {example.sample.name} bestellen.
                  </p>
                ) : null}
                {example.gap > 0.05 ? (
                  <p className="mt-2 text-amber-700">
                    Let op: door afronden kosten producten gemiddeld {Math.round(example.gap * 100)}% meer
                    credits dan hun europrijs. Een kleinere koers maakt dat nauwkeuriger.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">
            {payment === "credits" ? "3" : "2"}. Maximaal aantal per product
          </h3>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={capsEnabled}
              onChange={(e) => setCapsEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium">Maximum per product gebruiken</span>
              <span className="block text-muted-foreground">
                Bijvoorbeeld &quot;2 jassen per jaar&quot;. Je stelt de aantallen per functie in.
              </span>
            </span>
          </label>
          {capsEnabled ? (
            <div className="space-y-3 rounded-lg border p-3 text-sm">
              <div>
                <p className="mb-1.5 font-medium">Producten zonder maximum</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["free", "Vrij te bestellen"],
                      ["blocked", "Niet bestelbaar"],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setUncapped(v)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5",
                        uncapped === v && "border-[var(--brand)] bg-[var(--brand)]/5",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {payment === "none" ? (
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium">Prijs tonen naast &quot;nog X over&quot;</span>
                    <span className="block text-muted-foreground">
                      Standaard uit: medewerkers zien alleen hoeveel ze nog mogen bestellen.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-muted-foreground">
                  Met een budget staat de prijs altijd bij het product, anders kan niemand
                  zijn budget inschatten.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Goedkeuring</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Bestellingen boven</span>
            <Input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              inputMode="decimal"
              placeholder="geen"
              className="w-28"
            />
            <span>{payment === "credits" ? "credits" : "euro"} moeten worden goedgekeurd.</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Leeg laten = geen drempel. Per functie kun je ook &quot;altijd goedkeuren&quot; instellen.
          </p>
        </section>

        {impact.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <Boxes className="h-4 w-4" /> Dit verandert er bij opslaan
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {impact.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={save} disabled={pending || (payment === "credits" && !rateOk)}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Opslaan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
