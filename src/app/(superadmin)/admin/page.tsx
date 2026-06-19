import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, ORDER_STATUS } from "@/lib/format";
import { NotificationsFeed } from "./notifications-feed";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  status: string;
  created_at: string;
  company: { name: string } | null;
  items: { quantity: number; product_name: string; variant_label: string | null }[];
};

export default async function AdminOverview() {
  const supabase = await createClient();

  const [{ count: companyCount }, { data: orders }, { data: notifs }] =
    await Promise.all([
      supabase.from("companies").select("*", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select(
          "id, status, created_at, company:companies(name), items:order_items(quantity, product_name, variant_label)",
        )
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id, title, body, type, created_at")
        .eq("scope", "superadmin")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const orderRows = (orders ?? []) as unknown as OrderRow[];
  const pending = orderRows.filter((o) => o.status === "pending_approval").length;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Activity across all your client companies."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">Companies</p>
          <p className="mt-1 text-3xl font-semibold">{companyCount ?? 0}</p>
          <Link
            href="/admin/companies"
            className="mt-2 inline-block text-sm text-[var(--brand-2)] hover:underline"
          >
            Manage →
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-muted">Recent orders</p>
          <p className="mt-1 text-3xl font-semibold">{orderRows.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Pending approval</p>
          <p className="mt-1 text-3xl font-semibold">{pending}</p>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <NotificationsFeed initial={notifs ?? []} />

        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent orders</h2>
          {orderRows.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <ul className="space-y-2">
              {orderRows.map((o) => {
                const status = ORDER_STATUS[o.status] ?? {
                  label: o.status,
                  tone: "neutral" as const,
                };
                const totalQty = o.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <li
                    key={o.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">
                        {o.company?.name ?? "Unknown company"}
                      </p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {totalQty} item{totalQty === 1 ? "" : "s"} ·{" "}
                      {o.items
                        .map(
                          (i) =>
                            `${i.product_name}${
                              i.variant_label ? ` (${i.variant_label})` : ""
                            } ×${i.quantity}`,
                        )
                        .join(", ")}
                    </p>
                    <time className="mt-1 block text-xs text-muted">
                      {formatDate(o.created_at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
