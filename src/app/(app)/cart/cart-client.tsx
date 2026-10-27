"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Hash,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  PenLine,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/cart";
import { CartLine, SavedList } from "@/components/cart/cart-line";
import { BudgetSummary } from "@/components/cart/cart-drawer";
import { cartAmount } from "@/components/cart/cart-format";
import { useCartCheck } from "@/components/cart/use-cart-check";
import { RecipientSwitch, type RecipientOption } from "@/components/shop/recipient-switch";
import { NativeSelect } from "@/components/primitives";
import type { OrderPrefs } from "@/lib/company-prefs";
import { createOrderFromCart } from "./actions";

export type DeliveryAddress = {
  id: string;
  label: string;
  recipient: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  is_default: boolean;
};

const CUSTOM = "__custom__";

export function CartClient({
  addresses,
  me,
  recipient,
  people,
  prefs,
}: {
  addresses: DeliveryAddress[];
  me: string;
  recipient: { id: string; name: string; roleName: string | null } | null;
  /** People a manager may order for (null = no permission). */
  people: RecipientOption[] | null;
  /** Order reference and cost centre settings of the company. */
  prefs: OrderPrefs;
}) {
  const cart = useCart();
  const router = useRouter();
  const hasAddresses = addresses.length > 0;
  const [selection, setSelection] = useState<string>(
    hasAddresses ? (addresses.find((a) => a.is_default) ?? addresses[0])!.id : CUSTOM,
  );
  const isCustom = selection === CUSTOM;
  const [ship, setShip] = useState({ name: "", address: "", postal: "", city: "", country: "" });
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const clientKey = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
  );
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const { check, error, loading, lineCheck } = useCartCheck({
    addressId: isCustom ? null : selection,
    custom: isCustom,
  });
  const unavailable = check?.lines.filter((l) => !l.available) ?? [];
  const customIncomplete = isCustom && (!ship.address.trim() || !ship.city.trim());
  const isRequest = !!check?.approval.required;
  const total = cartAmount(
    check?.totals.euro ?? cart.subtotal,
    check?.totals.credits ?? cart.creditsSubtotal,
    cart.display,
    cart.payment,
  );
  const blocked =
    check?.blocked ??
    (unavailable.length
      ? `Verwijder eerst ${unavailable.length === 1 ? "het product dat" : "de producten die"} niet meer beschikbaar ${
          unavailable.length === 1 ? "is" : "zijn"
        }.`
      : customIncomplete
        ? "Vul het afwijkende leveradres in (straat en plaats)."
        : prefs.reference === "required" && !reference.trim()
          ? `Vul de ${prefs.referenceLabel.toLowerCase()} in.`
          : prefs.costCenter === "required" && !costCenter
            ? "Kies een kostenplaats."
            : null);

  async function submit() {
    if (blocked || submitting) return;
    if (check?.reasonRequired && !reason.trim()) {
      setReasonError(true);
      reasonRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await createOrderFromCart(
        cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          variantLabel: i.variantLabel,
          qty: i.qty,
        })),
        {
          addressId: isCustom ? null : selection,
          custom: isCustom ? ship : undefined,
          note: note.trim() || undefined,
          reference: reference.trim() || undefined,
          costCenter: costCenter || undefined,
        },
        { reason: reason.trim() || undefined, clientKey: clientKey.current },
      );
      if (!res.ok) {
        if (res.code === "reason_required") {
          setReasonError(true);
          reasonRef.current?.focus();
        } else toast.error(res.error);
        setSubmitting(false);
        return;
      }
      cart.clear();
      router.push(`/bestelling-geplaatst/${res.orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis. Probeer het opnieuw.");
      setSubmitting(false);
    }
  }

  const header = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bestelling afronden</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controleer je bestelling. Er is nog niets verstuurd.
        </p>
      </div>
    </div>
  );

  const forBlock = recipient || people ? (
    <Section icon={UserRound} title="Voor wie">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {recipient ? (
            <>
              <span className="font-medium">{recipient.name}</span>
              {recipient.roleName ? <span className="text-muted-foreground"> · {recipient.roleName}</span> : null}
              <span className="text-muted-foreground"> (namens jou). Het budget en de maxima van deze medewerker gelden.</span>
            </>
          ) : (
            <>
              <span className="font-medium">Jezelf</span>
              <span className="text-muted-foreground"> · {me}</span>
            </>
          )}
        </p>
        {people && people.length ? (
          <RecipientSwitch
            people={people}
            current={recipient ? { id: recipient.id, name: recipient.name } : null}
          />
        ) : null}
      </div>
    </Section>
  ) : null;

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        {forBlock}
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingCart className="h-5 w-5" />
          </span>
          <p className="font-medium">Je winkelwagen is leeg</p>
          <p className="mt-1 text-sm text-muted-foreground">Kies producten in de winkel.</p>
          <Link href="/products" className={cn("mt-4", buttonVariants())}>
            Naar de winkel
          </Link>
        </div>
        <SavedList />
      </div>
    );
  }

  const submitLabel = isRequest ? "Aanvraag indienen" : "Bestelling plaatsen";

  return (
    <div className="pb-24 lg:pb-0">
      {header}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {forBlock}

          <Section icon={ShoppingCart} title={`Producten (${cart.count})`}>
            <ul className="divide-y">
              {cart.items.map((i, idx) => (
                <CartLine
                  key={`${i.productId}-${i.variantId ?? ""}`}
                  item={i}
                  index={idx}
                  check={lineCheck(i.productId, i.variantId)}
                  full
                />
              ))}
            </ul>
            <SavedList />
          </Section>

          <Section icon={MapPin} title="Levering">
            <div role="radiogroup" aria-label="Leveradres" className="grid gap-2 sm:grid-cols-2">
              {addresses.map((a) => (
                <AddressCard
                  key={a.id}
                  selected={selection === a.id}
                  onSelect={() => setSelection(a.id)}
                  title={`${a.label}${a.is_default ? " (standaard)" : ""}`}
                  lines={[a.recipient, a.street, [a.postal_code, a.city].filter(Boolean).join(" ")]}
                />
              ))}
              <AddressCard
                selected={isCustom}
                onSelect={() => setSelection(CUSTOM)}
                title="Ander adres"
                lines={[hasAddresses ? "Een ander adres moet worden goedgekeurd" : "Vul het leveradres in"]}
                warn={hasAddresses}
              />
            </div>
            {isCustom ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Input placeholder="Naam ontvanger" value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} aria-label="Naam ontvanger" />
                <Input placeholder="Straat en huisnummer" value={ship.address} onChange={(e) => setShip({ ...ship, address: e.target.value })} aria-label="Straat en huisnummer" />
                <Input placeholder="Postcode" value={ship.postal} onChange={(e) => setShip({ ...ship, postal: e.target.value })} aria-label="Postcode" />
                <Input placeholder="Plaats" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} aria-label="Plaats" />
                <Input placeholder="Land (optioneel)" value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value })} aria-label="Land" className="sm:col-span-2" />
              </div>
            ) : null}
          </Section>

          {prefs.reference !== "off" || prefs.costCenter !== "off" ? (
            <Section icon={Hash} title="Bestelgegevens">
              <div className="grid gap-3 sm:grid-cols-2">
                {prefs.reference !== "off" ? (
                  <div>
                    <label htmlFor="bestelreferentie" className="mb-1.5 block text-sm font-medium">
                      {prefs.referenceLabel}
                      {prefs.reference === "ask" ? (
                        <span className="font-normal text-muted-foreground"> (optioneel)</span>
                      ) : null}
                    </label>
                    <Input
                      id="bestelreferentie"
                      value={reference}
                      maxLength={60}
                      onChange={(e) => setReference(e.target.value)}
                      required={prefs.reference === "required"}
                    />
                  </div>
                ) : null}
                {prefs.costCenter !== "off" ? (
                  <div>
                    <label htmlFor="kostenplaats" className="mb-1.5 block text-sm font-medium">
                      Kostenplaats
                      {prefs.costCenter === "ask" ? (
                        <span className="font-normal text-muted-foreground"> (optioneel)</span>
                      ) : null}
                    </label>
                    <NativeSelect
                      id="kostenplaats"
                      value={costCenter}
                      onChange={(e) => setCostCenter(e.target.value)}
                      className="h-9"
                    >
                      <option value="">{prefs.costCenter === "required" ? "Kies een kostenplaats" : "Geen"}</option>
                      {prefs.costCenters.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}

          <Section icon={PenLine} title="Opmerking" optional>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Bijvoorbeeld: graag afleveren bij de receptie"
              aria-label="Opmerking"
            />
          </Section>
        </div>

        {/* Overzicht */}
        <aside className="space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="text-base font-semibold">Overzicht</h2>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              {cart.count} {cart.count === 1 ? "artikel" : "artikelen"}
            </span>
            <span className="flex items-center gap-2 text-xl font-semibold tabular-nums">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              {total}
            </span>
          </div>

          <BudgetSummary check={check} />

          {check ? (
            isRequest ? (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                <p className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4" /> Gaat ter goedkeuring
                </p>
                <p className="mt-1 text-amber-900">
                  {check.approval.approvers.length
                    ? `${check.approval.approvers.join(" of ")} beoordeelt deze aanvraag, omdat:`
                    : "Je leidinggevende beoordeelt deze aanvraag, omdat:"}
                </p>
                <ul className="mt-1 list-disc pl-5 text-amber-900">
                  {check.approval.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-900">
                <CheckCircle2 className="h-4 w-4" /> Gaat direct door, zonder goedkeuring
              </p>
            )
          ) : null}

          {check?.reasonRequired ? (
            <div>
              <label htmlFor="reden" className="mb-1.5 block text-sm font-medium">
                Waarom heb je meer nodig dan je budget?
              </label>
              <Textarea
                id="reden"
                ref={reasonRef}
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(false);
                }}
                aria-invalid={reasonError}
                aria-describedby={reasonError ? "reden-fout" : undefined}
                placeholder="Bijvoorbeeld: nieuwe werkzaamheden waarvoor extra kleding nodig is"
              />
              {reasonError ? (
                <p id="reden-fout" className="mt-1 text-sm text-red-700">
                  Geef een reden op waarom je boven je budget bestelt.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="flex items-start gap-2 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
          {blocked ? (
            <p className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {blocked}
            </p>
          ) : null}

          <Button
            size="lg"
            className="hidden w-full lg:inline-flex"
            onClick={submit}
            disabled={!!blocked || submitting || !check}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitLabel}
          </Button>
          <Link href="/products" className="block text-center text-sm text-muted-foreground hover:text-foreground">
            Verder winkelen
          </Link>
        </aside>
      </div>

      {/* Mobiel: knop altijd onderin */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{cart.count} artikelen</p>
          {total ? <p className="font-semibold tabular-nums">{total}</p> : null}
        </div>
        <Button size="lg" onClick={submit} disabled={!!blocked || submitting || !check}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  optional,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
        {optional ? <span className="text-sm font-normal text-muted-foreground">(optioneel)</span> : null}
      </h2>
      {children}
    </section>
  );
}

function AddressCard({
  selected,
  onSelect,
  title,
  lines,
  warn,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  lines: (string | null)[];
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition",
        selected ? "border-[var(--brand)] bg-[var(--brand)]/5 ring-1 ring-[var(--brand)]" : "hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected && "border-[var(--brand)]",
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-[var(--brand)]" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        {lines.filter(Boolean).map((l, i) => (
          <span key={i} className={cn("block", warn ? "text-amber-700" : "text-muted-foreground")}>
            {l}
          </span>
        ))}
      </span>
    </button>
  );
}
