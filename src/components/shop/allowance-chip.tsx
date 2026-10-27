"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Boxes, ChevronDown, Coins, Loader2, PlusCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/primitives";
import { Popover } from "@/components/orders/popover";
import { cn } from "@/lib/utils";
import { formatAmount, type OrderingSettings } from "@/lib/ordering";
import { formatPrice } from "@/lib/format";
import type { PersonAllowance } from "@/lib/allowance";
import { requestExtraBudget } from "@/lib/budget-request-actions";

const PERIOD_NOUN: Record<string, string> = {
  monthly: "per maand",
  quarterly: "per kwartaal",
  yearly: "per jaar",
  once: "eenmalig",
};

/** Small budget indicator for the shop header, with details in a popover. */
export function AllowanceChip({
  settings,
  allowance,
  canRequest,
  forName,
}: {
  settings: OrderingSettings;
  allowance: PersonAllowance;
  canRequest: boolean;
  /** First name when a manager orders for someone. */
  forName: string | null;
}) {
  const [requesting, setRequesting] = useState(false);
  const budget = allowance.budget;
  const credits = settings.payment === "credits";
  const unit = credits ? "credits" : "euro";
  const whose = forName ? `van ${forName}` : "";

  if (!budget && !allowance.capsEnabled) return null;

  const label = budget
    ? `${formatAmount(Math.max(0, budget.remaining), settings.payment)} over`
    : "Maximum per product";
  const pct = budget && budget.total > 0 ? Math.min(1, Math.max(0, budget.remaining / budget.total)) : null;
  const low = pct != null && pct <= 0.15;
  const Icon = budget ? (credits ? Coins : Wallet) : Boxes;
  const reset = budget?.resetsAt
    ? new Date(budget.resetsAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <>
      <Popover
        align="right"
        className="w-80 p-4"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border bg-card px-3.5 text-sm font-medium transition hover:bg-muted",
              low && "border-amber-300 bg-amber-50 text-amber-900",
            )}
          >
            <Icon className={cn("h-4 w-4", low ? "text-amber-600" : "text-[var(--brand)]")} />
            {forName ? <span className="font-normal text-muted-foreground">{forName}:</span> : null}
            {label}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        )}
      >
        {(close) => (
          <div className="space-y-3 text-sm">
            {budget ? (
              <>
                <div>
                  <p className="font-medium">
                    {credits ? "Credits" : "Budget"} {whose} {PERIOD_NOUN[budget.period] ?? ""}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", low ? "bg-amber-500" : "bg-[var(--brand)]")}
                      style={{ width: `${Math.round((pct ?? 0) * 100)}%` }}
                    />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-y-1 text-muted-foreground">
                    <dt>Over</dt>
                    <dd className="text-right font-medium text-foreground">
                      {formatAmount(Math.max(0, budget.remaining), settings.payment)}
                    </dd>
                    <dt>Gebruikt</dt>
                    <dd className="text-right">{formatAmount(budget.used, settings.payment)}</dd>
                    <dt>Totaal</dt>
                    <dd className="text-right">{formatAmount(budget.total, settings.payment)}</dd>
                    {budget.extra > 0 ? (
                      <>
                        <dt>Waarvan extra</dt>
                        <dd className="text-right">{formatAmount(budget.extra, settings.payment)}</dd>
                      </>
                    ) : null}
                  </dl>
                </div>
                <p className="text-muted-foreground">
                  {credits
                    ? `Elk product toont wat het kost in credits${settings.creditRate ? ` (1 credit = ${formatPrice(settings.creditRate)})` : ""}.`
                    : "Je bestellingen gaan van dit budget af."}
                  {reset ? ` Vernieuwt op ${reset}.` : ""}
                </p>
              </>
            ) : null}
            {allowance.capsEnabled ? (
              <p className="text-muted-foreground">
                Bij producten met een maximum zie je hoeveel {forName ? `${forName} er` : "je er"} nog mag
                bestellen.{" "}
                {settings.uncapped === "blocked"
                  ? "Alleen producten met een maximum zijn bestelbaar."
                  : "Producten zonder maximum zijn vrij te bestellen."}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              Meer nodig dan toegestaan? Bestel gewoon: dan wordt het een aanvraag voor de leidinggevende.
            </p>
            {budget && canRequest ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  close();
                  setRequesting(true);
                }}
              >
                <PlusCircle className="h-4 w-4" /> Meer budget aanvragen
              </Button>
            ) : null}
          </div>
        )}
      </Popover>
      {requesting ? <RequestBudgetDialog unit={unit} onClose={() => setRequesting(false)} /> : null}
    </>
  );
}

function RequestBudgetDialog({ unit, onClose }: { unit: "euro" | "credits"; onClose: () => void }) {
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
        onClose();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meer budget aanvragen</DialogTitle>
          <DialogDescription>
            Je beheerder krijgt een melding. Na goedkeuring is het extra budget direct te gebruiken.
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
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
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

