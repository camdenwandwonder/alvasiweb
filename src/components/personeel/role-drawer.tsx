"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, History, Info, Loader2, PackageOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { formatAmount, PERIOD_LABEL, type Period } from "@/lib/ordering";
import {
  PERMISSION_GROUPS,
  ROLE_TEMPLATES,
  seesFullCatalogue,
  togglePermission,
} from "@/lib/permissions";
import { visibleCategories } from "@/lib/personeel/visibility";
import { deleteRole, getHistory, saveRole, type HistoryEntry } from "@/lib/personeel/actions";
import type { PersoneelData, PRole } from "@/lib/personeel/data";
import {
  formatDate,
  membersOf,
  personBudget,
  roleBudget,
  roleCaps,
  type Perms,
} from "./helpers";

const PERIODS = Object.entries(PERIOD_LABEL) as [Period, string][];
type Cap = { productId: string; max: number; period: string };
type Assortment = { productId: string; kind: "aanbevolen" | "starterspakket"; quantity: number };

export function RoleDrawer({
  data,
  role,
  perms,
  onClose,
  onOpenPerson,
}: {
  data: PersoneelData;
  role: PRole;
  perms: Perms;
  onClose: () => void;
  onOpenPerson: (id: string) => void;
}) {
  const s = data.settings;
  const canRoles = perms.roles;
  const canRules = perms.settings;
  const unit = s.payment === "credits" ? "credits" : "euro";

  const initial = useMemo(() => {
    const b = roleBudget(data, role.id);
    return {
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions,
      requiresApproval: role.requires_order_approval,
      welcome: role.welcome_amount != null ? String(role.welcome_amount) : "",
      budgetAmount: b ? String(b.amount) : "",
      budgetPeriod: b?.period ?? "yearly",
      caps: roleCaps(data, role.id).map<Cap>((c) => ({
        productId: c.product_id,
        max: c.max_quantity,
        period: c.period,
      })),
      categories: visibleCategories(
        data.visibility,
        data.categories.map((c) => c.id),
        role,
      ),
      products: data.roleProducts
        .filter((r) => r.role_id === role.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map<Assortment>((r) => ({ productId: r.product_id, kind: r.kind, quantity: r.quantity })),
    };
  }, [data, role]);

  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const set = <K extends keyof typeof initial>(k: K, v: (typeof initial)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    getHistory(data.companyId, { type: "role", id: role.id }).then((res) => {
      if (live && res.ok) setHistory(res.history);
    });
    return () => {
      live = false;
    };
  }, [data, role.id]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const members = membersOf(data, role.id);
  const fullCatalogue = seesFullCatalogue(form.permissions);

  // Who is affected by a budget change: members without a personal exception.
  const budgetChanged =
    form.budgetAmount !== initial.budgetAmount || form.budgetPeriod !== initial.budgetPeriod;
  const followers = members.filter((m) => !personBudget(data, m.id)).length;

  function save() {
    const amount = Number(form.budgetAmount.replace(",", "."));
    const welcome = Number(form.welcome.replace(",", "."));
    start(async () => {
      const res = await saveRole(data.companyId, {
        id: role.id,
        name: form.name,
        description: form.description,
        permissions: form.permissions,
        requiresApproval: form.requiresApproval,
        welcomeAmount: form.welcome && welcome > 0 ? welcome : null,
        budget: form.budgetAmount && amount > 0 ? { amount, period: form.budgetPeriod } : null,
        caps: form.caps,
        categories: form.categories,
        products: canRules ? form.products : undefined,
      });
      if (res.ok) toast.success("Functie opgeslagen");
      else toast.error(res.error);
    });
  }

  return (
    <Sheet open onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent className="flex w-full flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="pr-8 text-lg">{role.name}</SheetTitle>
          <SheetDescription>
            {members.length === 1 ? "1 medewerker" : `${members.length} medewerkers`}
            {role.is_system ? " · standaardfunctie" : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-4 pb-6">
          <Section title="Algemeen">
            <div className="space-y-3">
              <Field label="Naam" htmlFor="rd-name">
                <Input
                  id="rd-name"
                  value={form.name}
                  disabled={!canRoles}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field label="Omschrijving" htmlFor="rd-desc">
                <Textarea
                  id="rd-desc"
                  rows={2}
                  value={form.description}
                  disabled={!canRoles}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Wat mag deze functie?">
            {canRoles ? (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Snel instellen als</span>
                {ROLE_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => set("permissions", t.permissions)}
                    className="rounded-full border px-2.5 py-0.5 hover:bg-muted"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="space-y-4">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {g.title}
                  </p>
                  <div className="divide-y rounded-xl border">
                    {g.items.map((item) => (
                      <Toggle
                        key={item.key}
                        label={item.label}
                        hint={item.hint}
                        checked={form.permissions.includes(item.key)}
                        disabled={!canRoles}
                        onChange={(on) =>
                          set("permissions", togglePermission(form.permissions, item.key, on))
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Bestellen">
            <div className="divide-y rounded-xl border">
              <Toggle
                label="Elke bestelling moet worden goedgekeurd"
                hint={
                  s.approvalOver != null
                    ? `Anders alleen bestellingen boven ${formatAmount(s.approvalOver, s.payment)} (bestelregels).`
                    : "Anders gaan bestellingen direct door."
                }
                checked={form.requiresApproval}
                disabled={!canRoles}
                onChange={(on) => set("requiresApproval", on)}
              />
            </div>

            {s.payment !== "none" ? (
              <div className="mt-4 space-y-3">
                <Field
                  label={`Budget in ${unit === "credits" ? "credits" : "euro"}`}
                  hint="Leeg laten = geen limiet. Persoonlijke uitzonderingen gaan voor."
                >
                  <div className="flex gap-2">
                    <Input
                      value={form.budgetAmount}
                      inputMode="decimal"
                      placeholder={unit === "credits" ? "Bijv. 300" : "Bijv. 250"}
                      disabled={!canRules}
                      onChange={(e) => set("budgetAmount", e.target.value)}
                      className="w-36"
                    />
                    <NativeSelect
                      value={form.budgetPeriod}
                      disabled={!canRules}
                      onChange={(e) => set("budgetPeriod", e.target.value)}
                      className="w-44"
                    >
                      {PERIODS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </Field>
                {budgetChanged && followers > 0 ? (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Dit verandert het budget van {followers}{" "}
                    {followers === 1 ? "medewerker" : "medewerkers"}.
                    {members.length > followers
                      ? ` ${members.length - followers} met een eigen uitzondering blijven gelijk.`
                      : ""}
                  </p>
                ) : null}
                <Field
                  label={`Welkomstpakket in ${unit === "credits" ? "credits" : "euro"}`}
                  hint="Eenmalig extra budget voor nieuwe medewerkers met deze functie."
                >
                  <Input
                    value={form.welcome}
                    inputMode="decimal"
                    placeholder="Geen"
                    disabled={!canRules}
                    onChange={(e) => set("welcome", e.target.value)}
                    className="w-36"
                  />
                </Field>
              </div>
            ) : null}

            {s.capsEnabled ? (
              <CapsEditor
                data={data}
                caps={form.caps}
                disabled={!canRules}
                onChange={(caps) => set("caps", caps)}
              />
            ) : null}
          </Section>

          {data.categories.length ? (
            <Section title="Catalogus">
              {fullCatalogue ? (
                <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Deze functie ziet alle bestellingen en daardoor altijd de volledige
                  catalogus.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={form.categories === null}
                    disabled={!canRules}
                    onClick={() => set("categories", null)}
                  >
                    Alle categorieën
                  </Chip>
                  {data.categories.map((c) => {
                    const on = form.categories === null || form.categories.includes(c.id);
                    return (
                      <Chip
                        key={c.id}
                        active={form.categories !== null && on}
                        muted={form.categories === null}
                        disabled={!canRules}
                        onClick={() => {
                          const current = form.categories ?? data.categories.map((x) => x.id);
                          const next = current.includes(c.id)
                            ? current.filter((x) => x !== c.id)
                            : [...current, c.id];
                          set(
                            "categories",
                            next.length === data.categories.length ? null : next,
                          );
                        }}
                      >
                        {c.name}
                      </Chip>
                    );
                  })}
                </div>
              )}
            </Section>
          ) : null}

          {data.products.length ? (
            <Section title="Assortiment voor deze functie" icon={PackageOpen}>
              <AssortmentEditor
                data={data}
                items={form.products}
                categories={fullCatalogue ? null : form.categories}
                disabled={!canRules}
                onChange={(products) => set("products", products)}
              />
            </Section>
          ) : null}

          <Section title="Medewerkers">
            {members.length ? (
              <ul className="divide-y rounded-xl border text-sm">
                {members.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onOpenPerson(m.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40"
                    >
                      <span className="font-medium">{m.full_name || m.email}</span>
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nog niemand heeft deze functie.</p>
            )}
          </Section>

          <Section title="Geschiedenis" icon={History}>
            {history === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : history.length ? (
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <p>{h.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.actor_name ?? "Onbekend"} · {formatDate(h.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nog geen wijzigingen vastgelegd.</p>
            )}
          </Section>
        </div>

        {canRoles || canRules ? (
          <div className="flex items-center gap-2 border-t bg-background px-4 py-3">
            {canRoles && !role.is_system ? (
              <Button variant="ghost" className="text-red-600" onClick={() => setDeleting(true)}>
                <Trash2 className="h-4 w-4" /> Verwijderen
              </Button>
            ) : null}
            <div className="ml-auto flex gap-2">
              {dirty ? (
                <Button variant="ghost" onClick={() => setForm(initial)} disabled={pending}>
                  Herstellen
                </Button>
              ) : null}
              <Button onClick={save} disabled={!dirty || pending || !form.name.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Opslaan
              </Button>
            </div>
          </div>
        ) : null}

        {deleting ? (
          <DeleteRoleDialog
            data={data}
            role={role}
            onClose={() => setDeleting(false)}
            onDeleted={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof History;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-1">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start justify-between gap-3 px-3 py-2.5 text-sm",
        disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/30",
      )}
    >
      <span>
        <span className="block">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
          checked ? "bg-[var(--brand)]" : "bg-muted-foreground/25",
          disabled && "opacity-60",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            checked && "translate-x-4",
          )}
        />
      </span>
    </label>
  );
}

function Chip({
  active,
  muted,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  muted?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition disabled:cursor-default",
        active
          ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-foreground)]"
          : muted
            ? "text-muted-foreground"
            : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function CapsEditor({
  data,
  caps,
  disabled,
  onChange,
}: {
  data: PersoneelData;
  caps: Cap[];
  disabled: boolean;
  onChange: (caps: Cap[]) => void;
}) {
  const used = new Set(caps.map((c) => c.productId));
  const free = data.products.filter((p) => !used.has(p.id));
  const update = (i: number, patch: Partial<Cap>) =>
    onChange(caps.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="mt-4">
      <p className="mb-1 text-sm font-medium">Maximum per product</p>
      <p className="mb-2 text-xs text-muted-foreground">
        {data.settings.uncapped === "blocked"
          ? "Alleen producten met een maximum zijn bestelbaar."
          : "Producten zonder maximum zijn vrij te bestellen."}
      </p>
      <div className="divide-y rounded-xl border text-sm">
        {caps.map((c, i) => (
          <div key={c.productId} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate">
              {data.products.find((p) => p.id === c.productId)?.name ?? "Product"}
            </span>
            <Input
              value={String(c.max)}
              inputMode="numeric"
              disabled={disabled}
              onChange={(e) => update(i, { max: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              className="h-9 w-20"
              aria-label="Maximum aantal"
            />
            <NativeSelect
              value={c.period}
              disabled={disabled}
              onChange={(e) => update(i, { period: e.target.value })}
              className="h-9 w-36"
            >
              {PERIODS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
            {!disabled ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Maximum verwijderen"
                onClick={() => onChange(caps.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {!caps.length ? (
          <p className="px-3 py-2 text-muted-foreground">Nog geen maxima voor deze functie.</p>
        ) : null}
        {!disabled && free.length ? (
          <div className="px-3 py-2">
            <NativeSelect
              value=""
              onChange={(e) =>
                e.target.value &&
                onChange([...caps, { productId: e.target.value, max: 1, period: "yearly" }])
              }
              className="h-9 w-64"
              aria-label="Product toevoegen"
            >
              <option value="">+ Product toevoegen…</option>
              {free.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DeleteRoleDialog({
  data,
  role,
  onClose,
  onDeleted,
}: {
  data: PersoneelData;
  role: PRole;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const members = membersOf(data, role.id);
  const others = data.roles.filter((r) => r.id !== role.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await deleteRole(data.companyId, role.id, members.length ? target : null);
      if (res.ok) {
        toast.success("Functie verwijderd");
        onDeleted();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Functie {role.name} verwijderen?</DialogTitle>
          <DialogDescription>
            Het budget, de maxima en de catalogusinstellingen van deze functie verdwijnen.
          </DialogDescription>
        </DialogHeader>
        {members.length ? (
          <Field
            label={`Waar gaan de ${members.length} medewerker(s) naartoe?`}
            hint="Ze krijgen het budget en de rechten van de gekozen functie."
          >
            <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={pending || (members.length > 0 && !target)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verwijderen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssortmentEditor({
  data,
  items,
  categories,
  disabled,
  onChange,
}: {
  data: PersoneelData;
  items: Assortment[];
  /** Categories this functie sees (null = all). */
  categories: string[] | null;
  disabled: boolean;
  onChange: (items: Assortment[]) => void;
}) {
  const used = new Set(items.map((i) => i.productId));
  const free = data.products.filter((p) => !used.has(p.id));
  const product = (id: string) => data.products.find((p) => p.id === id);
  const hidden = (id: string) => {
    const cat = product(id)?.category_id;
    return !!cat && categories !== null && !categories.includes(cat);
  };
  const update = (productId: string, patch: Partial<Assortment>) =>
    onChange(items.map((i) => (i.productId === productId ? { ...i, ...patch } : i)));

  function list(kind: Assortment["kind"], title: string, empty: string) {
    const rows = items.filter((i) => i.kind === kind);
    const total = rows.reduce((s, r) => s + r.quantity, 0);
    return (
      <div>
        <p className="mb-1.5 text-sm font-medium">
          {title}
          {kind === "starterspakket" && rows.length ? (
            <span className="font-normal text-muted-foreground"> · {total} stuks</span>
          ) : null}
        </p>
        <div className="divide-y rounded-xl border text-sm">
          {rows.map((r) => (
            <div key={r.productId} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{product(r.productId)?.name ?? "Product"}</span>
                {kind === "starterspakket" ? (
                  <Input
                    value={String(r.quantity)}
                    inputMode="numeric"
                    disabled={disabled}
                    onChange={(e) =>
                      update(r.productId, {
                        quantity: Math.min(99, Math.max(1, Math.floor(Number(e.target.value) || 1))),
                      })
                    }
                    className="h-8 w-16"
                    aria-label="Aantal in het starterspakket"
                  />
                ) : null}
                {!disabled ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Uit het assortiment halen"
                    onClick={() => onChange(items.filter((i) => i.productId !== r.productId))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              {hidden(r.productId) ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Deze functie ziet de categorie van dit product niet in de winkel.
                </p>
              ) : null}
            </div>
          ))}
          {!rows.length ? <p className="px-3 py-2 text-muted-foreground">{empty}</p> : null}
          {!disabled && free.length ? (
            <div className="px-3 py-2">
              <NativeSelect
                value=""
                onChange={(e) =>
                  e.target.value &&
                  onChange([...items, { productId: e.target.value, kind, quantity: 1 }])
                }
                className="h-9 w-64"
                aria-label={`Product toevoegen aan ${title.toLowerCase()}`}
              >
                <option value="">+ Product toevoegen…</option>
                {free.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Aanbevolen producten staan bovenaan de winkel van deze functie. Het starterspakket
        kunnen nieuwe medewerkers in één keer in hun winkelwagen leggen.
      </p>
      {list("aanbevolen", "Aanbevolen", "Nog geen aanbevolen producten.")}
      {list("starterspakket", "Starterspakket", "Nog geen starterspakket.")}
    </div>
  );
}
