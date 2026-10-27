"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileImage,
  Loader2,
  MapPin,
  Printer,
  RotateCcw,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/primitives";
import { useCart } from "@/components/cart";
import { cn } from "@/lib/utils";
import { ORDER_STATUS } from "@/lib/format";
import { formatValue } from "@/lib/ordering";
import {
  decideOrders,
  getOrderDetail,
  reorderItems,
  type OrderDetail,
} from "@/lib/orders/actions";
import { cancelOwnOrder } from "@/app/(app)/orders/actions";
import { formatWhen } from "./orders-table";

export function OrderDrawer({
  orderId,
  version,
  detailHref,
  onClose,
  onPrev,
  onNext,
}: {
  orderId: string;
  /** Changes when the list reloads, so the panel refetches too. */
  version: unknown;
  detailHref: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    getOrderDetail(orderId).then((res) => {
      if (!live) return;
      if (res.ok) setOrder(res.order);
      else setError(res.error);
    });
    return () => {
      live = false;
    };
  }, [orderId, version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if ((e.key === "ArrowDown" || e.key === "j") && onNext) {
        e.preventDefault();
        onNext();
      } else if ((e.key === "ArrowUp" || e.key === "k") && onPrev) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev]);

  const current = order?.id === orderId ? order : null;
  const st = current ? (ORDER_STATUS[current.status] ?? { label: current.status, tone: "neutral" as const }) : null;

  return (
    <Sheet open onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent className="flex w-full flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-start gap-3 pr-8">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg">
                {current?.order_number ?? (error ? "Bestelling" : "Laden…")}
              </SheetTitle>
              <SheetDescription>
                {current
                  ? `${formatWhen(current.created_at).date}, ${formatWhen(current.created_at).time}${
                      current.company_name ? ` · ${current.company_name}` : ""
                    }`
                  : " "}
              </SheetDescription>
            </div>
            {st ? <StatusBadge tone={st.tone}>{st.label}</StatusBadge> : null}
          </div>
          {onPrev || onNext ? (
            <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
              <Button variant="ghost" size="icon-sm" aria-label="Vorige bestelling" disabled={!onPrev} onClick={onPrev}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Volgende bestelling" disabled={!onNext} onClick={onNext}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <span>Pijltjestoetsen om door de lijst te gaan</span>
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : !current ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Body order={current} />
          )}
        </div>

        {current ? <Footer order={current} detailHref={detailHref} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function Body({ order }: { order: OrderDetail }) {
  const money = order.display !== "hidden";
  const count = order.items.reduce((s, i) => s + i.quantity, 0);
  const addr = order.ship_to;
  const addressLines = [
    addr.name,
    addr.address,
    [addr.postal, addr.city].filter(Boolean).join(" "),
    addr.country && addr.country !== "NL" && addr.country !== "Nederland" ? addr.country : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6 pt-4">
      <section className="flex items-center gap-3 rounded-xl border p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-semibold text-[var(--brand-foreground)]">
          {(order.ordered_by_name ?? "?")
            .split(/[\s@.]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]!.toUpperCase())
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{order.ordered_by_name ?? "Onbekend"}</p>
          <p className="truncate text-sm text-muted-foreground">
            {[order.role_name, order.ordered_by_email].filter(Boolean).join(" · ")}
          </p>
          {order.placed_by_name ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Geplaatst door {order.placed_by_name}
            </p>
          ) : null}
        </div>
      </section>

      {order.reference || order.cost_center ? (
        <dl className="grid grid-cols-2 gap-3 rounded-xl border p-3 text-sm">
          {order.reference ? (
            <div>
              <dt className="text-xs text-muted-foreground">Referentie</dt>
              <dd className="font-medium">{order.reference}</dd>
            </div>
          ) : null}
          {order.cost_center ? (
            <div>
              <dt className="text-xs text-muted-foreground">Kostenplaats</dt>
              <dd className="font-medium">{order.cost_center}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {order.is_request ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">Aanvraag:</span>{" "}
          {order.request_reason || "buiten budget, maximum of met een afwijkend adres"}
        </p>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Artikelen <span className="font-normal text-muted-foreground">({count})</span>
        </h3>
        <ul className="divide-y rounded-xl border text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-start gap-3 px-3 py-2.5">
              <span className="w-8 shrink-0 font-medium tabular-nums">{i.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{i.product_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[i.variant_label, i.sku].filter(Boolean).join(" · ") || "Standaard"}
                </span>
              </span>
              {money ? (
                <span className="text-right whitespace-nowrap tabular-nums">
                  {formatValue(i.line_total, i.credit_cost * i.quantity, order.display)}
                  {i.quantity > 1 ? (
                    <span className="block text-xs text-muted-foreground">
                      {formatValue(i.unit_price, i.credit_cost, order.display)} p.st.
                    </span>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
          {money ? (
            <li className="flex justify-between px-3 py-2.5 font-semibold">
              <span>Totaal</span>
              <span className="tabular-nums">{formatValue(order.total, order.credit_total, order.display)}</span>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" /> Leveradres
          </h3>
          {addressLines.length ? (
            <div className="text-sm">
              {addressLines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              {addr.custom ? <p className="mt-1 text-xs text-amber-700">Afwijkend adres</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen adres opgegeven</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Goedkeuring</h3>
          <p className="text-sm">
            {order.approved_by_name
              ? `${order.status === "rejected" ? "Afgewezen" : "Goedgekeurd"} door ${order.approved_by_name}`
              : order.status === "pending_approval"
                ? "Wacht op een goedkeurder"
                : "Direct doorgezet"}
          </p>
          {order.decided_at ? (
            <p className="text-xs text-muted-foreground">{formatWhen(order.decided_at).date}</p>
          ) : null}
        </div>
      </section>

      {order.note ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Notitie</h3>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">{order.note}</p>
        </section>
      ) : null}

      {order.proofs.length ? (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <FileImage className="h-4 w-4 text-muted-foreground" /> Proeven
          </h3>
          <ul className="space-y-1.5 text-sm">
            {order.proofs.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <a href={p.file_url} target="_blank" rel="noreferrer" className="hover:underline">
                  Versie {p.version}
                </a>
                <StatusBadge tone={p.status === "approved" ? "green" : p.status === "pending" ? "amber" : "red"}>
                  {p.status === "approved" ? "Goedgekeurd" : p.status === "pending" ? "In afwachting" : "Wijziging gevraagd"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.events.length ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Tijdlijn</h3>
          <ol className="relative space-y-3 border-l pl-4">
            {order.events.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
                <p>{e.note ?? (e.status ? (ORDER_STATUS[e.status]?.label ?? e.status) : "Bijgewerkt")}</p>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(e.created_at).date}, {formatWhen(e.created_at).time}
                  {e.actor_name ? ` · ${e.actor_name}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function Footer({
  order,
  detailHref,
  onClose,
}: {
  order: OrderDetail;
  detailHref: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function decide(decision: "approve" | "reject") {
    start(async () => {
      const res = await decideOrders([order.id], decision);
      if (!res.ok || res.failed) toast.error(res.ok ? "Dat is niet gelukt" : res.error);
      else toast.success(decision === "approve" ? "Goedgekeurd, naar productie" : "Afgewezen");
      router.refresh();
    });
  }
  function cancel() {
    start(async () => {
      const res = await cancelOwnOrder(order.id);
      if (res.ok) {
        toast.success("Bestelling geannuleerd");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t bg-background px-4 py-3">
      {order.can.approve ? (
        <>
          <Button onClick={() => decide("approve")} disabled={pending}>
            <Check className="h-4 w-4" /> Goedkeuren
          </Button>
          <Button variant="outline" onClick={() => decide("reject")} disabled={pending}>
            <X className="h-4 w-4" /> Afwijzen
          </Button>
        </>
      ) : null}
      {order.can.cancel ? (
        <Button variant="outline" onClick={cancel} disabled={pending}>
          Annuleren
        </Button>
      ) : null}
      {order.can.reorder ? (
        <ReorderButton
          orderId={order.id}
          onDone={onClose}
          label={order.status === "rejected" ? "Opnieuw in winkelwagen" : "Opnieuw bestellen"}
        />
      ) : null}
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      <div className="ml-auto flex gap-1">
        <a
          href={`/print/pakbon?ids=${order.id}`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <Printer className="h-4 w-4" /> Pakbon
        </a>
        <Link href={detailHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ExternalLink className="h-4 w-4" /> Openen
        </Link>
      </div>
    </div>
  );
}

export function ReorderButton({
  orderId,
  onDone,
  label = "Opnieuw bestellen",
}: {
  orderId: string;
  onDone?: () => void;
  label?: string;
}) {
  const cart = useCart();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      className={cn(pending && "opacity-70")}
      onClick={() =>
        start(async () => {
          const res = await reorderItems(orderId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          res.items.forEach((i) => cart.addItem(i));
          if (res.skipped.length)
            toast.warning(`Niet meer beschikbaar: ${res.skipped.join(", ")}`);
          if (res.items.length) {
            toast.success("Toegevoegd aan je winkelwagen");
            onDone?.();
            router.push("/cart");
          }
        })
      }
    >
      <RotateCcw className="h-4 w-4" /> {label}
    </Button>
  );
}
