import Link from "next/link";
import { Building2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/primitives";
import { NewCompanyDialog } from "./new-company-dialog";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const admin = createAdminClient();
  const { data: companies } = await admin
    .from("companies")
    .select(
      "id, name, slug, logo_url, primary_color, secondary_color, products:products(count), profiles:profiles(count)",
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Your client companies and their branded portals."
        action={<NewCompanyDialog />}
      />

      {!companies || companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Create your first client company to get started."
          action={<NewCompanyDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const productCount =
              (c.products as { count: number }[] | null)?.[0]?.count ?? 0;
            const userCount =
              (c.profiles as { count: number }[] | null)?.[0]?.count ?? 0;
            return (
              <Link key={c.id} href={`/admin/companies/${c.id}`}>
                <Card className="p-5 transition hover:border-foreground/20 hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-base font-bold text-white"
                      style={{ background: c.primary_color }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        /{c.slug}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {productCount} product{productCount === 1 ? "" : "s"} ·{" "}
                      {userCount} user{userCount === 1 ? "" : "s"}
                    </p>
                    <div className="flex gap-1.5">
                      <span
                        className="h-5 w-5 rounded-full border"
                        style={{ background: c.primary_color }}
                      />
                      <span
                        className="h-5 w-5 rounded-full border"
                        style={{ background: c.secondary_color }}
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
