import Link from "next/link";
import { BarChart3, ClipboardList, Euro, Download } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, StatCard, EmptyState } from "@/components/primitives";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

type Order = {
  status: string;
  total: number;
  company: { name: string } | null;
};

const COUNTS = ["approved", "in_production", "shipped", "delivered", "fulfilled"];

export default async function ReportsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("status, total, company:companies(name)");

  const orders = (data ?? []) as unknown as Order[];
  const billable = orders.filter((o) => COUNTS.includes(o.status));
  const revenue = billable.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const pending = orders.filter((o) => o.status === "pending_approval").length;

  const byCompany = new Map<string, { count: number; total: number }>();
  for (const o of billable) {
    const name = o.company?.name ?? "Onbekend";
    const cur = byCompany.get(name) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(o.total ?? 0);
    byCompany.set(name, cur);
  }
  const rows = [...byCompany.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div>
      <PageHeader
        title="Rapportages"
        description="Omzet en bestelvolume over alle bedrijven."
        action={
          <a href="/admin/reports/export" className={buttonVariants({ variant: "outline" })}>
            <Download className="h-4 w-4" /> Exporteer CSV
          </a>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Omzet" value={formatPrice(revenue)} icon={Euro} accent />
        <StatCard label="Bestellingen" value={billable.length} icon={ClipboardList} />
        <StatCard label="Wacht op goedkeuring" value={pending} icon={BarChart3} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per bedrijf</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState icon={BarChart3} title="Nog geen bestellingen" />
          ) : (
            <ul className="divide-y">
              {rows.map(([name, v]) => (
                <li key={name} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-sm text-muted-foreground">
                    {v.count} bestelling{v.count === 1 ? "" : "en"} ·{" "}
                    <span className="font-medium text-foreground">
                      {formatPrice(v.total)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        <Link href="/admin/orders" className="hover:underline">
          Bekijk de productie →
        </Link>
      </p>
    </div>
  );
}
