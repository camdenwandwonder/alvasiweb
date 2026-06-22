"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  unitPrice: number;
  image: string | null;
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);

const sameLine = (a: CartItem, p: string, v: string | null) =>
  a.productId === p && (a.variantId ?? null) === (v ?? null);

export function CartProvider({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const storageKey = `alvasi-cart-${companyId}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready, storageKey]);

  const value = useMemo<CartCtx>(() => {
    return {
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
      addItem: (item) =>
        setItems((prev) => {
          const idx = prev.findIndex((p) =>
            sameLine(p, item.productId, item.variantId),
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], qty: next[idx].qty + item.qty };
            return next;
          }
          return [...prev, item];
        }),
      setQty: (productId, variantId, qty) =>
        setItems((prev) =>
          prev
            .map((p) =>
              sameLine(p, productId, variantId)
                ? { ...p, qty: Math.max(1, qty) }
                : p,
            )
            .filter((p) => p.qty > 0),
        ),
      removeItem: (productId, variantId) =>
        setItems((prev) =>
          prev.filter((p) => !sameLine(p, productId, variantId)),
        ),
      clear: () => setItems([]),
    };
  }, [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart moet binnen CartProvider gebruikt worden");
  return ctx;
}

/** Cart item count, or null when used outside a CartProvider (e.g. admin). */
export function useCartCount(): number | null {
  const ctx = useContext(Ctx);
  return ctx ? ctx.count : null;
}
