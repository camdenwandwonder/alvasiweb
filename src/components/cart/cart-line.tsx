"use client";

import { toast } from "sonner";
import { AlertTriangle, Clock, Minus, Package, Plus, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, type CartItem } from "@/components/cart";
import { ProductImg } from "@/components/shop/product-img";
import type { LineCheck } from "@/lib/cart/types";
import { cartAmount, readableVariant } from "./cart-format";

export function CartLine({
  item,
  index,
  check,
  full = false,
}: {
  item: CartItem;
  index: number;
  /** Server check for this line (messages, current price, sizes). */
  check?: LineCheck;
  /** Checkout page: size choice and "Later bestellen". */
  full?: boolean;
}) {
  const cart = useCart();
  const unitEuro = check?.unitPrice ?? item.unitPrice;
  const unitCredits = check?.unitCredits ?? item.unitCredits ?? 0;
  const amount = cartAmount(unitEuro * item.qty, unitCredits * item.qty, cart.display, cart.payment);
  const unavailable = check && !check.available;
  const name = `${item.name}${item.variantLabel ? ` ${readableVariant(item.variantLabel)}` : ""}`;

  function remove() {
    cart.removeItem(item.productId, item.variantId);
    toast(`${item.name} verwijderd`, {
      action: { label: "Ongedaan maken", onClick: () => cart.restoreItem(item, index) },
    });
  }

  return (
    <li className={cn("flex gap-3 py-3", unavailable && "opacity-70")}>
      <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f4f4f2]">
        {item.image ? (
          <ProductImg src={item.image} alt="" sizes="64px" className="p-1" />
        ) : (
          <Package className="m-auto mt-7 h-5 w-5 text-muted-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            {full && check && check.options.length > 1 ? (
              <select
                value={item.variantId ?? ""}
                aria-label={`Uitvoering ${item.name}`}
                onChange={(e) => {
                  const opt = check.options.find((o) => o.id === e.target.value);
                  if (!opt) return;
                  cart.replaceVariant(item, {
                    ...item,
                    variantId: opt.id,
                    variantLabel: opt.label,
                    unitPrice: opt.euro,
                    unitCredits: opt.credits,
                  });
                }}
                className="mt-1 h-8 rounded-md border bg-transparent px-2 text-sm"
              >
                {check.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                    {o.mine ? " (jouw maat)" : ""}
                  </option>
                ))}
              </select>
            ) : item.variantLabel ? (
              <p className="text-xs text-muted-foreground">{readableVariant(item.variantLabel)}</p>
            ) : null}
          </div>
          {amount ? <p className="shrink-0 text-sm font-medium tabular-nums">{amount}</p> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center rounded-lg border">
            <button
              type="button"
              aria-label={`Eén minder ${name}`}
              disabled={item.qty <= 1}
              onClick={() => cart.setQty(item.productId, item.variantId, item.qty - 1)}
              className="flex h-8 w-8 items-center justify-center hover:bg-muted disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-sm tabular-nums" aria-label={`Aantal ${name}`}>
              {item.qty}
            </span>
            <button
              type="button"
              aria-label={`Eén meer ${name}`}
              disabled={!!check?.maxPerOrder && item.qty >= check.maxPerOrder}
              onClick={() => cart.setQty(item.productId, item.variantId, item.qty + 1)}
              className="flex h-8 w-8 items-center justify-center hover:bg-muted disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={remove}
            aria-label={`Verwijder ${name}`}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Verwijderen
          </button>
          {full ? (
            <button
              type="button"
              onClick={() => {
                cart.saveForLater(item.productId, item.variantId);
                toast(`${item.name} bewaard voor later`);
              }}
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Later bestellen
            </button>
          ) : null}
        </div>

        {check?.message ? (
          <p
            className={cn(
              "mt-2 flex items-start gap-1.5 text-xs",
              check.tone === "error" ? "text-red-700" : "text-amber-800",
            )}
          >
            {check.tone === "error" ? (
              <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            )}
            {check.message}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** "Bewaard voor later" list with a way back into the cart. */
export function SavedList() {
  const cart = useCart();
  if (!cart.saved.length) return null;
  return (
    <section className="mt-4 border-t pt-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Clock className="h-4 w-4 text-muted-foreground" /> Bewaard voor later ({cart.saved.length})
      </h3>
      <ul className="space-y-2">
        {cart.saved.map((i) => (
          <li key={`${i.productId}-${i.variantId ?? ""}`} className="flex items-center gap-3 text-sm">
            <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded-md bg-[#f4f4f2]">
              {i.image ? <ProductImg src={i.image} alt="" sizes="40px" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{i.name}</span>
              <span className="block text-xs text-muted-foreground">
                {i.qty}× {readableVariant(i.variantLabel)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => cart.moveToCart(i.productId, i.variantId)}
              className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              Terug in winkelwagen
            </button>
            <button
              type="button"
              aria-label={`Verwijder ${i.name} uit later bestellen`}
              onClick={() => cart.removeSaved(i.productId, i.variantId)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Weg
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
