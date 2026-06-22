import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/primitives";
import { CompaniesTable, type CompanyRow } from "./companies-table";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select(
      "id, name, slug, logo_url, primary_color, secondary_color, products:products(count), profiles:profiles(count)",
    )
    .order("created_at", { ascending: false });

  const companies: CompanyRow[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    logo_url: c.logo_url,
    primary_color: c.primary_color,
    secondary_color: c.secondary_color,
    productCount: (c.products as { count: number }[] | null)?.[0]?.count ?? 0,
    userCount: (c.profiles as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Bedrijven"
        description="Je klantbedrijven en hun gebrande portalen."
        action={
          <Link href="/admin/companies/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw bedrijf
          </Link>
        }
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nog geen bedrijven"
          description="Maak je eerste klantbedrijf aan om te beginnen."
          action={
            <Link href="/admin/companies/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuw bedrijf
            </Link>
          }
        />
      ) : (
        <CompaniesTable companies={companies} />
      )}
    </div>
  );
}
