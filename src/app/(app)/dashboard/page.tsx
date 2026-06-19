import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Button, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ count: productCount }, { count: orderCount }] = await Promise.all([
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase.from("orders").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <PageHeader
        title={`Welcome${user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description={`Order ${user?.company?.name ?? "your company"}'s custom products.`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-muted">Products available</p>
          <p className="mt-1 text-3xl font-semibold">{productCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">
            {can(user, "orders.view_all") ? "Company orders" : "Your orders"}
          </p>
          <p className="mt-1 text-3xl font-semibold">{orderCount ?? 0}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        {can(user, "products.view") ? (
          <Link href="/products">
            <Button>Browse products</Button>
          </Link>
        ) : null}
        {can(user, "orders.view_own") || can(user, "orders.view_all") ? (
          <Link href="/orders">
            <Button variant="secondary">View orders</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
