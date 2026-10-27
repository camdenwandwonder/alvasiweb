import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, ORDER_STATUS } from "@/lib/format";
import { displayFor, formatValue, readOrderingSettings } from "@/lib/ordering";
import { approveOrder, rejectOrder, decideProof } from "../actions";
import { CancelOrderButton } from "./cancel-order-button";
import { ReorderButton } from "@/components/orders/order-drawer";

export const dynamic = "force-dynamic";

type Item = {
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  credit_cost: number | null;
};

const PROOF_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "green" | "amber" | "red" }
> = {
  pending: { label: "In afwachting", tone: "amber" },
  approved: { label: "Goedgekeurd", tone: "green" },
  changes_requested: { label: "Wijziging gevraagd", tone: "red" },
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
      "id, order_number, status, created_at, note, subtotal, total, credit_total, ordered_by, placed_by, ordered_by_name, company_id, ship_to_name, ship_to_address, ship_to_postal, ship_to_city, items:order_items(product_name, variant_label, quantity, unit_price, line_total, credit_cost)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: proofs }, { data: events }, { data: company }] = await Promise.all([
    supabase
      .from("proofs")
      .select("id, version, file_url, status, created_at")
      .eq("order_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("order_events")
      .select("id, status, note, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("settings").eq("id", order.company_id).maybeSingle(),
  ]);
  const display = displayFor(
    readOrderingSettings(company?.settings as Record<string, unknown> | null),
    isMember(user) ? "member" : "manager",
  );
  const canCancel =
    order.ordered_by === user?.id &&
    can(user, "orders.cancel") &&
    order.status === "pending_approval";
  const canRefill =
    order.ordered_by === user?.id &&
    !!user?.companyId &&
    order.company_id === user.companyId &&
    can(user, "orders.create") &&
    order.status === "rejected";

  const items = (order.items ?? []) as unknown as Item[];
  const status = ORDER_STATUS[order.status] ?? {
    label: order.status,
    tone: "neutral" as const,
  };
  const canApprove = can(user, "orders.approve");

  // Placed on the employee's behalf: show by whom (names via the admin client,
  // the order itself is already authorised by RLS above).
  let placedByName: string | null = null;
  if (order.placed_by && order.placed_by !== order.ordered_by) {
    const { data: p } = await createAdminClient()
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.placed_by)
      .maybeSingle();
    placedByName = (p?.full_name as string | null)?.trim() || (p?.email as string | null) || null;
  }

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
            {placedByName
              ? ` · voor ${order.ordered_by_name ?? "medewerker"}, geplaatst door ${placedByName}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {canCancel ? <CancelOrderButton orderId={order.id} /> : null}
          {canRefill ? <ReorderButton orderId={order.id} label="Opnieuw in winkelwagen" /> : null}
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
                {display === "hidden" ? (
                  <span className="text-sm">{i.quantity} ×</span>
                ) : (
                  <div className="text-right text-sm">
                    <p>
                      {i.quantity} ×{" "}
                      {formatValue(i.unit_price, Number(i.credit_cost ?? 0), display)}
                    </p>
                    <p className="font-medium">
                      {formatValue(
                        i.line_total,
                        Number(i.credit_cost ?? 0) * i.quantity,
                        display,
                      )}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {display !== "hidden" ? (
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="font-medium">Totaal</span>
              <span className="text-lg font-semibold">
                {formatValue(Number(order.total), Number(order.credit_total ?? 0), display)}
              </span>
            </div>
          ) : null}
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Notitie</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {order.note}
          </CardContent>
        </Card>
      ) : null}

      {/* Proeven */}
      {proofs && proofs.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Proeven ter goedkeuring</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {proofs.map((p) => {
                const ps = PROOF_STATUS[p.status] ?? {
                  label: p.status,
                  tone: "neutral" as const,
                };
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.file_url}
                        alt=""
                        className="h-12 w-12 rounded object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium">Versie {p.version}</p>
                        <a
                          href={p.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--brand-2)] hover:underline"
                        >
                          Bekijken
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={ps.tone}>{ps.label}</StatusBadge>
                      {p.status === "pending" ? (
                        <>
                          <form action={decideProof.bind(null, p.id, "approved")}>
                            <SubmitButton size="sm">Goedkeuren</SubmitButton>
                          </form>
                          <form
                            action={decideProof.bind(
                              null,
                              p.id,
                              "changes_requested",
                            )}
                          >
                            <SubmitButton size="sm" variant="outline">
                              Wijziging vragen
                            </SubmitButton>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Tijdlijn */}
      {events && events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tijdlijn</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />
                  <div>
                    <p>
                      {e.status
                        ? (ORDER_STATUS[e.status]?.label ?? e.status)
                        : e.note}
                    </p>
                    <time className="text-xs text-muted-foreground">
                      {formatDate(e.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
