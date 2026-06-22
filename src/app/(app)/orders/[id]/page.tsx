import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatPrice, ORDER_STATUS } from "@/lib/format";
import { approveOrder, rejectOrder } from "../actions";

export const dynamic = "force-dynamic";

type Item = {
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, note, subtotal, total, ship_to_name, ship_to_address, ship_to_postal, ship_to_city, items:order_items(product_name, variant_label, quantity, unit_price, line_total)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const items = (order.items ?? []) as unknown as Item[];
  const status = ORDER_STATUS[order.status] ?? {
    label: order.status,
    tone: "neutral" as const,
  };
  const canApprove = can(user, "orders.approve");

  return (
    <div className="max-w-3xl">
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Bestellingen
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.order_number ?? "Bestelling"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {canApprove && order.status === "pending_approval" ? (
            <>
              <form action={approveOrder.bind(null, order.id)}>
                <SubmitButton size="sm">Goedkeuren</SubmitButton>
              </form>
              <form action={rejectOrder.bind(null, order.id)}>
                <SubmitButton size="sm" variant="destructive">
                  Afwijzen
                </SubmitButton>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Artikelen</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {items.map((i, idx) => (
              <li key={idx} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{i.product_name}</p>
                  {i.variant_label ? (
                    <p className="text-xs text-muted-foreground">
                      {i.variant_label}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm">
                  <p>
                    {i.quantity} × {formatPrice(i.unit_price)}
                  </p>
                  <p className="font-medium">{formatPrice(i.line_total)}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="font-medium">Totaal</span>
            <span className="text-lg font-semibold">
              {formatPrice(order.total)}
            </span>
          </div>
        </CardContent>
      </Card>

      {order.ship_to_name || order.ship_to_address ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Leveradres</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {order.ship_to_name ? <p>{order.ship_to_name}</p> : null}
            {order.ship_to_address ? <p>{order.ship_to_address}</p> : null}
            <p>
              {[order.ship_to_postal, order.ship_to_city]
                .filter(Boolean)
                .join(" ")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {order.note ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notitie</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {order.note}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
