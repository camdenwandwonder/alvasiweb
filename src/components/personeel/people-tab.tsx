"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, StatusBadge } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/ordering";
import { bulkPeople } from "@/lib/personeel/actions";
import type { PersoneelData, PPerson } from "@/lib/personeel/data";
import {
  budgetUse,
  formatDate,
  hasException,
  missingSizes,
  roleName,
  sizeSummary,
  type Perms,
} from "./helpers";

type Filter = "all" | "inactive" | "low" | "sizes" | "exception" | "norole" | "never";

export function PeopleTab({
  data,
  perms,
  currentUserId,
  onOpen,
}: {
  data: PersoneelData;
  perms: Perms;
  currentUserId: string;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const tests: Record<Filter, (p: PPerson) => boolean> = useMemo(
    () => ({
      all: () => true,
      inactive: (p) => p.status === "disabled",
      low: (p) => (budgetUse(data.allowances[p.id]) ?? 0) >= 0.8,
      sizes: (p) => missingSizes(data, p),
      exception: (p) => hasException(data, p.id),
      norole: (p) => !p.role_id || !data.roles.some((r) => r.id === p.role_id),
      never: (p) => p.order_count === 0,
    }),
    [data],
  );

  const chips: { key: Filter; label: string; show: boolean }[] = [
    { key: "all", label: "Iedereen", show: true },
    { key: "low", label: "Budget bijna op", show: data.settings.payment !== "none" },
    { key: "sizes", label: "Maat ontbreekt", show: data.sizeSets.length > 0 },
    { key: "never", label: "Nog nooit besteld", show: true },
    { key: "exception", label: "Uitzondering", show: true },
    { key: "inactive", label: "Gedeactiveerd", show: true },
    { key: "norole", label: "Geen functie", show: true },
  ];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.people.filter(
      (p) =>
        tests[filter](p) &&
        (!role || p.role_id === role) &&
        (!q ||
          (p.full_name ?? "").toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q)),
    );
  }, [data.people, tests, filter, role, query]);

  const selectable = shown.filter((p) => p.id !== currentUserId);
  const allChecked = selectable.length > 0 && selectable.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (data.people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Users className="h-5 w-5" />
        </span>
        <p className="font-medium">Nog geen medewerkers</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Voeg de eerste medewerker toe met de knop rechtsboven.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op naam of e-mail"
            className="pl-9"
          />
        </div>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-52">
          <option value="">Alle functies</option>
          {data.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips
          .filter((c) => c.show)
          .map((c) => {
            const count = data.people.filter(tests[c.key]).length;
            if (c.key !== "all" && count === 0) return null;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition",
                  filter === c.key
                    ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-foreground)]"
                    : "hover:bg-muted",
                )}
              >
                {c.label} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
      </div>

      {perms.update && selected.size > 0 ? (
        <BulkBar
          data={data}
          ids={[...selected]}
          onDone={() => setSelected(new Set())}
        />
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {perms.update ? (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Alles selecteren"
                    checked={allChecked}
                    onChange={() =>
                      setSelected(allChecked ? new Set() : new Set(selectable.map((p) => p.id)))
                    }
                    className="h-4 w-4"
                  />
                </th>
              ) : null}
              <th className="px-4 py-3">Medewerker</th>
              <th className="px-4 py-3">Functie</th>
              <th className="px-4 py-3">
                {data.settings.payment === "none" ? "Maxima" : "Budget"}
              </th>
              <th className="px-4 py-3">Maten</th>
              <th className="px-4 py-3">Laatste bestelling</th>
              <th className="px-4 py-3">Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((p) => (
              <tr
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="cursor-pointer align-middle hover:bg-muted/30"
              >
                {perms.update ? (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {p.id !== currentUserId ? (
                      <input
                        type="checkbox"
                        aria-label={`Selecteer ${p.full_name ?? p.email}`}
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4"
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {p.full_name || p.email}
                    {p.id === currentUserId ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(jij)</span>
                    ) : null}
                    {hasException(data, p.id) ? (
                      <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                        Uitzondering
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {roleName(data, p.role_id)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <BudgetCell data={data} person={p} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sizeSummary(data, p.sizes) || (data.sizeSets.length ? "—" : "")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.last_order_at ? formatDate(p.last_order_at) : "Nog niet"}
                </td>
                <td className="px-4 py-3">
                  {p.status === "disabled" ? (
                    <StatusBadge tone="red">Gedeactiveerd</StatusBadge>
                  ) : p.status === "invited" ? (
                    <StatusBadge tone="amber">Uitgenodigd</StatusBadge>
                  ) : (
                    <StatusBadge tone="green">Actief</StatusBadge>
                  )}
                </td>
                <td className="pr-3 text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Geen medewerkers gevonden met deze filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BudgetCell({ data, person }: { data: PersoneelData; person: PPerson }) {
  const a = data.allowances[person.id];
  const s = data.settings;
  if (s.payment === "none") {
    if (!s.capsEnabled) return <span className="text-muted-foreground">Geen budget</span>;
    const caps = Object.values(a?.caps ?? {});
    if (!caps.length) return <span className="text-muted-foreground">Geen maxima</span>;
    const full = caps.filter((c) => c.remaining <= 0).length;
    return (
      <span className={full ? "text-amber-700" : "text-muted-foreground"}>
        {caps.length} product(en){full ? ` · ${full} op` : ""}
      </span>
    );
  }
  if (!a?.budget) return <span className="text-muted-foreground">Geen budget</span>;
  const use = budgetUse(a) ?? 0;
  return (
    <div className="w-40">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{formatAmount(Math.max(0, a.budget.remaining), s.payment)}</span>
        <span className="text-muted-foreground">van {formatAmount(a.budget.total, s.payment)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            use >= 1 ? "bg-red-500" : use >= 0.8 ? "bg-amber-500" : "bg-[var(--brand)]",
          )}
          style={{ width: `${Math.round(use * 100)}%` }}
        />
      </div>
    </div>
  );
}

function BulkBar({
  data,
  ids,
  onDone,
}: {
  data: PersoneelData;
  ids: string[];
  onDone: () => void;
}) {
  const [roleId, setRoleId] = useState("");
  const [pending, start] = useTransition();

  function run(action: Parameters<typeof bulkPeople>[2], done: string) {
    start(async () => {
      const res = await bulkPeople(data.companyId, ids, action);
      if (res.ok) {
        toast.success(done);
        onDone();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-3 py-2 text-sm">
      <span className="font-medium">{ids.length} geselecteerd</span>
      <span className="mx-1 h-5 w-px bg-border" />
      <NativeSelect value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-9 w-48">
        <option value="">Functie wijzigen naar…</option>
        {data.roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </NativeSelect>
      <Button
        size="sm"
        disabled={!roleId || pending}
        onClick={() => run({ type: "role", roleId }, "Functie gewijzigd")}
      >
        Toepassen
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run({ type: "status", status: "disabled" }, "Medewerkers gedeactiveerd")}
      >
        Deactiveren
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run({ type: "status", status: "active" }, "Medewerkers geactiveerd")}
      >
        Activeren
      </Button>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone}>
        Selectie wissen
      </Button>
    </div>
  );
}
