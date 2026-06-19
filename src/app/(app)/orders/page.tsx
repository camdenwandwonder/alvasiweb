import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { PageHeader, EmptyState, StatusBadge } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, ORDER_STATUS } from "@/lib/format";
import { approveOrder, rejectOrder } from "./actions";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  ordered_by: string;
  items: {
    quantity: number;
    product_name: string;
    variant_label: string | null;
  }[];
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, note, created_at, ordered_by, items:order_items(quantity, product_name, variant_label)",
    )
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as OrderRow[];
  const canApprove = can(user, "orders.approve");
  const viewAll = can(user, "orders.view_all");

  const names = new Map<string, string>();
  if (viewAll && orders.length) {
    const ids = [...new Set(orders.map((o) => o.ordered_by))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of profiles ?? [])
      names.set(p.id, p.full_name ?? p.email ?? "Team member");
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description={
          viewAll ? "All orders placed by your company." : "Your order history."
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders yet"
          description="Orders you place will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const status = ORDER_STATUS[o.status] ?? {
              label: o.status,
              tone: "neutral" as const,
            };
            return (
              <li key={o.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    {viewAll ? (
                      <span className="text-sm font-medium">
                        {names.get(o.ordered_by) ?? "Team member"}
                      </span>
                    ) : null}
                    <time className="text-xs text-muted-foreground">
                      {formatDate(o.created_at)}
                    </time>
                  </div>

                  {canApprove && o.status === "pending_approval" ? (
                    <div className="flex gap-2">
                      <form action={approveOrder.bind(null, o.id)}>
                        <SubmitButton size="sm">Approve</SubmitButton>
                      </form>
                      <form action={rejectOrder.bind(null, o.id)}>
                        <SubmitButton size="sm" variant="destructive">
                          Reject
                        </SubmitButton>
                      </form>
                    </div>
                  ) : null}
                </div>

                <ul className="mt-3 space-y-1 text-sm">
                  {o.items.map((i, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>
                        {i.product_name}
                        {i.variant_label ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {i.variant_label}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground">×{i.quantity}</span>
                    </li>
                  ))}
                </ul>
                {o.note ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Note: {o.note}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
