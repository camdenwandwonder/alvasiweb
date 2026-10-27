"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ChevronDown, Loader2, MapPin, Pencil, Phone, Plus, RotateCcw, Search, Star, UserRound } from "lucide-react";
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
  archiveAddress,
  openOrdersForAddress,
  restoreAddress,
  saveAddress,
  setDefaultAddress,
  type AddressInput,
  type CompanyAddress,
} from "@/lib/address-actions";

const EMPTY: AddressInput = {
  label: "",
  recipient: "",
  street: "",
  postal_code: "",
  city: "",
  country: "",
  contact_name: "",
  phone: "",
  instructions: "",
  is_default: false,
};

export function AddressesManager({ companyId, addresses }: { companyId: string; addresses: CompanyAddress[] }) {
  const router = useRouter();
  const active = addresses.filter((a) => !a.archived_at).sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.sort_order - b.sort_order);
  const archived = addresses.filter((a) => a.archived_at);
  const [editing, setEditing] = useState<AddressInput | null>(null);
  const [archiving, setArchiving] = useState<{ address: CompanyAddress; openOrders: number } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(done);
        after?.();
        router.refresh();
      } else toast.error(res.error ?? "Dat is niet gelukt.");
    });
  }

  function askArchive(a: CompanyAddress) {
    if (a.is_default) {
      toast.error("Maak eerst een ander adres standaard voordat je dit adres archiveert.");
      return;
    }
    start(async () => {
      const openOrders = await openOrdersForAddress(companyId, a.id);
      setArchiving({ address: a, openOrders });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY, is_default: active.length === 0 })}>
          <Plus className="h-4 w-4" /> Adres toevoegen
        </Button>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
          <MapPin className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="font-medium">Nog geen leveradressen</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Voeg de vestigingen toe waar bestellingen naartoe gaan. Medewerkers kiezen er één bij het afronden.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {active.map((a) => (
            <AddressCard
              key={a.id}
              a={a}
              pending={pending}
              onEdit={() => setEditing(toInput(a))}
              onDefault={() => run(() => setDefaultAddress(companyId, a.id), `${a.label} is nu het standaardadres`)}
              onArchive={() => askArchive(a)}
            />
          ))}
        </ul>
      )}

      {archived.length ? (
        <div className="rounded-xl border">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            aria-expanded={showArchived}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          >
            Gearchiveerd ({archived.length})
            <ChevronDown className={cn("h-4 w-4 transition", showArchived && "rotate-180")} />
          </button>
          {showArchived ? (
            <ul className="divide-y border-t">
              {archived.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{a.label}</span>
                    <span className="block truncate text-muted-foreground">{addressLine(a)}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => restoreAddress(companyId, a.id), `${a.label} teruggezet`)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Terugzetten
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <AddressDialog
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            run(() => saveAddress(companyId, input), input.id ? "Adres opgeslagen" : "Adres toegevoegd", () => setEditing(null))
          }
          pending={pending}
        />
      ) : null}

      {archiving ? (
        <Dialog open onOpenChange={(o) => (o ? null : setArchiving(null))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{archiving.address.label} archiveren?</DialogTitle>
              <DialogDescription>
                Medewerkers kunnen dit adres daarna niet meer kiezen. Je kunt het later terugzetten.
              </DialogDescription>
            </DialogHeader>
            {archiving.openOrders ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {archiving.openOrders === 1
                  ? "1 open bestelling gaat nog naar dit adres."
                  : `${archiving.openOrders} open bestellingen gaan nog naar dit adres.`}{" "}
                Die worden gewoon op dit adres geleverd.
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setArchiving(null)}>
                Annuleren
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  run(() => archiveAddress(companyId, archiving.address.id), `${archiving.address.label} gearchiveerd`, () =>
                    setArchiving(null),
                  )
                }
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Adres archiveren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function toInput(a: CompanyAddress): AddressInput {
  return {
    id: a.id,
    label: a.label,
    recipient: a.recipient ?? "",
    street: a.street ?? "",
    postal_code: a.postal_code ?? "",
    city: a.city ?? "",
    country: a.country ?? "",
    contact_name: a.contact_name ?? "",
    phone: a.phone ?? "",
    instructions: a.instructions ?? "",
    is_default: a.is_default,
  };
}

function addressLine(a: CompanyAddress): string {
  return [a.street, [a.postal_code, a.city].filter(Boolean).join(" "), a.country].filter(Boolean).join(", ");
}

function AddressCard({
  a,
  pending,
  onEdit,
  onDefault,
  onArchive,
}: {
  a: CompanyAddress;
  pending: boolean;
  onEdit: () => void;
  onDefault: () => void;
  onArchive: () => void;
}) {
  return (
    <li className={cn("flex flex-col rounded-xl border bg-card p-4", a.is_default && "border-[var(--brand)]/40")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{a.label}</p>
        {a.is_default ? (
          <span className="rounded-md bg-[var(--brand)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand-foreground)]">
            Standaard
          </span>
        ) : null}
      </div>
      <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
        {a.recipient ? <p>t.a.v. {a.recipient}</p> : null}
        {a.street ? <p>{a.street}</p> : null}
        <p>{[a.postal_code, a.city].filter(Boolean).join(" ")}</p>
        {a.country ? <p>{a.country}</p> : null}
      </div>
      {a.contact_name || a.phone || a.instructions ? (
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          {a.contact_name ? (
            <p className="flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" /> {a.contact_name}
            </p>
          ) : null}
          {a.phone ? (
            <p className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {a.phone}
            </p>
          ) : null}
          {a.instructions ? <p className="text-muted-foreground">{a.instructions}</p> : null}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-1 pt-3">
        <Button size="sm" variant="ghost" onClick={onEdit} disabled={pending}>
          <Pencil className="h-3.5 w-3.5" /> Bewerken
        </Button>
        {!a.is_default ? (
          <>
            <Button size="sm" variant="ghost" onClick={onDefault} disabled={pending}>
              <Star className="h-3.5 w-3.5" /> Maak standaard
            </Button>
            <Button size="sm" variant="ghost" onClick={onArchive} disabled={pending}>
              <Archive className="h-3.5 w-3.5" /> Archiveren
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function AddressDialog({
  value,
  onClose,
  onSave,
  pending,
}: {
  value: AddressInput;
  onClose: () => void;
  onSave: (input: AddressInput) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState(value);
  const [number, setNumber] = useState(() => value.street.match(/\d+\S*$/)?.[0] ?? "");
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const set = (k: keyof AddressInput, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function lookup() {
    setLookupMsg(null);
    if (!form.postal_code.trim() || !number.trim()) {
      setLookupMsg("Vul postcode en huisnummer in.");
      return;
    }
    setLooking(true);
    try {
      const res = await fetch(
        `/api/adres?postcode=${encodeURIComponent(form.postal_code)}&huisnummer=${encodeURIComponent(number)}`,
      );
      const json = (await res.json()) as { street?: string; city?: string; error?: string };
      if (res.ok && json.street && json.city) {
        setForm((f) => ({ ...f, street: `${json.street} ${number.trim()}`, city: json.city!, country: f.country || "Nederland" }));
        setLookupMsg(null);
      } else setLookupMsg(json.error ?? "Geen adres gevonden. Vul het zelf in.");
    } catch {
      setLookupMsg("Adres opzoeken lukt nu niet. Vul het zelf in.");
    } finally {
      setLooking(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{value.id ? "Adres bewerken" : "Adres toevoegen"}</DialogTitle>
          <DialogDescription>Vul postcode en huisnummer in, dan zoeken we straat en plaats op.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <Field label="Naam van het adres" hint="Bijvoorbeeld Hoofdkantoor of Werkplaats Zwolle." htmlFor="adr-label">
            <Input id="adr-label" required value={form.label} onChange={(e) => set("label", e.target.value)} />
          </Field>
          <div className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
            <Field label="Postcode" htmlFor="adr-pc">
              <Input id="adr-pc" value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="1234 AB" autoComplete="postal-code" />
            </Field>
            <Field label="Huisnummer" htmlFor="adr-nr">
              <Input id="adr-nr" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="12a" />
            </Field>
            <Button type="button" variant="outline" onClick={lookup} disabled={looking} className="h-11">
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Zoek
            </Button>
          </div>
          {lookupMsg ? <p className="text-sm text-amber-800">{lookupMsg}</p> : null}
          <Field label="Straat en huisnummer" htmlFor="adr-street">
            <Input id="adr-street" required value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="street-address" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plaats" htmlFor="adr-city">
              <Input id="adr-city" required value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
            </Field>
            <Field label="Land" htmlFor="adr-country">
              <Input id="adr-country" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Nederland" />
            </Field>
          </div>
          <Field label="Ter attentie van (optioneel)" htmlFor="adr-rec">
            <Input id="adr-rec" value={form.recipient} onChange={(e) => set("recipient", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contactpersoon (optioneel)" htmlFor="adr-contact">
              <Input id="adr-contact" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </Field>
            <Field label="Telefoon (optioneel)" htmlFor="adr-phone">
              <Input id="adr-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>
          <Field label="Afleverinstructie (optioneel)" htmlFor="adr-instr">
            <Textarea
              id="adr-instr"
              rows={2}
              maxLength={300}
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="Bijvoorbeeld: achterom, bij de werkplaats aanbellen"
            />
          </Field>
          {!value.is_default ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} onChange={(e) => set("is_default", e.target.checked)} className="h-4 w-4" />
              Maak dit het standaard leveradres
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {value.id ? "Adres opslaan" : "Adres toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
