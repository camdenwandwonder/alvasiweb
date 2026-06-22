"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Minus, Plus, Trash2, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/primitives";
import { useCart } from "@/components/cart";
import { formatPrice } from "@/lib/format";
import { createOrderFromCart } from "./actions";

export default function CartPage() {
  const cart = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [ship, setShip] = useState({
    name: "",
    address: "",
    postal: "",
    city: "",
    country: "",
    note: "",
  });

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { orderId } = await createOrderFromCart(
        cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          qty: i.qty,
        })),
        ship,
      );
      cart.clear();
      toast.success("Bestelling geplaatst");
      router.push(`/orders/${orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Er ging iets mis");
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
              <Field label="Leveradres — naam">
                <Input
                  value={ship.name}
                  onChange={(e) => setShip({ ...ship, name: e.target.value })}
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
                    onChange={(e) => setShip({ ...ship, city: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Notitie (optioneel)">
                <Textarea
                  rows={2}
                  value={ship.note}
                  onChange={(e) => setShip({ ...ship, note: e.target.value })}
                />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Bestelling plaatsen
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
