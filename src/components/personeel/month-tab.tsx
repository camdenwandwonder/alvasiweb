"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Hourglass,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/ordering";
import { formatPrice } from "@/lib/format";
import { getMonthOverview, type MonthOverview, type MonthTotals } from "@/lib/personeel/month-actions";
import type { PersoneelData, PPerson } from "@/lib/personeel/data";
import { budgetUse, missingSizes, roleName } from "./helpers";

function thisMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  return parts.slice(0, 7);
}

function shift(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function label(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 15)).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function MonthTab({
  data,
  approvalsHref,
  onOpenPerson,
}: {
  data: PersoneelData;
  approvalsHref?: string;
  onOpenPerson: (id: string) => void;
}) {
  const now = thisMonth();
  const [month, setMonth] = useState(now);
  const [overview, setOverview] = useState<MonthOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setOverview(null);
    setError(null);
    getMonthOverview(data.companyId, month).then((res) => {
      if (!live) return;
      if (res.ok) setOverview(res.overview);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [data, month]);

  const credits = data.settings.payment === "credits";
  const money = (t: MonthTotals) => (credits ? formatCredits(t.credits) : formatPrice(t.value));
  const prevName = label(shift(month, -1)).split(" ")[0];
  const activePeople = data.people.filter((p) => p.status !== "disabled");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Vorige maand" onClick={() => setMonth(shift(month, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="min-w-40 text-center text-lg font-semibold capitalize">{label(month)}</h2>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Volgende maand"
          disabled={month >= now}
          onClick={() => setMonth(shift(month, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {month !== now ? (
          <Button variant="ghost" size="sm" onClick={() => setMonth(now)}>
            Deze maand
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : !overview ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={ClipboardList}
              label="Bestellingen"
              value={String(overview.current.orders)}
              change={compare(overview.current.orders, overview.previous.orders, prevName)}
            />
            <Stat
              icon={Wallet}
              label={credits ? "Besteed in credits" : "Besteed"}
              value={money(overview.current)}
              sub={credits ? `Waarde ${formatPrice(overview.current.value)}` : undefined}
              change={compare(
                credits ? overview.current.credits : overview.current.value,
                credits ? overview.previous.credits : overview.previous.value,
                prevName,
              )}
            />
            <Stat
              icon={Users}
              label="Besteld door"
              value={`${overview.current.orderers} van ${activePeople.length}`}
              sub="medewerkers"
            />
            <Stat
              icon={Hourglass}
              label="Wacht op goedkeuring"
              value={String(overview.pendingApproval)}
              sub={overview.rejected ? `${overview.rejected} afgewezen` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Meest besteld">
              {overview.topProducts.length ? (
                <ul className="space-y-2.5">
                  {overview.topProducts.map((p) => (
                    <li key={p.name} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums text-muted-foreground">{p.quantity}×</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[var(--brand)]"
                          style={{
                            width: `${Math.round((p.quantity / overview.topProducts[0]!.quantity) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Deze maand is er nog niets besteld.</Empty>
              )}
            </Panel>

            <Panel title="Per functie">
              {overview.byRole.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Functie</th>
                      <th className="pb-2 text-right font-medium">Bestellingen</th>
                      <th className="pb-2 text-right font-medium">Besteld</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overview.byRole.map((r) => (
                      <tr key={r.roleId ?? "none"}>
                        <td className="py-2">
                          {roleName(data, r.roleId)}
                          <span className="block text-xs text-muted-foreground">
                            {r.orderers} {r.orderers === 1 ? "medewerker" : "medewerkers"}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{r.orders}</td>
                        <td className="py-2 text-right tabular-nums">{money(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty>Nog geen bestellingen om te verdelen.</Empty>
              )}
            </Panel>
          </div>

          {data.settings.payment !== "none" &&
          overview.requests.pending + overview.requests.approved + overview.requests.declined > 0 ? (
            <Panel title="Budgetaanvragen deze maand">
              <p className="text-sm">
                {overview.requests.approved} goedgekeurd
                {overview.requests.approved
                  ? ` (samen ${credits ? formatCredits(overview.requests.approvedAmount) : formatPrice(overview.requests.approvedAmount)} extra)`
                  : ""}
                , {overview.requests.declined} afgewezen, {overview.requests.pending} open.
              </p>
            </Panel>
          ) : null}

          {overview.newPeople.length ? (
            <Panel title="Nieuw in dienst">
              <Names
                people={data.people.filter((p) => overview.newPeople.includes(p.id))}
                onOpen={onOpenPerson}
              />
            </Panel>
          ) : null}
        </>
      )}

      <Attention
        data={data}
        people={activePeople}
        approvalsHref={approvalsHref}
        onOpenPerson={onOpenPerson}
      />
    </div>
  );
}

function compare(now: number, before: number, prevName: string): { text: string; up: boolean | null } {
  if (!before && !now) return { text: `gelijk aan ${prevName}`, up: null };
  if (!before) return { text: `${prevName}: niets`, up: true };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: `gelijk aan ${prevName}`, up: null };
  return { text: `${pct > 0 ? "+" : ""}${pct}% t.o.v. ${prevName}`, up: pct > 0 };
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  change,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  change?: { text: string; up: boolean | null };
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      {change ? <p className="mt-1 text-xs text-muted-foreground">{change.text}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Names({ people, onOpen }: { people: PPerson[]; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? people : people.slice(0, 10);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(p.id)}
          className="rounded-full border px-2.5 py-0.5 text-sm hover:bg-muted"
        >
          {p.full_name || p.email}
        </button>
      ))}
      {!all && people.length > shown.length ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="px-2 text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          en {people.length - shown.length} meer
        </button>
      ) : null}
    </div>
  );
}

/** What needs a manager's attention right now (not tied to the chosen month). */
function Attention({
  data,
  people,
  approvalsHref,
  onOpenPerson,
}: {
  data: PersoneelData;
  people: PPerson[];
  approvalsHref?: string;
  onOpenPerson: (id: string) => void;
}) {
  const groups = [
    {
      title: "Bijna door het budget heen",
      people: people.filter((p) => (budgetUse(data.allowances[p.id]) ?? 0) >= 0.8),
    },
    { title: "Nog nooit besteld", people: people.filter((p) => p.order_count === 0) },
    { title: "Standaardmaten ontbreken", people: people.filter((p) => missingSizes(data, p)) },
    {
      title: "Zonder functie",
      people: people.filter((p) => !p.role_id || !data.roles.some((r) => r.id === p.role_id)),
    },
  ].filter((g) => g.people.length);

  if (!groups.length && !data.pendingRequests) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-600" /> Aandacht nodig
        <span className="font-normal text-muted-foreground">· stand van vandaag</span>
      </h3>
      <div className="space-y-4">
        {data.pendingRequests ? (
          <p className="text-sm">
            {data.pendingRequests === 1
              ? "1 budgetaanvraag wacht op een beslissing."
              : `${data.pendingRequests} budgetaanvragen wachten op een beslissing.`}{" "}
            {approvalsHref ? (
              <Link href={approvalsHref} className="font-medium underline underline-offset-2">
                Bekijken
              </Link>
            ) : null}
          </p>
        ) : null}
        {groups.map((g) => (
          <div key={g.title}>
            <p className={cn("mb-1.5 text-sm font-medium")}>
              {g.title} <span className="font-normal text-muted-foreground">({g.people.length})</span>
            </p>
            <Names people={g.people} onOpen={onOpenPerson} />
          </div>
        ))}
      </div>
    </section>
  );
}
