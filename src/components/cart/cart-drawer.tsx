"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Loader2, ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatAmount, PERIOD_LABEL, type Period } from "@/lib/ordering";
import { useOptionalCart } from "@/components/cart";
import type { CartEvaluation } from "@/lib/cart/types";
import { CartLine, SavedList } from "./cart-line";
import { cartAmount } from "./cart-format";
import { useCartCheck } from "./use-cart-check";

const DEFAULT_DELIVERY = { addressId: null, custom: false };

export function CartDrawer() {
  const cart = useOptionalCart();
  const pathname = usePathname();
  if (!cart) return null;
  // The checkout page shows everything itself.
  const open = cart.drawerOpen && pathname !== "/cart";
  return open ? <DrawerBody onClose={() => cart.setDrawerOpen(false)} /> : null;
}

function DrawerBody({ onClose }: { onClose: () => void }) {
  const cart = useOptionalCart()!;
  const { check, loading, lineCheck } = useCartCheck(DEFAULT_DELIVERY);
  const total = cartAmount(
    check?.totals.euro ?? cart.subtotal,
    check?.totals.credits ?? cart.creditsSubtotal,
    cart.display,
    cart.payment,
  );

  return (
    <Sheet open onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent className="flex w-full flex-col p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>
            {cart.forName ? `Winkelwagen van ${cart.forName}` : "Winkelwagen"}
            {cart.count ? <span className="font-normal text-muted-foreground"> ({cart.count})</span> : null}
          </SheetTitle>
          <SheetDescription className="sr-only">Bekijk en wijzig wat je gaat bestellen.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <p className="font-medium">Je winkelwagen is leeg</p>
              <p className="mt-1 text-sm text-muted-foreground">Kies producten in de winkel.</p>
              <Link href="/products" onClick={onClose} className={cn("mt-4", buttonVariants({ variant: "outline" }))}>
                Naar de winkel
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {cart.items.map((i, idx) => (
                <CartLine
                  key={`${i.productId}-${i.variantId ?? ""}`}
                  item={i}
                  index={idx}
                  check={lineCheck(i.productId, i.variantId)}
                />
              ))}
            </ul>
          )}
          <SavedList />
        </div>

        {cart.items.length ? (
          <div className="space-y-3 border-t bg-background px-5 py-4">
            <BudgetSummary check={check} compact />
            {check?.approval.required ? (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Dit wordt een aanvraag: {check.approval.reasons.join(", ").toLowerCase()}.
              </p>
            ) : null}
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Totaal · {cart.count} {cart.count === 1 ? "artikel" : "artikelen"}
              </span>
              <span className="flex items-center gap-2 text-lg font-semibold tabular-nums">
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                {total}
              </span>
            </div>
            <Link href="/cart" onClick={onClose} className={cn("w-full", buttonVariants({ size: "lg" }))}>
              Bestelling afronden
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Verder winkelen
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Budget before and after this order, as a bar; used in the drawer and at checkout. */
export function BudgetSummary({ check, compact = false }: { check: CartEvaluation | null; compact?: boolean }) {
  const b = check?.budget;
  if (!check || !b) return null;
  const hidden = check.display === "hidden";
  const fmt = (v: number) => formatAmount(Math.max(0, v), check.payment);
  const used = b.total > 0 ? Math.min(1, Math.max(0, (b.total - b.remaining) / b.total)) : 0;
  const order = b.total > 0 ? Math.min(1 - used, Math.max(0, (b.remaining - b.after) / b.total)) : 0;
  const over = b.after < 0;
  const period = (PERIOD_LABEL[b.period as Period] ?? "").toLowerCase();

  return (
    <div className="text-sm">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">
          {check.payment === "credits" ? "Credits" : "Budget"}
          {check.forName ? ` van ${check.forName}` : ""} {period}
        </span>
        {!hidden ? (
          <span className={cn("font-medium", over && "text-amber-700")}>
            {over ? "Boven budget" : `daarna nog ${fmt(b.after)}`}
          </span>
        ) : (
          <span className={cn("font-medium", over && "text-amber-700")}>
            {over ? "Boven budget" : "Past binnen budget"}
          </span>
        )}
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-foreground/25" style={{ width: `${used * 100}%` }} />
        <div className={cn("h-full", over ? "bg-amber-500" : "bg-[var(--brand)]")} style={{ width: `${order * 100}%` }} />
      </div>
      {!compact && !hidden ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Budget {fmt(b.total)} · al gebruikt {fmt(b.total - b.remaining)} · deze bestelling{" "}
          {fmt(b.remaining - b.after)}
        </p>
      ) : null}
    </div>
  );
}
