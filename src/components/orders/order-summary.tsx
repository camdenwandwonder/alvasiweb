"use client";

import { ClipboardList, Hourglass, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/ordering";
import { formatPrice } from "@/lib/format";
import type { OverviewData } from "@/lib/orders/overview";
import type { Go } from "./order-filters";

function change(now: number, before: number | undefined, label: string | null) {
  if (before == null || !label) return null;
  if (!before && !now) return `gelijk aan ${label}`;
  if (!before) return `${label}: niets`;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return `gelijk aan ${label}`;
  return `${pct > 0 ? "+" : ""}${pct}% t.o.v. ${label}`;
}

export function OrderSummary({ data, go }: { data: OverviewData; go: Go }) {
  const s = data.summary;
  const prev = data.previous;
  const label = data.range.prevLabel;
  const credits = data.display === "credits" || (data.display === "both" && data.settings?.payment === "credits");
  const own = data.scope === "own";
  const hidden = data.display === "hidden";

  const spent = credits ? formatCredits(s.credits) : formatPrice(s.value);
  const spentSub =
    data.display === "both" && credits
      ? `waarde ${formatPrice(s.value)} · ${s.items} artikelen`
      : `${s.items} ${s.items === 1 ? "artikel" : "artikelen"}`;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        icon={ClipboardList}
        label="Bestellingen"
        value={String(s.activeOrders)}
        sub={
          s.orders > s.activeOrders
            ? `+ ${s.orders - s.activeOrders} afgewezen of geannuleerd`
            : undefined
        }
        note={change(s.activeOrders, prev?.orders, label)}
      />
      {hidden ? (
        <Card
          icon={Wallet}
          label="Artikelen"
          value={String(s.items)}
          sub="besteld in deze periode"
        />
      ) : (
        <Card
          icon={Wallet}
          label={own ? "Besteld voor" : "Besteed"}
          value={spent}
          sub={spentSub}
          note={change(credits ? s.credits : s.value, credits ? prev?.credits : prev?.value, label)}
          onClick={own ? undefined : () => go({ weergave: "producten" })}
          action="Per product"
        />
      )}
      {own ? (
        <Card
          icon={Users}
          label="Producten"
          value={String(s.items)}
          sub="artikelen in deze periode"
          onClick={() => go({ weergave: "producten" })}
          action="Bekijk per product"
        />
      ) : (
        <Card
          icon={Users}
          label="Besteld door"
          value={
            data.headcount != null
              ? `${s.orderers} van ${data.headcount}`
              : `${s.orderers}`
          }
          sub={
            data.headcount != null && data.headcount > s.orderers
              ? `${data.headcount - s.orderers} nog niet besteld`
              : s.orderers === 1
                ? "medewerker"
                : "medewerkers"
          }
          onClick={() => go({ weergave: "medewerkers", iedereen: true })}
          action="Per medewerker"
        />
      )}
      <Card
        icon={Hourglass}
        label="Wacht op goedkeuring"
        value={String(s.pending)}
        tone={s.pending ? "amber" : undefined}
        sub={s.pending ? "klik om alleen deze te tonen" : "niets open"}
        onClick={s.pending ? () => go({ status: ["pending_approval"], weergave: "bestellingen" }) : undefined}
      />
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
  note,
  onClick,
  action,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  note?: string | null;
  onClick?: () => void;
  action?: string;
  tone?: "amber";
}) {
  const body = (
    <>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </p>
      <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
      {note ? <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p> : null}
      {onClick && action ? (
        <p className="mt-1 text-xs font-medium text-[var(--brand)] opacity-0 transition group-hover:opacity-100">
          {action} →
        </p>
      ) : null}
    </>
  );
  const cls = cn(
    "group rounded-xl border bg-card p-4 text-left",
    tone === "amber" && "border-amber-200 bg-amber-50/60",
    onClick && "transition hover:border-[var(--brand)]/50 hover:shadow-sm",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
