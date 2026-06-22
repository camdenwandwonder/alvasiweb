"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  LayoutGrid,
  List,
  ExternalLink,
  GripVertical,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/primitives";
import { formatPrice, ORDER_STATUS } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  moveOrderStatus,
  toggleOrderItemChecked,
  deleteOrder,
} from "./actions";

export type BoardItem = {
  id: string;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  checked: boolean;
};

export type BoardOrder = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  created_at: string;
  company: string | null;
  items: BoardItem[];
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "pending_approval", label: "Wacht op goedkeuring" },
  { key: "approved", label: "Goedgekeurd" },
  { key: "in_production", label: "In productie" },
  { key: "shipped", label: "Verzonden" },
  { key: "delivered", label: "Geleverd" },
];

const STATUS_OPTIONS = [
  "pending_approval",
  "approved",
  "in_production",
  "shipped",
  "delivered",
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProductionBoard({ orders: initial }: { orders: BoardOrder[] }) {
  const [orders, setOrders] = useState<BoardOrder[]>(initial);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function move(orderId: string, status: string) {
    const target = orders.find((o) => o.id === orderId);
    if (!target || target.status === status) return;
    const prev = orders;
    setOrders((os) =>
      os.map((o) => (o.id === orderId ? { ...o, status } : o)),
    );
    const res = await moveOrderStatus(orderId, status);
    if (!res.ok) {
      setOrders(prev);
      toast.error(res.error);
    } else {
      toast.success(`Verplaatst naar “${ORDER_STATUS[status]?.label ?? status}”`);
    }
  }

  async function remove(orderId: string, label: string) {
    if (
      !window.confirm(
        `Bestelling ${label} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`,
      )
    )
      return;
    const prev = orders;
    setOrders((os) => os.filter((o) => o.id !== orderId));
    const res = await deleteOrder(orderId);
    if (!res.ok) {
      setOrders(prev);
      toast.error(res.error);
    } else {
      toast.success("Bestelling verwijderd");
    }
  }

  function toggleItem(orderId: string, itemId: string, checked: boolean) {
    const prev = orders;
    setOrders((os) =>
      os.map((o) =>
        o.id === orderId
          ? {
              ...o,
              items: o.items.map((it) =>
                it.id === itemId ? { ...it, checked } : it,
              ),
            }
          : o,
      ),
    );
    toggleOrderItemChecked(itemId, checked).catch(() => {
      setOrders(prev);
      toast.error("Kon item niet bijwerken");
    });
  }

  const byStatus = (s: string) => orders.filter((o) => o.status === s);

  return (
    <div>
      {/* View toggle */}
      <div className="mb-4 inline-flex rounded-lg border bg-card p-0.5">
        <button
          onClick={() => setView("kanban")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
            view === "kanban"
              ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-4 w-4" /> Kanban
        </button>
        <button
          onClick={() => setView("list")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
            view === "list"
              ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="h-4 w-4" /> Lijst
        </button>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const list = byStatus(col.key);
            return (
              <div
                key={col.key}
                className={cn(
                  "w-80 shrink-0 rounded-xl p-1 transition",
                  overCol === col.key && "bg-[var(--brand)]/5 ring-2 ring-[var(--brand)]/30",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overCol !== col.key) setOverCol(col.key);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragId ?? e.dataTransfer.getData("text/plain");
                  setOverCol(null);
                  setDragId(null);
                  if (id) move(id, col.key);
                }}
              >
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {list.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {list.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      dragging={dragId === o.id}
                      onDragStart={(e) => {
                        setDragId(o.id);
                        e.dataTransfer.setData("text/plain", o.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      onToggleItem={toggleItem}
                      onDelete={remove}
                    />
                  ))}
                  {list.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Sleep hier een bestelling naartoe
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ListView
          orders={orders}
          onMove={move}
          onToggleItem={toggleItem}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function OrderCard({
  order,
  dragging,
  onDragStart,
  onDragEnd,
  onToggleItem,
  onDelete,
}: {
  order: BoardOrder;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onToggleItem: (orderId: string, itemId: string, checked: boolean) => void;
  onDelete: (orderId: string, label: string) => void;
}) {
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-xl border bg-card p-3 shadow-xs transition",
        dragging ? "opacity-40" : "hover:border-foreground/20 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold leading-tight">
              {order.order_number ?? "Bestelling"}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.company ?? "—"}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
          {fmtDate(order.created_at)}
        </span>
      </div>

      {order.items.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t pt-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={it.checked}
                onChange={(e) =>
                  onToggleItem(order.id, it.id, e.target.checked)
                }
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[var(--brand)]"
              />
              <span
                className={cn(
                  "text-xs leading-snug",
                  it.checked && "text-muted-foreground line-through",
                )}
              >
                <span className="font-medium">{it.quantity}×</span>{" "}
                {it.product_name}
                {it.variant_label ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({it.variant_label})
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Geen artikelen
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {formatPrice(order.total)}
          {totalQty > 0 ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              · {totalQty} st.
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Verwijderen"
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(order.id, order.order_number ?? "deze bestelling");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Link
            href={`/admin/orders/${order.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Bekijk
          </Link>
        </div>
      </div>
    </div>
  );
}

function ListView({
  orders,
  onMove,
  onToggleItem,
  onDelete,
}: {
  orders: BoardOrder[];
  onMove: (orderId: string, status: string) => void;
  onToggleItem: (orderId: string, itemId: string, checked: boolean) => void;
  onDelete: (orderId: string, label: string) => void;
}) {
  if (orders.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nog geen bestellingen.
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Bestelling</th>
            <th className="px-4 py-2.5 font-medium">Bedrijf</th>
            <th className="px-4 py-2.5 font-medium">Artikelen</th>
            <th className="px-4 py-2.5 font-medium">Besteld op</th>
            <th className="px-4 py-2.5 font-medium">Totaal</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((o) => (
            <tr key={o.id} className="align-top">
              <td className="px-4 py-3 font-medium whitespace-nowrap">
                {o.order_number ?? "Bestelling"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {o.company ?? "—"}
              </td>
              <td className="px-4 py-3">
                {o.items.length > 0 ? (
                  <ul className="space-y-1">
                    {o.items.map((it) => (
                      <li key={it.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={it.checked}
                          onChange={(e) =>
                            onToggleItem(o.id, it.id, e.target.checked)
                          }
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input accent-[var(--brand)]"
                        />
                        <span
                          className={cn(
                            "text-xs leading-snug",
                            it.checked &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {it.quantity}× {it.product_name}
                          {it.variant_label ? ` (${it.variant_label})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(o.created_at)}
              </td>
              <td className="px-4 py-3 font-medium whitespace-nowrap">
                {formatPrice(o.total)}
              </td>
              <td className="px-4 py-3">
                <NativeSelect
                  value={o.status}
                  onChange={(e) => onMove(o.id, e.target.value)}
                  className="h-9 w-44"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS[s]?.label ?? s}
                    </option>
                  ))}
                </NativeSelect>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Bekijk
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Verwijderen"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      onDelete(o.id, o.order_number ?? "deze bestelling")
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
