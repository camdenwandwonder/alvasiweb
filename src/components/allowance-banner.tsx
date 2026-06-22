import { Wallet, Coins, Boxes, Info, CheckCircle2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Allowance } from "@/lib/allowance";

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
  "Is je tegoed op? Dan kun je het product toch aanvragen met een reden. Je beheerder krijgt hiervan een melding en keurt de bestelling goed of af.";

export function AllowanceBanner({ allowance }: { allowance: Allowance }) {
  const { mode, hasLimit, total, remaining, period } = allowance;

  // No limit set → free ordering.
  if (!hasLimit) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-xl border bg-card p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
        <div>
          <p className="text-sm font-medium">Geen budgetlimiet</p>
          <p className="text-sm text-muted-foreground">
            Je kunt bestellen zonder vast budget. Afhankelijk van de regels van
            je bedrijf kan een bestelling nog wel ter goedkeuring naar je
            beheerder gaan.
          </p>
        </div>
      </div>
    );
  }

  // Quantity (per-product allotment) mode.
  if (mode === "quantity") {
    return (
      <div className="mb-6 rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
          <div>
            <p className="text-sm font-medium">
              Je bestelt met een vast aantal per product
            </p>
            <p className="text-sm text-muted-foreground">
              Bij elk product zie je hoeveel je er nog mag bestellen
              {period ? ` (${PERIOD[period]})` : ""}.
            </p>
          </div>
        </div>
        <HowItWorks
          lines={[
            "Per product is een maximum aantal ingesteld voor jouw rol of voor jou persoonlijk.",
            "Het resterende aantal staat als “2/3 over” op de productkaart.",
            REQUEST_LINE,
          ]}
        />
      </div>
    );
  }

  // Euro / credits budget.
  const isCredits = mode === "credits";
  const fmt = (v: number | null) =>
    v == null ? "—" : isCredits ? `${v} credits` : formatPrice(v);
  const pct =
    total && total > 0
      ? Math.min(100, Math.max(0, ((remaining ?? 0) / total) * 100))
      : 0;
  const low = total ? (remaining ?? 0) / total <= 0.15 : false;

  return (
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
              Jouw {isCredits ? "credits" : "budget"}{" "}
              {period ? PERIOD_NOUN[period] : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Je betaalt je bestellingen met dit tegoed.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-semibold ${low ? "text-amber-600" : ""}`}>
            {fmt(remaining)}
          </div>
          <div className="text-xs text-muted-foreground">
            van {fmt(total)} {period ? PERIOD[period] : ""}
          </div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-[var(--brand)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <HowItWorks
        lines={[
          `Je krijgt ${fmt(total)} ${period ? PERIOD[period] : ""} om te besteden.`,
          "Elke bestelling wordt van je resterende tegoed afgetrokken.",
          REQUEST_LINE,
        ]}
      />
    </div>
  );
}
