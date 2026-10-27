"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Boxes,
  CheckCircle2,
  Coins,
  Info,
  Loader2,
  PlusCircle,
  Ruler,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/primitives";
import { formatAmount, type Display, type OrderingSettings } from "@/lib/ordering";
import type { PersonAllowance } from "@/lib/allowance";
import { requestExtraBudget } from "@/lib/budget-request-actions";

const PERIOD: Record<string, string> = {
  monthly: "deze maand",
  quarterly: "dit kwartaal",
  yearly: "dit jaar",
  once: "in totaal",
};
const PERIOD_NOUN: Record<string, string> = {
  monthly: "per maand",
  quarterly: "per kwartaal",
  yearly: "per jaar",
  once: "eenmalig",
};

function HowItWorks({ lines }: { lines: string[] }) {
  return (
    <details className="mt-3 border-t pt-3 text-sm text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Hoe werkt het?
      </summary>
      <ul className="mt-2 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
            {l}
          </li>
        ))}
      </ul>
    </details>
  );
}

const REQUEST_LINE =
  "Is je tegoed op of wil je meer bestellen dan toegestaan? Dan kun je het toch aanvragen met een reden. Je beheerder keurt de aanvraag goed of af.";

function RequestBudgetDialog({ unit }: { unit: "euro" | "credits" }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await requestExtraBudget(fd);
      if (res.ok) {
        toast.success("Aanvraag verstuurd naar je beheerder");
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setError(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusCircle className="h-4 w-4" /> Meer budget aanvragen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meer budget aanvragen</DialogTitle>
          <DialogDescription>
            Je beheerder krijgt een melding. Na goedkeuring is het extra budget
            direct te gebruiken.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label={unit === "credits" ? "Aantal credits" : "Bedrag (€)"}>
            <Input
              name="amount"
              type="number"
              min={unit === "credits" ? "1" : "0.01"}
              step={unit === "credits" ? "1" : "0.01"}
              required
            />
          </Field>
          <Field label="Reden">
            <Textarea
              name="reason"
              rows={3}
              required
              placeholder="Bijv. nieuwe werkzaamheden waarvoor extra kleding nodig is"
            />
          </Field>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Aanvraag versturen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SizesPrompt() {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3 text-sm">
      <span className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-[var(--brand)]" />
        Vul je standaardmaten in, dan staat je maat bij elk product al klaar.
      </span>
      <Link href="/profile" className="shrink-0 font-medium text-[var(--brand)] hover:underline">
        Maten invullen
      </Link>
    </div>
  );
}

export function AllowanceBanner({
  settings,
  allowance,
  display,
  missingSizes,
  canRequest,
}: {
  settings: OrderingSettings;
  allowance: PersonAllowance;
  display: Display;
  missingSizes: boolean;
  canRequest: boolean;
}) {
  const budget = allowance.budget;
  const capsLines = allowance.capsEnabled
    ? [
        "Bij producten met een maximum zie je hoeveel je er nog mag bestellen.",
        settings.uncapped === "blocked"
          ? "Je ziet alleen producten waarvoor een maximum voor jou is ingesteld."
          : "Producten zonder maximum kun je vrij bestellen.",
      ]
    : [];

  const sizes = missingSizes ? <SizesPrompt /> : null;

  // No budget: free ordering, possibly with maxima per product.
  if (!budget) {
    return (
      <>
        {sizes}
        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            {allowance.capsEnabled ? (
              <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
            ) : (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
            )}
            <div>
              <p className="text-sm font-medium">
                {allowance.capsEnabled
                  ? "Je bestelt met een maximum per product"
                  : "Geen budgetlimiet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {allowance.capsEnabled
                  ? "Bij elk product staat hoeveel je er nog mag bestellen."
                  : "Je kunt bestellen zonder vast budget. Afhankelijk van de regels van je bedrijf kan een bestelling nog wel ter goedkeuring naar je beheerder gaan."}
              </p>
            </div>
          </div>
          {allowance.capsEnabled ? <HowItWorks lines={[...capsLines, REQUEST_LINE]} /> : null}
        </div>
      </>
    );
  }

  const payment = settings.payment;
  const isCredits = payment === "credits";
  const fmt = (v: number) => formatAmount(v, payment);
  const pct = budget.total > 0 ? Math.min(100, Math.max(0, (budget.remaining / budget.total) * 100)) : 0;
  const low = budget.total > 0 && budget.remaining / budget.total <= 0.15;
  const reset = budget.resetsAt
    ? new Date(budget.resetsAt).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      {sizes}
      <div className="mb-6 rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isCredits ? (
              <Coins className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
            ) : (
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
            )}
            <div>
              <p className="text-sm font-medium">
                Jouw {isCredits ? "credits" : "budget"} {PERIOD_NOUN[budget.period] ?? ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCredits
                  ? "Elk product toont wat het kost in credits."
                  : "Je betaalt je bestellingen met dit tegoed."}
                {reset ? ` Vernieuwt op ${reset}.` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-semibold ${low ? "text-amber-600" : ""}`}>
              {fmt(budget.remaining)}
            </div>
            <div className="text-xs text-muted-foreground">
              over van {fmt(budget.total)} {PERIOD[budget.period] ?? ""}
            </div>
            {budget.extra > 0 ? (
              <div className="text-xs text-muted-foreground">
                incl. {fmt(budget.extra)} extra
              </div>
            ) : null}
            {isCredits && display === "both" ? (
              <div className="text-xs text-muted-foreground">
                ≈ {formatAmount(budget.remaining * settings.creditRate, "euro")}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-[var(--brand)]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {canRequest ? (
          <div className="mt-3 flex justify-end">
            <RequestBudgetDialog unit={isCredits ? "credits" : "euro"} />
          </div>
        ) : null}

        <HowItWorks
          lines={[
            `Je krijgt ${fmt(budget.base)} ${PERIOD[budget.period] ?? ""} om te besteden.`,
            "Elke bestelling wordt van je resterende tegoed afgetrokken; een afgewezen of geannuleerde bestelling telt niet mee.",
            ...capsLines,
            REQUEST_LINE,
          ]}
        />
      </div>
    </>
  );
}
