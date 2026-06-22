import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatPrice } from "@/lib/format";
import { approveOrder, rejectOrder } from "../orders/actions";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_number: string | null;
  total: number;
  created_at: string;
  ordered_by: string;
  items: { quantity: number; product_name: string; variant_label: string | null }[];
};

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!can(user, "orders.approve")) redirect("/dashboard");
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, total, created_at, ordered_by, items:order_items(quantity, product_name, variant_label)",
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });

  const orders = (data ?? []) as unknown as OrderRow[];

  const names = new Map<string, string>();
  if (orders.length) {
    const ids = [...new Set(orders.map((o) => o.ordered_by))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of profiles ?? [])
      names.set(p.id, p.full_name ?? p.email ?? "Teamlid");
  }

  return (
    <div>
      <PageHeader
        title="Goedkeuringen"
        description="Bestellingen die op jouw goedkeuring wachten."
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Niets te beoordelen"
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
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-medium hover:underline"
                    >
                      {o.order_number ?? "Bestelling"}
                    </Link>
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
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatPrice(o.total)}</span>
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
    </div>
  );
}
