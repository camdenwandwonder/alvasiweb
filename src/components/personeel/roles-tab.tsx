"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  Columns3,
  Eye,
  PackageOpen,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/primitives";
import { cn } from "@/lib/utils";
import {
  PERMISSION_GROUPS,
  ROLE_TEMPLATES,
  summarizePermissions,
} from "@/lib/permissions";
import { saveRole } from "@/lib/personeel/actions";
import type { PersoneelData } from "@/lib/personeel/data";
import { roleSummary, type Perms } from "./helpers";

export function RolesTab({
  data,
  perms,
  onOpen,
}: {
  data: PersoneelData;
  perms: Perms;
  onOpen: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [comparing, setComparing] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Een functie bepaalt wat medewerkers mogen, welk budget ze krijgen en welke
          producten ze zien.
        </p>
        <div className="flex gap-2">
          {data.roles.length > 1 ? (
            <Button variant="outline" onClick={() => setComparing(true)}>
              <Columns3 className="h-4 w-4" /> Functies vergelijken
            </Button>
          ) : null}
          {perms.roles ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nieuwe functie
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.roles.map((role) => {
          const s = roleSummary(data, role);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onOpen(role.id)}
              className="group flex flex-col rounded-xl border bg-card p-4 text-left transition hover:border-[var(--brand)]/50 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    {role.name}
                    {role.is_system ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Standaard
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {role.description || summarizePermissions(role.permissions)}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </div>
              <dl className="mt-4 grid gap-1.5 text-sm">
                <Row icon={Users} label="Medewerkers" value={String(s.members.length)} />
                {data.settings.payment !== "none" ? (
                  <Row icon={Wallet} label="Budget" value={s.budgetText} />
                ) : null}
                {data.settings.capsEnabled ? (
                  <Row
                    icon={Wallet}
                    label="Maxima"
                    value={s.caps.length ? `${s.caps.length} product(en)` : "Geen"}
                  />
                ) : null}
                <Row icon={Eye} label="Ziet" value={s.seesText} />
                <Row icon={ShieldCheck} label="Goedkeuring" value={s.approvalText} />
                {assortmentText(data, role.id) ? (
                  <Row icon={PackageOpen} label="Assortiment" value={assortmentText(data, role.id)!} />
                ) : null}
              </dl>
            </button>
          );
        })}
      </div>

      {creating ? (
        <NewRoleDialog
          data={data}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      ) : null}
      {comparing ? <CompareDialog data={data} onClose={() => setComparing(false)} /> : null}
    </div>
  );
}

function assortmentText(data: PersoneelData, roleId: string): string | null {
  const rows = data.roleProducts.filter((r) => r.role_id === roleId);
  if (!rows.length) return null;
  const recommended = rows.filter((r) => r.kind === "aanbevolen").length;
  const kit = rows.filter((r) => r.kind === "starterspakket").reduce((s, r) => s + r.quantity, 0);
  return [recommended ? `${recommended} aanbevolen` : null, kit ? `pakket ${kit} stuks` : null]
    .filter(Boolean)
    .join(" · ");
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{value}</dd>
    </div>
  );
}

function NewRoleDialog({
  data,
  onClose,
  onCreated,
}: {
  data: PersoneelData;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [template, setTemplate] = useState(ROLE_TEMPLATES[0]!.key);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();
  const chosen = ROLE_TEMPLATES.find((t) => t.key === template)!;

  function submit() {
    start(async () => {
      const res = await saveRole(data.companyId, {
        name,
        description,
        permissions: chosen.permissions,
        requiresApproval: false,
        welcomeAmount: null,
        budget: null,
        caps: [],
        categories: null,
      });
      if (res.ok) {
        toast.success("Functie aangemaakt");
        onCreated(res.id);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nieuwe functie</DialogTitle>
          <DialogDescription>
            Kies een startpunt. Budget, maxima en catalogus stel je daarna in.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {ROLE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTemplate(t.key);
                if (!name || ROLE_TEMPLATES.some((x) => x.label === name)) setName(t.label);
              }}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                template === t.key ? "border-[var(--brand)] bg-[var(--brand)]/5" : "hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  template === t.key && "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-foreground)]",
                )}
              >
                {template === t.key ? <Check className="h-3 w-3" /> : null}
              </span>
              <span>
                <span className="block font-medium">{t.label}</span>
                <span className="block text-sm text-muted-foreground">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
        <Field label="Naam" htmlFor="role-name">
          <Input
            id="role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bijvoorbeeld Monteur"
          />
        </Field>
        <Field label="Omschrijving (optioneel)" htmlFor="role-desc">
          <Textarea
            id="role-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={!name.trim() || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Functie aanmaken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompareDialog({ data, onClose }: { data: PersoneelData; onClose: () => void }) {
  const roles = data.roles;
  const summaries = roles.map((r) => roleSummary(data, r));
  const yes = <Check className="mx-auto h-4 w-4 text-green-600" />;
  const no = <span className="text-muted-foreground">–</span>;

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Functies vergelijken</DialogTitle>
          <DialogDescription>Alle functies en hun rechten naast elkaar.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 bg-muted/40 px-3 py-2 text-left font-medium" />
                {roles.map((r) => (
                  <th key={r.id} className="min-w-28 px-3 py-2 text-center font-semibold">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <SummaryRow label="Medewerkers" values={summaries.map((s) => String(s.members.length))} />
              {data.settings.payment !== "none" ? (
                <SummaryRow label="Budget" values={summaries.map((s) => s.budgetText)} />
              ) : null}
              {data.settings.capsEnabled ? (
                <SummaryRow
                  label="Maxima"
                  values={summaries.map((s) => (s.caps.length ? `${s.caps.length} product(en)` : "Geen"))}
                />
              ) : null}
              <SummaryRow label="Ziet" values={summaries.map((s) => s.seesText)} />
              <SummaryRow label="Goedkeuring" values={summaries.map((s) => s.approvalText)} />
              {PERMISSION_GROUPS.map((g) => (
                <GroupRows key={g.title} title={g.title} cols={roles.length}>
                  {g.items.map((item) => (
                    <tr key={item.key}>
                      <td className="sticky left-0 bg-background px-3 py-2">{item.label}</td>
                      {roles.map((r) => (
                        <td key={r.id} className="px-3 py-2 text-center">
                          {r.permissions.includes(item.key) ? yes : no}
                        </td>
                      ))}
                    </tr>
                  ))}
                </GroupRows>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr>
      <td className="sticky left-0 bg-background px-3 py-2 font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2 text-center text-muted-foreground">
          {v}
        </td>
      ))}
    </tr>
  );
}

function GroupRows({
  title,
  cols,
  children,
}: {
  title: string;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={cols + 1} className="px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}
