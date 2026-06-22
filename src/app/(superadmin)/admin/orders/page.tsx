import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/primitives";
import { ProductionBoard, type BoardOrder } from "./production-board";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  created_at: string;
  company: { name: string } | null;
  items: {
    id: string;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    checked: boolean;
  }[];
};

export default async function ProductionBoardPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      "id, order_number, status, total, created_at, company:companies(name), items:order_items(id, product_name, variant_label, quantity, checked)",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];
  const orders: BoardOrder[] = rows.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total: o.total,
    created_at: o.created_at,
    company: o.company?.name ?? null,
    items: o.items ?? [],
  }));

  return (
    <div>
      <PageHeader
        title="Productie"
        description="Volg en verwerk bestellingen door de productiefases. Sleep kaarten tussen fases of gebruik de lijstweergave."
      />
      <ProductionBoard orders={orders} />
    </div>
  );
}
