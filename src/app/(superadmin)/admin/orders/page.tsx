import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/primitives";
import { formatPrice, ORDER_STATUS } from "@/lib/format";

export const dynamic = "force-dynamic";

const COLUMNS: { key: string; label: string }[] = [
  { key: "pending_approval", label: "Wacht op goedkeuring" },
  { key: "approved", label: "Goedgekeurd" },
  { key: "in_production", label: "In productie" },
  { key: "shipped", label: "Verzonden" },
  { key: "delivered", label: "Geleverd" },
];

type Order = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  company: { name: string } | null;
  items: { quantity: number }[];
};

export default async function ProductionBoard() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      "id, order_number, status, total, company:companies(name), items:order_items(quantity)",
    )
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as Order[];
  const byStatus = (s: string) => orders.filter((o) => o.status === s);

  return (
    <div>
      <PageHeader
        title="Productie"
        description="Volg en verwerk bestellingen door de productiefases."
      />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const list = byStatus(col.key);
          const tone = ORDER_STATUS[col.key]?.tone ?? "neutral";
          return (
            <div key={col.key} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-medium">{col.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {list.length}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((o) => {
                  const qty = o.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <Link key={o.id} href={`/admin/orders/${o.id}`}>
                      <Card className="p-3 transition hover:border-foreground/20">
                        <p className="text-sm font-medium">
                          {o.order_number ?? "Bestelling"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {o.company?.name ?? "—"}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {qty} artikel{qty === 1 ? "" : "en"}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatPrice(o.total)}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
                {list.length === 0 ? (
                  <div
                    className={`rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground`}
                    data-tone={tone}
                  >
                    Leeg
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
