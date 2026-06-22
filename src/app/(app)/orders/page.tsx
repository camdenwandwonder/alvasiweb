import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { PageHeader, EmptyState, StatusBadge } from "@/components/primitives";
import { formatDate, formatPrice, ORDER_STATUS } from "@/lib/format";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  created_at: string;
  ordered_by: string;
  items: { quantity: number; product_name: string }[];
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, total, created_at, ordered_by, items:order_items(quantity, product_name)",
    )
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as OrderRow[];
  const viewAll = can(user, "orders.view_all");

  const names = new Map<string, string>();
  if (viewAll && orders.length) {
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
        title="Bestellingen"
        description={
          viewAll
            ? "Alle bestellingen van je bedrijf."
            : "Jouw bestelgeschiedenis."
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nog geen bestellingen"
          description="Bestellingen die je plaatst verschijnen hier."
        />
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const status = ORDER_STATUS[o.status] ?? {
              label: o.status,
              tone: "neutral" as const,
            };
            const totalQty = o.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition hover:border-foreground/20"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {o.order_number ?? "Bestelling"}
                      </span>
                      <StatusBadge tone={status.tone}>
                        {status.label}
                      </StatusBadge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {viewAll ? `${names.get(o.ordered_by) ?? "Teamlid"} · ` : ""}
                      {totalQty} artikel{totalQty === 1 ? "" : "en"} ·{" "}
                      {formatDate(o.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium">
                    {formatPrice(o.total)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
