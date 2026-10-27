"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalCart } from "@/components/cart";
import { cartAmount } from "./cart-format";

/** Header button: count and amount; opens the cart drawer. */
export function CartButton() {
  const cart = useOptionalCart();
  const [bump, setBump] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (!cart) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setBump(true);
    const t = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(t);
  }, [cart?.addedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart) return null;
  const amount = cart.count ? cartAmount(cart.subtotal, cart.creditsSubtotal, cart.display, cart.payment) : "";
  const label = cart.forName ? `Winkelwagen van ${cart.forName}` : "Winkelwagen";

  return (
    <button
      type="button"
      onClick={() => cart.setDrawerOpen(true)}
      aria-label={`${label}: ${cart.count} ${cart.count === 1 ? "artikel" : "artikelen"}${amount ? `, ${amount}` : ""}`}
      aria-haspopup="dialog"
      className={cn(
        "ml-auto inline-flex h-10 items-center gap-2 rounded-full border bg-card px-3 text-sm font-medium transition hover:bg-muted",
        cart.count && "border-[var(--brand)]/40",
      )}
    >
      <span className="relative">
        <ShoppingCart className="h-5 w-5" />
        {cart.count ? (
          <span
            className={cn(
              "absolute -top-2 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-semibold text-[var(--brand-foreground)] transition-transform duration-200 motion-reduce:transition-none",
              bump && "scale-125",
            )}
          >
            {cart.count > 99 ? "99+" : cart.count}
          </span>
        ) : null}
      </span>
      <span className="ml-1 hidden sm:inline">
        {cart.forName ? <span className="font-normal text-muted-foreground">{cart.forName} · </span> : null}
        {amount || (cart.count ? `${cart.count} ${cart.count === 1 ? "artikel" : "artikelen"}` : "Winkelwagen")}
      </span>
    </button>
  );
}
