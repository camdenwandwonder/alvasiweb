"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Lock, RefreshCw, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { effectiveCredits, hasDrift, suggestedCredits } from "@/lib/ordering";
import { formatPrice } from "@/lib/format";
import { refreshCreditPrices, setCreditOverride } from "@/lib/personeel/actions";
import type { PersoneelData, PProduct } from "@/lib/personeel/data";

export function CreditPricesDialog({
  data,
  onClose,
}: {
  data: PersoneelData;
  onClose: () => void;
}) {
  const rate = data.settings.creditRate;
  const [pending, start] = useTransition();
  const drifting = data.products.filter(
    (p) => hasDrift(p, null, rate) || p.variants.some((v) => hasDrift(p, v, rate)),
  );

  function refreshAll() {
    start(async () => {
      const res = await refreshCreditPrices(data.companyId, "all");
      if (res.ok) toast.success("Creditprijzen bijgewerkt");
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Creditprijzen</DialogTitle>
          <DialogDescription>
            1 credit = {formatPrice(rate)}. Producten volgen de koers, tenzij je een
            vaste creditprijs instelt. Prijzen veranderen nooit vanzelf.
          </DialogDescription>
        </DialogHeader>

        {drifting.length ? (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Bij {drifting.length} product(en) is de europrijs gewijzigd sinds de
              creditprijs is vastgezet.
            </span>
            <Button size="sm" variant="outline" onClick={refreshAll} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Alle voorstellen overnemen
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Europrijs</th>
                <th className="px-3 py-2 text-right">Credits</th>
                <th className="px-3 py-2">Instelling</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.products.map((p) => (
                <CreditRow key={p.id} product={p} data={data} />
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreditRow({ product: p, data }: { product: PProduct; data: PersoneelData }) {
  const rate = data.settings.creditRate;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(effectiveCredits(p, null, rate)));
  const [pending, start] = useTransition();
  const current = effectiveCredits(p, null, rate);
  const suggestion = suggestedCredits(p, null, rate);
  const drift = hasDrift(p, null, rate) || p.variants.some((v) => hasDrift(p, v, rate));
  const priced = p.variants.filter((v) => v.price_override != null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(done);
        setEditing(false);
      } else toast.error(res.error ?? "Mislukt");
    });
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-2.5">
        <p className="font-medium">{p.name}</p>
        {!p.credit_cost_manual
          ? priced.map((v) => (
              <p key={v.id} className="text-xs text-muted-foreground">
                {v.label}: {formatPrice(v.price_override)} → {effectiveCredits(p, v, rate)} credits
              </p>
            ))
          : null}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(p.base_price)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {editing ? (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            className="ml-auto h-9 w-24 text-right"
            autoFocus
          />
        ) : (
          <span className="font-medium">{current}</span>
        )}
        {drift && !editing ? (
          <span className="block text-xs text-amber-700">voorstel {suggestion}</span>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {p.credit_cost_manual ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
              <Lock className="h-3 w-3" /> Vast
            </span>
          ) : (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">Volgt koers</span>
          )}
          {editing ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setCreditOverride(data.companyId, p.id, Math.round(Number(value))),
                    "Creditprijs vastgezet",
                  )
                }
              >
                Opslaan
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Annuleren
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Aanpassen
              </Button>
              {p.credit_cost_manual ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(() => setCreditOverride(data.companyId, p.id, null), "Volgt weer de koers")
                  }
                >
                  <Unlock className="h-3.5 w-3.5" /> Volg koers
                </Button>
              ) : drift ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(() => refreshCreditPrices(data.companyId, [p.id]), "Creditprijs bijgewerkt")
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Bijwerken
                </Button>
              ) : null}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
