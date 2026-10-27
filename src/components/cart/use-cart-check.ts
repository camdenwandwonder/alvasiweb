"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart";
import { previewCart } from "@/lib/cart/actions";
import type { CartEvaluation, DeliveryChoice } from "@/lib/cart/types";

/** The server's verdict on the current cart, refreshed shortly after each change. */
export function useCartCheck(delivery: DeliveryChoice, enabled = true) {
  const cart = useCart();
  const [check, setCheck] = useState<CartEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([
    cart.items.map((i) => [i.productId, i.variantId, i.qty, i.unitPrice, i.unitCredits]),
    delivery,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (!cart.items.length) {
      setCheck(null);
      setError(null);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      previewCart(
        cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          qty: i.qty,
          unitPrice: i.unitPrice,
          unitCredits: i.unitCredits,
        })),
        delivery,
      )
        .then((res) => {
          if (!live) return;
          if (res.ok) {
            setCheck(res);
            setError(null);
          } else setError(res.error);
        })
        .catch(() => live && setError("Controleren lukt nu niet. Probeer het zo opnieuw."))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const lineCheck = (productId: string, variantId: string | null) =>
    check?.lines.find((l) => l.productId === productId && (l.variantId ?? null) === (variantId ?? null));

  return { check, error, loading, lineCheck };
}
