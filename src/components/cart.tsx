"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadCart, saveCart } from "@/lib/cart/actions";
import type { Display, PaymentMode } from "@/lib/ordering";
import type { StoredCartItem } from "@/lib/cart/types";

export type CartItem = StoredCartItem;

type Line = { productId: string; variantId: string | null };

type CartCtx = {
  items: CartItem[];
  /** "Later bestellen": kept aside, not ordered. */
  saved: CartItem[];
  count: number;
  subtotal: number;
  creditsSubtotal: number;
  display: Display;
  payment: PaymentMode;
  /** First name when a manager orders for someone. */
  forName: string | null;
  addItem: (item: CartItem) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  /** Put a removed line back where it was (undo). */
  restoreItem: (item: CartItem, index: number) => void;
  /** Swap a line for another variant (e.g. a different size). */
  replaceVariant: (line: Line, next: CartItem) => void;
  saveForLater: (productId: string, variantId: string | null) => void;
  moveToCart: (productId: string, variantId: string | null) => void;
  removeSaved: (productId: string, variantId: string | null) => void;
  clear: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Increments on every add (drives the header bump). */
  addedTick: number;
};

const Ctx = createContext<CartCtx | null>(null);

const same = (a: Line, p: string, v: string | null) =>
  a.productId === p && (a.variantId ?? null) === (v ?? null);

function merge(list: CartItem[], item: CartItem): CartItem[] {
  const idx = list.findIndex((p) => same(p, item.productId, item.variantId));
  if (idx < 0) return [...list, item];
  const next = [...list];
  next[idx] = {
    ...next[idx]!,
    unitPrice: item.unitPrice,
    unitCredits: item.unitCredits,
    qty: next[idx]!.qty + item.qty,
  };
  return next;
}

type Stored = { items: CartItem[]; saved: CartItem[]; updatedAt: string | null };

function readLocal(key: string): Stored {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { items: [], saved: [], updatedAt: null };
    const parsed = JSON.parse(raw);
    // Older carts were stored as a plain array of lines.
    if (Array.isArray(parsed)) return { items: parsed as CartItem[], saved: [], updatedAt: null };
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { items: [], saved: [], updatedAt: null };
  }
}

const OPENED_KEY = "alvasi-winkelwagen-geopend";

export function CartProvider({
  companyId,
  recipientId = null,
  forName = null,
  display = "euro",
  payment = "euro",
  sync = true,
  children,
}: {
  companyId: string;
  /** Ordering on behalf of this employee: a separate cart, never mixed. */
  recipientId?: string | null;
  forName?: string | null;
  display?: Display;
  payment?: PaymentMode;
  /** Keep the cart on the server too (off for previews). */
  sync?: boolean;
  children: React.ReactNode;
}) {
  const storageKey = recipientId
    ? `alvasi-cart-${companyId}-voor-${recipientId}`
    : `alvasi-cart-${companyId}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [saved, setSaved] = useState<CartItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  // The key the current lines were loaded from; saving under any other key
  // would copy one person's cart into another's when switching recipient.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addedTick, setAddedTick] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const dirty = useRef(false);

  // Load: browser copy first (instant), then the server copy wins if newer.
  useEffect(() => {
    let live = true;
    const local = readLocal(storageKey);
    setItems(local.items);
    setSaved(local.saved);
    setUpdatedAt(local.updatedAt);
    setLoadedKey(storageKey);
    dirty.current = false;
    if (!sync) return;
    loadCart()
      .then((server) => {
        if (!live || !server) return;
        const serverNewer =
          server.updatedAt && (!local.updatedAt || server.updatedAt > local.updatedAt);
        if (serverNewer && (server.items.length || server.saved.length || local.items.length === 0)) {
          setItems(server.items);
          setSaved(server.saved);
          setUpdatedAt(server.updatedAt);
        } else if (local.items.length || local.saved.length) {
          // First time on the server (or browser is newer): push the local cart.
          dirty.current = true;
          setUpdatedAt(new Date().toISOString());
        }
      })
      .catch(() => {
        /* offline: de browserkopie blijft werken */
      });
    return () => {
      live = false;
    };
  }, [storageKey, sync]);

  // Persist: browser immediately, server shortly after the last change.
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ items, saved, updatedAt }));
    } catch {
      /* opslag vol of geblokkeerd: de winkelwagen werkt dan alleen in deze sessie */
    }
    if (!sync || !dirty.current) return;
    const t = setTimeout(() => {
      saveCart({ items, saved }).catch(() => {
        /* volgende wijziging probeert het opnieuw */
      });
      dirty.current = false;
    }, 800);
    return () => clearTimeout(t);
  }, [items, saved, updatedAt, loadedKey, storageKey, sync]);

  const touch = useCallback(() => {
    dirty.current = true;
    setUpdatedAt(new Date().toISOString());
  }, []);

  const value = useMemo<CartCtx>(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    return {
      items,
      saved,
      count,
      subtotal: items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
      creditsSubtotal: items.reduce((s, i) => s + i.qty * (i.unitCredits ?? 0), 0),
      display,
      payment,
      forName,
      addItem: (item) => {
        setItems((prev) => merge(prev, item));
        touch();
        setAddedTick((n) => n + 1);
        const total = count + item.qty;
        setAnnouncement(
          `${item.name}${item.variantLabel ? ` ${item.variantLabel}` : ""} toegevoegd. ${total} ${
            total === 1 ? "artikel" : "artikelen"
          } in de winkelwagen.`,
        );
        // The drawer opens by itself only for the first product of a visit.
        try {
          if (!sessionStorage.getItem(OPENED_KEY)) {
            sessionStorage.setItem(OPENED_KEY, "1");
            setDrawerOpen(true);
          }
        } catch {
          /* geen sessieopslag: niet automatisch openen */
        }
      },
      setQty: (productId, variantId, qty) => {
        setItems((prev) =>
          prev.map((p) => (same(p, productId, variantId) ? { ...p, qty: Math.max(1, Math.min(999, qty)) } : p)),
        );
        touch();
      },
      removeItem: (productId, variantId) => {
        setItems((prev) => prev.filter((p) => !same(p, productId, variantId)));
        touch();
      },
      restoreItem: (item, index) => {
        setItems((prev) => {
          if (prev.some((p) => same(p, item.productId, item.variantId))) return merge(prev, item);
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, item);
          return next;
        });
        touch();
      },
      replaceVariant: (line, next) => {
        setItems((prev) => {
          const idx = prev.findIndex((p) => same(p, line.productId, line.variantId));
          if (idx < 0) return prev;
          const rest = prev.filter((_, i) => i !== idx);
          const dup = rest.findIndex((p) => same(p, next.productId, next.variantId));
          if (dup >= 0) return merge(rest, next);
          rest.splice(idx, 0, next);
          return rest;
        });
        touch();
      },
      saveForLater: (productId, variantId) => {
        const line = items.find((p) => same(p, productId, variantId));
        if (!line) return;
        setItems((prev) => prev.filter((p) => !same(p, productId, variantId)));
        setSaved((prev) => merge(prev, line));
        touch();
      },
      moveToCart: (productId, variantId) => {
        const line = saved.find((p) => same(p, productId, variantId));
        if (!line) return;
        setSaved((prev) => prev.filter((p) => !same(p, productId, variantId)));
        setItems((prev) => merge(prev, line));
        touch();
      },
      removeSaved: (productId, variantId) => {
        setSaved((prev) => prev.filter((p) => !same(p, productId, variantId)));
        touch();
      },
      clear: () => {
        setItems([]);
        touch();
      },
      drawerOpen,
      setDrawerOpen,
      addedTick,
    };
  }, [items, saved, display, payment, forName, drawerOpen, addedTick, touch]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart moet binnen CartProvider gebruikt worden");
  return ctx;
}

/** The cart, or null outside a CartProvider (e.g. admin). */
export function useOptionalCart() {
  return useContext(Ctx);
}

/** Cart item count, or null when used outside a CartProvider (e.g. admin). */
export function useCartCount(): number | null {
  const ctx = useContext(Ctx);
  return ctx ? ctx.count : null;
}
