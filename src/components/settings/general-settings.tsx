"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/primitives";
import { cn } from "@/lib/utils";
import type { OrderPrefs, ReferenceMode } from "@/lib/company-prefs";
import { saveAlvasiContact, saveCompanyGeneral, saveOrderPreferences } from "@/lib/settings/actions";
import { SettingsBlock, UnsavedHint, useUnsavedWarning } from "./section";

export type CompanyGeneral = {
  id: string;
  name: string;
  short_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  alvasi_contact_name: string | null;
  alvasi_contact_email: string | null;
  alvasi_contact_phone: string | null;
};

const empty = (v: string | null) => v ?? "";

export function CompanyDetailsBlock({ company }: { company: CompanyGeneral }) {
  const initial = {
    name: company.name,
    short_name: empty(company.short_name),
    contact_name: empty(company.contact_name),
    contact_email: empty(company.contact_email),
    contact_phone: empty(company.contact_phone),
  };
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedWarning(editing && dirty);

  const rows: { key: keyof typeof form; label: string; hint?: string; type?: string }[] = [
    { key: "name", label: "Bedrijfsnaam" },
    { key: "short_name", label: "Korte naam", hint: "Staat in de zijbalk als de volledige naam te lang is." },
    { key: "contact_name", label: "Contactpersoon" },
    { key: "contact_email", label: "E-mail contactpersoon", type: "email" },
    { key: "contact_phone", label: "Telefoon contactpersoon", type: "tel" },
  ];

  function save() {
    start(async () => {
      const res = await saveCompanyGeneral(company.id, form);
      if (res.ok) {
        toast.success("Opgeslagen");
        setEditing(false);
      } else toast.error(res.error);
    });
  }

  return (
    <SettingsBlock
      title="Bedrijfsgegevens"
      description="De naam van je portaal en wie Alvasi kan benaderen bij vragen over bestellingen."
    >
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {rows.map((r) => (
            <Field key={r.key} label={r.label} hint={r.hint} htmlFor={`gen-${r.key}`}>
              <Input
                id={`gen-${r.key}`}
                type={r.type ?? "text"}
                value={form[r.key]}
                required={r.key === "name"}
                onChange={(e) => setForm({ ...form, [r.key]: e.target.value })}
              />
            </Field>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Gegevens opslaan
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(initial);
                setEditing(false);
              }}
            >
              Annuleren
            </Button>
            <UnsavedHint dirty={dirty} />
          </div>
        </form>
      ) : (
        <dl className="divide-y text-sm">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <dt className="w-44 shrink-0 text-muted-foreground">{r.label}</dt>
              <dd className={cn("min-w-0 flex-1 truncate", !form[r.key] && "text-muted-foreground")}>
                {form[r.key] || "Niet ingevuld"}
              </dd>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm font-medium text-[var(--brand)] hover:underline"
              >
                {form[r.key] ? "Wijzig" : "Toevoegen"}
                <span className="sr-only"> {r.label.toLowerCase()}</span>
              </button>
            </div>
          ))}
        </dl>
      )}
    </SettingsBlock>
  );
}

/** Read-only for the company; editable for Alvasi (superadmin). */
export function AlvasiContactBlock({ company, editable }: { company: CompanyGeneral; editable: boolean }) {
  const initial = {
    name: empty(company.alvasi_contact_name),
    email: empty(company.alvasi_contact_email),
    phone: empty(company.alvasi_contact_phone),
  };
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedWarning(editable && dirty);
  const filled = initial.name || initial.email || initial.phone;

  return (
    <SettingsBlock
      title="Je contactpersoon bij Alvasi"
      description={editable ? "Wie het bedrijf kan bellen of mailen bij vragen." : "Voor vragen over producten, proeven en levering."}
    >
      {editable ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveAlvasiContact(company.id, form);
              if (res.ok) toast.success("Opgeslagen");
              else toast.error(res.error);
            });
          }}
        >
          <Field label="Naam" htmlFor="alv-name">
            <Input id="alv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="E-mail" htmlFor="alv-email">
            <Input id="alv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Telefoon" htmlFor="alv-phone">
            <Input id="alv-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Contactpersoon opslaan
            </Button>
            <UnsavedHint dirty={dirty} />
          </div>
        </form>
      ) : filled ? (
        <div className="text-sm">
          <p className="font-medium">{initial.name || "Alvasi"}</p>
          {initial.email ? (
            <a href={`mailto:${initial.email}`} className="block text-[var(--brand)] hover:underline">
              {initial.email}
            </a>
          ) : null}
          {initial.phone ? (
            <a href={`tel:${initial.phone.replace(/\s+/g, "")}`} className="block text-muted-foreground hover:text-foreground">
              {initial.phone}
            </a>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nog niet ingevuld door Alvasi.</p>
      )}
    </SettingsBlock>
  );
}

const MODE_LABEL: Record<ReferenceMode, { title: string; text: string }> = {
  off: { title: "Uit", text: "Niet tonen bij bestellen" },
  ask: { title: "Vragen", text: "Optioneel invullen" },
  required: { title: "Verplicht", text: "Moet ingevuld zijn" },
};

function ModePicker({
  value,
  onChange,
  name,
}: {
  value: ReferenceMode;
  onChange: (m: ReferenceMode) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(MODE_LABEL) as ReferenceMode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-lg border p-2.5 text-left text-sm transition",
            value === m ? "border-[var(--brand)] bg-[var(--brand)]/5 ring-1 ring-[var(--brand)]" : "hover:bg-muted/50",
          )}
        >
          <span className="block font-medium">{MODE_LABEL[m].title}</span>
          <span className="block text-xs text-muted-foreground">{MODE_LABEL[m].text}</span>
        </button>
      ))}
    </div>
  );
}

export function OrderPrefsBlock({ companyId, prefs }: { companyId: string; prefs: OrderPrefs }) {
  const [form, setForm] = useState(prefs);
  const [newCenter, setNewCenter] = useState("");
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(prefs);
  useUnsavedWarning(dirty);

  function addCenter() {
    const v = newCenter.trim();
    if (!v || form.costCenters.includes(v)) return;
    setForm({ ...form, costCenters: [...form.costCenters, v] });
    setNewCenter("");
  }
  function move(i: number, d: -1 | 1) {
    const list = [...form.costCenters];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    setForm({ ...form, costCenters: list });
  }

  return (
    <SettingsBlock
      title="Bestelvoorkeuren"
      description="Extra gegevens bij elke bestelling, bijvoorbeeld voor jullie administratie. Ze staan op de bestelling, de pakbon en in de export."
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveOrderPreferences(companyId, form);
            if (res.ok) toast.success("Opgeslagen");
            else toast.error(res.error);
          });
        }}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Bestelreferentie</p>
          <ModePicker value={form.reference} onChange={(reference) => setForm({ ...form, reference })} name="Bestelreferentie" />
          {form.reference !== "off" ? (
            <Field label="Naam van het veld" hint="Zoals medewerkers het zien, bijvoorbeeld PO-nummer of Projectnummer." htmlFor="ref-label">
              <Input
                id="ref-label"
                value={form.referenceLabel}
                maxLength={40}
                onChange={(e) => setForm({ ...form, referenceLabel: e.target.value })}
              />
            </Field>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Kostenplaats</p>
          <ModePicker value={form.costCenter} onChange={(costCenter) => setForm({ ...form, costCenter })} name="Kostenplaats" />
          {form.costCenter !== "off" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Medewerkers kiezen er één uit deze lijst. Zonder kostenplaatsen staat dit veld uit.
              </p>
              {form.costCenters.length ? (
                <ul className="divide-y rounded-lg border">
                  {form.costCenters.map((c, i) => (
                    <li key={c} className="flex items-center gap-1 px-3 py-1.5 text-sm">
                      <span className="flex-1 truncate">{c}</span>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`${c} omhoog`} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`${c} omlaag`}
                        disabled={i === form.costCenters.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`${c} verwijderen`}
                        onClick={() => setForm({ ...form, costCenters: form.costCenters.filter((x) => x !== c) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <Input
                  value={newCenter}
                  onChange={(e) => setNewCenter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCenter();
                    }
                  }}
                  placeholder="Bijvoorbeeld Werkplaats Nieuwleusen"
                  aria-label="Nieuwe kostenplaats"
                  maxLength={60}
                />
                <Button type="button" variant="outline" onClick={addCenter} disabled={!newCenter.trim()}>
                  <Plus className="h-4 w-4" /> Toevoegen
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Bestelvoorkeuren opslaan
          </Button>
          <UnsavedHint dirty={dirty} />
        </div>
      </form>
    </SettingsBlock>
  );
}
