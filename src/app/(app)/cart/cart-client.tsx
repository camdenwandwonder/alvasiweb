"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Package,
  Loader2,
  MapPin,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/primitives";
import { useCart } from "@/components/cart";
import { formatPrice } from "@/lib/format";
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

function addressLine(a: DeliveryAddress): string {
  return (
    [
      a.recipient,
      a.street,
      [a.postal_code, a.city].filter(Boolean).join(" "),
      a.country,
    ]
      .filter(Boolean)
      .join(" · ") || "Geen adresgegevens"
  );
}

export function CartClient({ addresses }: { addresses: DeliveryAddress[] }) {
  const cart = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [requireReason, setRequireReason] = useState(false);
  const [reason, setReason] = useState("");

  const hasAddresses = addresses.length > 0;
  const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0];
  const [selection, setSelection] = useState<string>(
    hasAddresses ? (defaultAddr?.id ?? CUSTOM) : CUSTOM,
  );
  const [ship, setShip] = useState({
    name: "",
    address: "",
    postal: "",
    city: "",
    country: "",
  });
  const [note, setNote] = useState("");

  const isCustom = selection === CUSTOM;
  const selectedAddress = addresses.find((a) => a.id === selection) ?? null;
  // A manual address counts as a deviation only when standard addresses exist.
  const willNeedApproval = isCustom && hasAddresses;

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (requireReason && !reason.trim()) {
      toast.error("Geef een reden op voor je aanvraag.");
      return;
    }
    setSubmitting(true);
    try {
      const { orderId, isRequest } = await createOrderFromCart(
        cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          qty: i.qty,
        })),
        {
          addressId: isCustom ? null : selection,
          custom: isCustom ? ship : undefined,
          note: note.trim() || undefined,
        },
        { reason: reason.trim() || undefined },
      );
      cart.clear();
      toast.success(isRequest ? "Aanvraag ingediend" : "Bestelling geplaatst");
      router.push(`/orders/${orderId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Er ging iets mis";
      if (msg.toLowerCase().includes("reden")) {
        setRequireReason(true);
        toast.warning(
          "Je budget/limiet is bereikt. Geef een reden op om dit aan te vragen.",
        );
      } else {
        toast.error(msg);
      }
      setSubmitting(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Winkelwagen
        </h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShoppingCart className="h-5 w-5" />
          </span>
          <p className="font-medium">Je winkelwagen is leeg</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Voeg producten toe vanuit de winkel.
          </p>
          <Link href="/products" className={`mt-4 ${buttonVariants()}`}>
            Naar de winkel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Winkelwagen</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <ul className="space-y-3">
          {cart.items.map((i) => (
            <li
              key={`${i.productId}-${i.variantId ?? ""}`}
              className="flex gap-4 rounded-xl border bg-card p-3"
            >
              {i.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={i.image}
                  alt={i.name}
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="h-6 w-6" />
                </div>
              )}
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{i.name}</p>
                    {i.variantLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {i.variantLabel}
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => cart.removeItem(i.productId, i.variantId)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Verwijderen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() =>
                        cart.setQty(i.productId, i.variantId, i.qty - 1)
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm">{i.qty}</span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() =>
                        cart.setQty(i.productId, i.variantId, i.qty + 1)
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-sm font-medium">
                    {formatPrice(i.unitPrice * i.qty)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Checkout */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Afrekenen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between border-b pb-4">
              <span className="text-sm text-muted-foreground">Totaal</span>
              <span className="text-lg font-semibold">
                {formatPrice(cart.subtotal)}
              </span>
            </div>
            <form onSubmit={checkout} className="space-y-3">
              {hasAddresses ? (
                <Field label="Leveradres">
                  <NativeSelect
                    value={selection}
                    onChange={(e) => setSelection(e.target.value)}
                  >
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                        {a.is_default ? " (standaard)" : ""}
                      </option>
                    ))}
                    <option value={CUSTOM}>Ander adres (handmatig)…</option>
                  </NativeSelect>
                </Field>
              ) : null}

              {/* Saved address summary */}
              {!isCustom && selectedAddress ? (
                <div className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedAddress.label}</p>
                    <p className="text-muted-foreground">
                      {addressLine(selectedAddress)}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Manual address fields */}
              {isCustom ? (
                <>
                  {willNeedApproval ? (
                    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Een afwijkend leveradres moet eerst worden goedgekeurd
                        voordat de bestelling wordt verwerkt.
                      </span>
                    </div>
                  ) : null}
                  <Field label="Leveradres — naam">
                    <Input
                      value={ship.name}
                      onChange={(e) =>
                        setShip({ ...ship, name: e.target.value })
                      }
                      placeholder="Ontvanger"
                    />
                  </Field>
                  <Field label="Adres">
                    <Input
                      value={ship.address}
                      onChange={(e) =>
                        setShip({ ...ship, address: e.target.value })
                      }
                      placeholder="Straat en nummer"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Postcode">
                      <Input
                        value={ship.postal}
                        onChange={(e) =>
                          setShip({ ...ship, postal: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Plaats">
                      <Input
                        value={ship.city}
                        onChange={(e) =>
                          setShip({ ...ship, city: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              <Field label="Notitie (optioneel)">
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>

              {requireReason ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="mb-2 text-sm font-medium text-amber-800">
                    Budget/limiet bereikt — dien een aanvraag in
                  </p>
                  <Field label="Reden voor aanvraag">
                    <Textarea
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Bijv. extra jas nodig wegens beschadiging"
                      required
                    />
                  </Field>
                </div>
              ) : null}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {requireReason || willNeedApproval
                  ? "Bestelling aanvragen"
                  : "Bestelling plaatsen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
