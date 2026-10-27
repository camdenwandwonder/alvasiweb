import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Hourglass, MapPin, Package, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUser, isMember } from "@/lib/auth/user";
import { getAllowanceFor } from "@/lib/allowance";
import { approverNames } from "@/lib/cart/evaluate";
import { ORDER_STATUS } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  displayFor,
  formatAmount,
  formatValue,
  readOrderingSettings,
} from "@/lib/ordering";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Item = {
  product_name: string;
  variant_label: string | null;
  quantity: number;
  line_total: number | null;
  credit_cost: number | null;
};

/** "Maat: L, Kleur: Navy" → "L · Navy". */
function shortVariant(label: string | null): string {
  if (!label) return "";
  return label
    .split(",")
    .map((p) => p.split(":").pop()!.trim())
    .filter(Boolean)
    .join(" · ");
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}

/** Which of the four steps is current (0–3). */
function stepOf(status: string): number {
  if (status === "pending_approval") return 0;
  if (status === "approved" || status === "in_production") return 1;
  if (status === "shipped") return 2;
  if (status === "delivered" || status === "fulfilled") return 3;
  return 0;
}

export default async function OrderPlacedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Read with the user's own rights: only who may see the order gets here.
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, total, credit_total, ordered_by, placed_by, ordered_by_name, company_id, is_request, request_reason, reference, cost_center, ship_to_name, ship_to_address, ship_to_postal, ship_to_city, ship_to_country, ship_to_custom, items:order_items(product_name, variant_label, quantity, line_total, credit_cost)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const admin = createAdminClient();
  const placedBySomeoneElse = !!order.placed_by && order.placed_by !== order.ordered_by;
  const [{ data: company }, { data: placer }, allowance, approvers] = await Promise.all([
    admin.from("companies").select("settings").eq("id", order.company_id).maybeSingle(),
    placedBySomeoneElse
      ? admin.from("profiles").select("full_name, email").eq("id", order.placed_by!).maybeSingle()
      : Promise.resolve({ data: null }),
    getAllowanceFor(order.company_id as string, order.ordered_by as string),
    order.status === "pending_approval"
      ? approverNames(order.company_id as string, order.ordered_by as string)
      : Promise.resolve([] as string[]),
  ]);

  const settings = readOrderingSettings((company?.settings as Record<string, unknown>) ?? {});
  const display = displayFor(settings, isMember(user) ? "member" : "manager");
  const items = ((order.items ?? []) as Item[]).map((i) => ({
    ...i,
    line_total: Number(i.line_total ?? 0),
    credit_cost: Number(i.credit_cost ?? 0),
  }));
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const pending = order.status === "pending_approval";
  const closed = order.status === "rejected" || order.status === "cancelled";
  const step = stepOf(order.status as string);
  const number = (order.order_number as string | null) ?? "zonder nummer";
  const placerName = placer ? (placer.full_name as string | null) || (placer.email as string | null) : null;
  const own = order.ordered_by === user.id;
  const budget = allowance.allowance.budget;

  const steps = [
    { label: pending || order.is_request ? "Wacht op goedkeuring" : "Geplaatst", hint: pending ? "Bij de goedkeurder" : "Ontvangen" },
    { label: "In productie", hint: "Alvasi gaat aan de slag" },
    { label: "Verzonden", hint: "Onderweg naar het leveradres" },
    { label: "Geleverd", hint: "Op het leveradres" },
  ];

  const address = [
    order.ship_to_name,
    order.ship_to_address,
    [order.ship_to_postal, order.ship_to_city].filter(Boolean).join(" "),
    order.ship_to_country && order.ship_to_country !== "NL" && order.ship_to_country !== "Nederland"
      ? order.ship_to_country
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
              closed
                ? "bg-muted text-muted-foreground"
                : pending
                  ? "bg-amber-100 text-amber-700"
                  : "bg-green-100 text-green-700",
            )}
          >
            {closed ? <XCircle className="h-6 w-6" /> : pending ? <Hourglass className="h-6 w-6" /> : <Check className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">
              {closed
                ? `Bestelling ${number} is ${ORDER_STATUS[order.status as string]?.label.toLowerCase() ?? order.status}`
                : order.is_request
                  ? `Je aanvraag ${number} is ingediend`
                  : `Bestelling ${number} is geplaatst`}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {when(order.created_at as string)}
              {" · besteld door "}
              {own ? "jou" : ((order.ordered_by_name as string | null) ?? "een medewerker")}
              {placerName ? ` · geplaatst door ${placer && order.placed_by === user.id ? "jou" : placerName}` : ""}
            </p>
          </div>
        </div>

        {pending ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>
              {approvers.length
                ? `${approvers.join(", ").replace(/, ([^,]*)$/, " of $1")} beoordeelt ${approvers.length > 1 ? "de aanvraag" : "hem"}.`
                : "Een leidinggevende beoordeelt de aanvraag."}
              {order.request_reason ? ` Reden: ${order.request_reason}.` : ""}
            </p>
            <p className="mt-1 text-amber-800">
              Tot die tijd kun je de aanvraag nog annuleren.{" "}
              <Link href={`/orders/${order.id}`} className="font-medium underline underline-offset-2">
                Annuleren
              </Link>
            </p>
          </div>
        ) : null}

        {closed ? null : (
          <div className="mt-6">
            <p className="mb-2 text-sm text-muted-foreground">Wat er nu gebeurt</p>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {steps.map((s, i) => {
                const done = i < step || (i === 0 && !pending);
                const current = i === step;
                return (
                  <li
                    key={s.label}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "border-t-[3px] pt-2",
                      current
                        ? pending
                          ? "border-amber-500"
                          : "border-[var(--brand)]"
                        : done
                          ? "border-green-600"
                          : "border-border",
                    )}
                  >
                    <p className={cn("flex items-center gap-1 text-sm", done || current ? "font-medium" : "text-muted-foreground")}>
                      {done && !current ? <Check className="h-3.5 w-3.5 text-green-600" /> : null}
                      {s.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Wat je bestelde ({count} {count === 1 ? "artikel" : "artikelen"})
            </p>
            <ul className="space-y-0.5 text-sm">
              {items.map((i, n) => (
                <li key={n} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {i.quantity}× {i.product_name}
                    {i.variant_label ? <span className="text-muted-foreground"> · {shortVariant(i.variant_label)}</span> : null}
                  </span>
                  {display !== "hidden" ? (
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatValue(i.line_total, i.credit_cost * i.quantity, display)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {display !== "hidden" ? (
              <p className="mt-2 border-t pt-2 text-sm font-medium">
                Totaal {formatValue(Number(order.total ?? 0), Number(order.credit_total ?? 0), display)}
                {budget && settings.payment !== "none" ? (
                  <span className="font-normal text-muted-foreground">
                    {" · nog "}
                    {formatAmount(Math.max(0, budget.remaining), settings.payment)}
                    {own ? " budget over" : " budget over voor de medewerker"}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Wordt geleverd op
            </p>
            {address.length ? (
              <div className="text-sm">
                <p className="font-medium">{address[0]}</p>
                {address.slice(1).map((l, n) => (
                  <p key={n} className="text-muted-foreground">
                    {l}
                  </p>
                ))}
                {order.ship_to_custom ? <p className="mt-1 text-xs text-amber-700">Ander adres, vraagt goedkeuring</p> : null}
                {order.reference ? <p className="mt-2 text-xs text-muted-foreground">Referentie: {order.reference as string}</p> : null}
                {order.cost_center ? <p className="text-xs text-muted-foreground">Kostenplaats: {order.cost_center as string}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Geen adres opgegeven</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/orders/${order.id}`} className={buttonVariants()}>
            Bekijk bestelling
          </Link>
          <Link href="/orders" className={buttonVariants({ variant: "outline" })}>
            Mijn bestellingen
          </Link>
          <Link href="/products" className={buttonVariants({ variant: "outline" })}>
            Verder winkelen
          </Link>
        </div>
      </div>
    </div>
  );
}
