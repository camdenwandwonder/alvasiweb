import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState, StatusBadge } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/format";
import {
  displayFor,
  formatAmount,
  formatValue,
  readOrderingSettings,
} from "@/lib/ordering";
import { approveOrder, rejectOrder } from "../orders/actions";
import { BudgetRequestButtons } from "./budget-request-buttons";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_number: string | null;
  total: number;
  credit_total: number | null;
  created_at: string;
  ordered_by: string;
  is_request: boolean;
  request_reason: string | null;
  items: { quantity: number; product_name: string; variant_label: string | null }[];
};

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.approve")) redirect("/dashboard");
  const supabase = await createClient();

  const [{ data }, { data: requests }, { data: company }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, total, credit_total, created_at, ordered_by, is_request, request_reason, items:order_items(quantity, product_name, variant_label)",
      )
      .eq("company_id", user.companyId)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true }),
    supabase
      .from("budget_requests")
      .select("id, user_id, unit, amount, reason, created_at")
      .eq("company_id", user.companyId)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("companies").select("settings").eq("id", user.companyId).maybeSingle(),
  ]);

  const orders = (data ?? []) as unknown as OrderRow[];
  const pendingRequests = requests ?? [];
  const display = displayFor(
    readOrderingSettings(company?.settings as Record<string, unknown> | null),
    "manager",
  );

  const names = new Map<string, string>();
  const ids = [
    ...new Set([
      ...orders.map((o) => o.ordered_by),
      ...pendingRequests.map((r) => r.user_id as string),
    ]),
  ];
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of profiles ?? [])
      names.set(p.id, p.full_name ?? p.email ?? "Teamlid");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Goedkeuringen"
        description="Bestellingen en budgetaanvragen die op jouw besluit wachten."
      />

      {pendingRequests.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Budgetaanvragen
          </h2>
          <ul className="space-y-3">
            {pendingRequests.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
                    <div>
                      <p className="font-medium">
                        {names.get(r.user_id as string) ?? "Teamlid"} vraagt{" "}
                        {formatAmount(
                          Number(r.amount),
                          r.unit === "credits" ? "credits" : "euro",
                        )}{" "}
                        extra budget
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(r.created_at as string)}
                      </p>
                      {r.reason ? (
                        <p className="mt-1 rounded-md bg-muted px-2 py-1 text-sm">
                          Reden: {r.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {r.user_id === user.id ? (
                    <span className="text-sm text-muted-foreground">
                      Je eigen aanvraag; een andere goedkeurder beslist.
                    </span>
                  ) : (
                    <BudgetRequestButtons id={r.id as string} />
                  )}
                </div>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        {pendingRequests.length > 0 ? (
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Bestellingen
          </h2>
        ) : null}
        {orders.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Geen bestellingen te beoordelen"
            description="Er staan geen bestellingen open voor goedkeuring."
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const qty = o.items.reduce((s, i) => s + i.quantity, 0);
              return (
                <Card key={o.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/orders/${o.id}`}
                          className="font-medium hover:underline"
                        >
                          {o.order_number ?? "Bestelling"}
                        </Link>
                        {o.is_request ? (
                          <StatusBadge tone="amber">Aanvraag</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {names.get(o.ordered_by) ?? "Teamlid"} · {qty} artikel
                        {qty === 1 ? "" : "en"} · {formatDate(o.created_at)}
                      </p>
                      <p className="mt-1 text-sm">
                        {o.items
                          .map(
                            (i) =>
                              `${i.product_name}${
                                i.variant_label ? ` (${i.variant_label})` : ""
                              } ×${i.quantity}`,
                          )
                          .join(", ")}
                      </p>
                      {o.is_request && o.request_reason ? (
                        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-800">
                          Reden: {o.request_reason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatValue(Number(o.total), Number(o.credit_total ?? 0), display)}
                      </span>
                      <form action={approveOrder.bind(null, o.id)}>
                        <SubmitButton size="sm">Goedkeuren</SubmitButton>
                      </form>
                      <form action={rejectOrder.bind(null, o.id)}>
                        <SubmitButton size="sm" variant="destructive">
                          Afwijzen
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
