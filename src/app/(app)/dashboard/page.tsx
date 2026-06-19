import Link from "next/link";
import { Package, ClipboardList, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/primitives";

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

  const firstName = user?.fullName?.split(" ")[0];

  return (
    <div>
      <PageHeader
        title={`Welkom${firstName ? `, ${firstName}` : ""}`}
        description={`Bestel de producten van ${user?.company?.name ?? "je bedrijf"}.`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Producten beschikbaar"
          value={productCount ?? 0}
          icon={Package}
          accent
        />
        <StatCard
          label={
            can(user, "orders.view_all")
              ? "Bestellingen bedrijf"
              : "Jouw bestellingen"
          }
          value={orderCount ?? 0}
          icon={ClipboardList}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {can(user, "products.view") ? (
          <Link href="/products" className={buttonVariants()}>
            Naar de winkel <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
        {can(user, "orders.view_own") || can(user, "orders.view_all") ? (
          <Link href="/orders" className={buttonVariants({ variant: "outline" })}>
            Bestellingen bekijken
          </Link>
        ) : null}
      </div>
    </div>
  );
}
