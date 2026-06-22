import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { ImageUploader } from "@/components/image-uploader";
import { formatDate, formatPrice, ORDER_STATUS } from "@/lib/format";
import { advanceOrderStatus, addProof } from "../actions";

export const dynamic = "force-dynamic";

const PROOF_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "green" | "amber" | "red" }
> = {
  pending: { label: "In afwachting", tone: "amber" },
  approved: { label: "Goedgekeurd", tone: "green" },
  changes_requested: { label: "Wijziging gevraagd", tone: "red" },
};

function nextActions(status: string): { label: string; to: string }[] {
  switch (status) {
    case "pending_approval":
      return [
        { label: "Goedkeuren", to: "approved" },
        { label: "Afwijzen", to: "rejected" },
      ];
    case "approved":
      return [{ label: "Naar productie", to: "in_production" }];
    case "in_production":
      return [{ label: "Markeer als verzonden", to: "shipped" }];
    case "shipped":
      return [{ label: "Markeer als geleverd", to: "delivered" }];
    default:
      return [];
  }
}

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_number, status, created_at, total, company_id, ship_to_name, ship_to_address, ship_to_postal, ship_to_city, company:companies(name), items:order_items(product_name, variant_label, quantity, unit_price, line_total)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: proofs }, { data: events }] = await Promise.all([
    admin
      .from("proofs")
      .select("id, version, file_url, status, created_at")
      .eq("order_id", id)
      .order("version", { ascending: false }),
    admin
      .from("order_events")
      .select("id, status, note, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const status = ORDER_STATUS[order.status] ?? {
    label: order.status,
    tone: "neutral" as const,
  };
  const actions = nextActions(order.status);
  const items = (order.items ?? []) as unknown as {
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Productie
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {order.order_number ?? "Bestelling"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {(order.company as unknown as { name: string } | null)?.name} ·{" "}
            {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {actions.map((a) => (
            <form key={a.to} action={advanceOrderStatus.bind(null, id, a.to)}>
              <SubmitButton
                size="sm"
                variant={a.to === "rejected" ? "destructive" : "default"}
              >
                {a.label}
              </SubmitButton>
            </form>
          ))}
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
          {order.ship_to_name || order.ship_to_address ? (
            <div className="mt-4 border-t pt-3 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Leveradres</p>
              {order.ship_to_name ? <p>{order.ship_to_name}</p> : null}
              {order.ship_to_address ? <p>{order.ship_to_address}</p> : null}
              <p>
                {[order.ship_to_postal, order.ship_to_city]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Proofs */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Proeven</CardTitle>
        </CardHeader>
        <CardContent>
          {proofs && proofs.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {proofs.map((p) => {
                const ps = PROOF_STATUS[p.status] ?? {
                  label: p.status,
                  tone: "neutral" as const,
                };
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border p-3"
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
                    <StatusBadge tone={ps.tone}>{ps.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              Nog geen proeven geüpload.
            </p>
          )}
          <form
            action={addProof.bind(null, id, order.company_id)}
            className="space-y-3"
          >
            <ImageUploader name="file_url" bucket="proofs" />
            <SubmitButton variant="outline" size="sm">
              Proef toevoegen
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tijdlijn</CardTitle>
        </CardHeader>
        <CardContent>
          {!events || events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen gebeurtenissen.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
