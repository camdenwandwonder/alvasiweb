"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Eye,
  History,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NativeSelect, StatusBadge } from "@/components/primitives";
import { UserSizesDialog } from "@/components/user-sizes-dialog";
import {
  DeleteUserDialog,
  EditUserDialog,
  PasswordDialog,
} from "@/components/user-dialogs";
import { cn } from "@/lib/utils";
import { formatAmount, formatCredits, PERIOD_LABEL, type Period } from "@/lib/ordering";
import { formatPrice, ORDER_STATUS } from "@/lib/format";
import {
  getPersonActivity,
  setPersonBudget,
  setPersonCap,
  setPersonRole,
  type ActivityOrder,
  type HistoryEntry,
} from "@/lib/personeel/actions";
import type { PersoneelData, PPerson } from "@/lib/personeel/data";
import {
  formatDate,
  periodText,
  personBudget,
  personCaps,
  roleBudget,
  sizeSummary,
  whatCan,
  type Perms,
} from "./helpers";

const PERIODS = Object.entries(PERIOD_LABEL) as [Period, string][];

export function PersonDrawer({
  data,
  person,
  perms,
  currentUserId,
  previewHref,
  onClose,
}: {
  data: PersoneelData;
  person: PPerson;
  perms: Perms;
  currentUserId: string;
  previewHref: string;
  onClose: () => void;
}) {
  const isSelf = person.id === currentUserId;
  const [activity, setActivity] = useState<{
    orders: ActivityOrder[];
    history: HistoryEntry[];
  } | null>(null);

  useEffect(() => {
    let live = true;
    setActivity(null);
    getPersonActivity(person.id).then((res) => {
      if (live && res.ok) setActivity({ orders: res.orders, history: res.history });
    });
    return () => {
      live = false;
    };
  }, [person.id, data]);

  const name = person.full_name || person.email || "Medewerker";
  const first = (person.full_name || "").split(" ")[0] || "deze medewerker";

  return (
    <Sheet open onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-[var(--brand-foreground)]">
              {name
                .split(/[\s@.]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]!.toUpperCase())
                .join("")}
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg">{name}</SheetTitle>
              <SheetDescription className="truncate">{person.email}</SheetDescription>
            </div>
            <span className="ml-auto">
              {person.status === "disabled" ? (
                <StatusBadge tone="red">Gedeactiveerd</StatusBadge>
              ) : (
                <StatusBadge tone="green">Actief</StatusBadge>
              )}
            </span>
          </div>
          <RoleSelect data={data} person={person} disabled={!perms.update || isSelf} />
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          {/* Wat kan … ? */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Wat kan {first}?</h3>
            <ul className="space-y-2 rounded-xl border bg-card p-3">
              {whatCan(data, person).map((l, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      l.ok === true && "bg-green-100 text-green-700",
                      l.ok === "warn" && "bg-amber-100 text-amber-700",
                      l.ok === false && "bg-muted text-muted-foreground",
                    )}
                  >
                    {l.ok === true ? (
                      <Check className="h-3 w-3" />
                    ) : l.ok === "warn" ? (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </span>
                  <span>
                    {l.text}
                    {l.source ? (
                      <span className="text-muted-foreground"> ({l.source})</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={previewHref}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}
            >
              <Eye className="h-4 w-4" /> Bekijk de winkel als {first}
            </Link>
          </section>

          {data.settings.payment !== "none" ? (
            <BudgetSection data={data} person={person} canEdit={perms.settings} />
          ) : null}

          {data.settings.capsEnabled ? (
            <CapsSection data={data} person={person} canEdit={perms.settings} />
          ) : null}

          {/* Maten */}
          {data.sizeSets.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Standaardmaten</h3>
                {perms.update ? (
                  <UserSizesDialog
                    userId={person.id}
                    userName={name}
                    sizeSets={data.sizeSets}
                    current={person.sizes ?? {}}
                  />
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {sizeSummary(data, person.sizes) ||
                  "Nog geen maten ingesteld. De medewerker kan ze ook zelf invullen bij Mijn profiel."}
              </p>
            </section>
          ) : null}

          {/* Bestellingen */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Recente bestellingen</h3>
            {!activity ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Laden…
              </p>
            ) : activity.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen bestellingen.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {activity.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{o.order_number ?? "Bestelling"}</span>
                      <span className="text-muted-foreground"> · {formatDate(o.created_at)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">
                        {data.settings.payment === "credits"
                          ? `${formatCredits(o.credit_total)} · ${formatPrice(o.total)}`
                          : formatPrice(o.total)}
                      </span>
                      <StatusBadge tone={ORDER_STATUS[o.status]?.tone ?? "neutral"}>
                        {ORDER_STATUS[o.status]?.label ?? o.status}
                      </StatusBadge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Geschiedenis */}
          {activity && activity.history.length ? (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <History className="h-4 w-4" /> Wijzigingen
              </h3>
              <ul className="space-y-1.5 text-sm">
                {activity.history.map((h) => (
                  <li key={h.id} className="text-muted-foreground">
                    <span className="text-foreground">{h.summary}</span>
                    <span className="block text-xs">
                      {formatDate(h.created_at)}
                      {h.actor_name ? ` · ${h.actor_name}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Account */}
          {perms.update || perms.remove ? (
            <section className="border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold">Account</h3>
              <div className="flex flex-wrap gap-2">
                {perms.update ? (
                  <>
                    <EditUserDialog
                      user={person}
                      roles={data.roles}
                      isSelf={isSelf}
                      labeled
                    />
                    <PasswordDialog user={person} labeled />
                  </>
                ) : null}
                {perms.remove && !isSelf ? (
                  <DeleteUserDialog user={person} labeled onDone={onClose} />
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoleSelect({
  data,
  person,
  disabled,
}: {
  data: PersoneelData;
  person: PPerson;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <label className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Functie</span>
      <NativeSelect
        value={person.role_id ?? ""}
        disabled={disabled || pending}
        onChange={(e) => {
          const roleId = e.target.value;
          start(async () => {
            const res = await setPersonRole(person.id, roleId);
            if (res.ok) toast.success("Functie gewijzigd");
            else toast.error(res.error);
          });
        }}
        className="h-9 max-w-60"
      >
        {!person.role_id ? <option value="">Geen functie</option> : null}
        {data.roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </NativeSelect>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
    </label>
  );
}

function BudgetSection({
  data,
  person,
  canEdit,
}: {
  data: PersoneelData;
  person: PPerson;
  canEdit: boolean;
}) {
  const s = data.settings;
  const own = personBudget(data, person.id);
  const fromRole = roleBudget(data, person.role_id);
  const a = data.allowances[person.id];
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(own?.amount ?? fromRole?.amount ?? ""));
  const [period, setPeriod] = useState<string>(own?.period ?? fromRole?.period ?? "yearly");
  const [pending, start] = useTransition();
  const roleName = data.roles.find((r) => r.id === person.role_id)?.name ?? "de functie";

  function save(budget: { amount: number; period: string } | null) {
    start(async () => {
      const res = await setPersonBudget(person.id, budget);
      if (res.ok) {
        toast.success(budget ? "Eigen budget ingesteld" : "Volgt weer de functie");
        setEditing(false);
      } else toast.error(res.error);
    });
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Budget</h3>
        {own ? (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
            Uitzondering
          </span>
        ) : null}
      </div>
      <div className="rounded-xl border p-3 text-sm">
        {own ? (
          <p>
            Eigen budget: <strong>{formatAmount(own.amount, s.payment)}</strong> {periodText(own.period)}
            {fromRole ? (
              <span className="text-muted-foreground">
                {" "}
                (functie {roleName}: {formatAmount(fromRole.amount, s.payment)} {periodText(fromRole.period)})
              </span>
            ) : null}
          </p>
        ) : fromRole ? (
          <p>
            Volgt functie {roleName}: <strong>{formatAmount(fromRole.amount, s.payment)}</strong>{" "}
            {periodText(fromRole.period)}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Geen budget: {roleName} heeft geen budget ingesteld.
          </p>
        )}
        {a?.budget && a.budget.extra > 0 ? (
          <p className="mt-1 text-muted-foreground">
            + {formatAmount(a.budget.extra, s.payment)} extra deze periode (aanvraag of welkomstpakket)
          </p>
        ) : null}

        {canEdit ? (
          editing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="h-9 w-28"
                placeholder={s.payment === "credits" ? "credits" : "€"}
              />
              <NativeSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-36">
                {PERIODS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => save({ amount: Number(amount.replace(",", ".")), period })}
              >
                Opslaan
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Annuleren
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {own ? "Eigen budget wijzigen" : "Eigen budget instellen"}
              </Button>
              {own ? (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => save(null)}>
                  Terug naar functie
                </Button>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}

function CapsSection({
  data,
  person,
  canEdit,
}: {
  data: PersoneelData;
  person: PPerson;
  canEdit: boolean;
}) {
  const a = data.allowances[person.id];
  const own = personCaps(data, person.id);
  const caps = Object.entries(a?.caps ?? {});
  const [adding, setAdding] = useState(false);
  const [productId, setProductId] = useState("");
  const [max, setMax] = useState("1");
  const [period, setPeriod] = useState("yearly");
  const [pending, start] = useTransition();
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "Product";

  function save(pid: string, cap: { max: number; period: string } | null) {
    start(async () => {
      const res = await setPersonCap(person.id, pid, cap);
      if (res.ok) {
        toast.success(cap ? "Maximum ingesteld" : "Volgt weer de functie");
        setAdding(false);
      } else toast.error(res.error);
    });
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Maximum per product</h3>
      <div className="rounded-xl border text-sm">
        {caps.length === 0 ? (
          <p className="p-3 text-muted-foreground">
            Geen maxima.{" "}
            {data.settings.uncapped === "blocked"
              ? "Alleen producten met een maximum zijn bestelbaar, dus deze medewerker kan nu niets bestellen."
              : "Alle zichtbare producten zijn vrij te bestellen."}
          </p>
        ) : (
          <ul className="divide-y">
            {caps.map(([pid, c]) => (
              <li key={pid} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {productName(pid)}
                  <span className="text-muted-foreground">
                    {" "}
                    · nog {Math.max(0, c.remaining)} van {c.max} {periodText(c.period)}
                    {c.source === "user" ? " (uitzondering)" : ""}
                  </span>
                </span>
                {canEdit && own.some((o) => o.product_id === pid) ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Uitzondering verwijderen"
                    title="Terug naar functie"
                    disabled={pending}
                    onClick={() => save(pid, null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="border-t p-3">
            {adding ? (
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect value={productId} onChange={(e) => setProductId(e.target.value)} className="h-9 w-48">
                  <option value="">Kies product…</option>
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                <Input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" className="h-9 w-20" />
                <NativeSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-36">
                  {PERIODS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  size="sm"
                  disabled={!productId || pending}
                  onClick={() => save(productId, { max: Number(max), period })}
                >
                  Opslaan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Annuleren
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Eigen maximum voor een product
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
