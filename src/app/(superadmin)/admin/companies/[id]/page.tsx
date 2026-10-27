import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Users,
  Plus,
  LayoutDashboard,
  Palette,
  UserCog,
  ClipboardList,
  ArrowRight,
  Images,
  MapPin,
  Plug,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageHeader,
  EmptyState,
  StatCard,
} from "@/components/primitives";
import { CompanyBrandingForm } from "@/components/company-branding-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BrandPreview } from "@/components/brand-preview";
import { ProductThumb } from "@/components/product-thumb";
import { CompanyAddressesPanel } from "@/components/company-addresses-panel";
import type { CompanyAddress } from "@/lib/address-actions";
import { getIntegration } from "@/lib/jamespro/sync";
import { CompanyMedia } from "./company-media";
import { CompanyJamespro } from "./company-jamespro";
import { loadPersoneel } from "@/lib/personeel/data";
import { PersoneelWorkspace } from "@/components/personeel/workspace";
import { getCurrentUser } from "@/lib/auth/user";
import { formatPrice } from "@/lib/format";
import { updateCompany, deleteCompany } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  active: "Actief",
  draft: "Concept",
  archived: "Gearchiveerd",
};

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; persoon?: string; functie?: string; sub?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const me = await getCurrentUser();
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select(
      "id, name, slug, logo_url, primary_color, secondary_color, settings, jamespro_company_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!company) notFound();

  const jamesproConnected = !!(await getIntegration())?.enabled;

  const [{ data: products }, { data: media }, { data: addresses }, personeel] =
    await Promise.all([
      admin
        .from("products")
        .select(
          "id, name, status, base_price, category:categories(id, name), images:product_images(url, is_primary)",
        )
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("company_media")
        .select("id, url")
        .eq("company_id", id)
        .order("sort_order"),
      admin
        .from("company_addresses")
        .select("*")
        .eq("company_id", id)
        .order("is_default", { ascending: false })
        .order("sort_order"),
      loadPersoneel(id),
    ]);

  const productList = products ?? [];
  const tabs = ["overview", "branding", "products", "personeel", "bestellingen", "addresses", "jamespro", "media"];
  const initialTab = tabs.includes(query.tab ?? "") ? query.tab! : "overview";

  return (
    <div>
      <Link
        href="/admin/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Alle bedrijven
      </Link>

      <PageHeader title={company.name} description={`/${company.slug}`} />

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4" /> Overzicht
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="h-4 w-4" /> Huisstijl
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4" /> Producten
          </TabsTrigger>
          <TabsTrigger value="personeel">
            <UserCog className="h-4 w-4" /> Personeel
          </TabsTrigger>
          <TabsTrigger value="bestellingen">
            <ClipboardList className="h-4 w-4" /> Bestellingen
          </TabsTrigger>
          <TabsTrigger value="addresses">
            <MapPin className="h-4 w-4" /> Leveradressen
          </TabsTrigger>
          <TabsTrigger value="jamespro">
            <Plug className="h-4 w-4" /> JamesPRO
          </TabsTrigger>
          <TabsTrigger value="media">
            <Images className="h-4 w-4" /> Sfeerbeelden
          </TabsTrigger>
        </TabsList>

        {/* Overzicht */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Producten" value={productList.length} icon={Package} accent />
            <StatCard label="Medewerkers" value={personeel.people.length} icon={Users} />
            <div className="sm:col-span-1">
              <BrandPreview
                name={company.name}
                primary={company.primary_color}
                secondary={company.secondary_color}
                logoUrl={company.logo_url}
              />
            </div>
          </div>
        </TabsContent>

        {/* Huisstijl */}
        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Huisstijl bewerken</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyBrandingForm
                action={updateCompany.bind(null, id)}
                defaultName={company.name}
                defaultLogoUrl={company.logo_url}
                defaultPrimary={company.primary_color}
                defaultSecondary={company.secondary_color}
                submitLabel="Wijzigingen opslaan"
              />
            </CardContent>
          </Card>

          <Card className="mt-6 border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive">
                Gevarenzone
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Verwijder dit bedrijf en alle bijbehorende gegevens. Dit kan niet
                ongedaan worden gemaakt.
              </p>
              <ConfirmDialog
                action={deleteCompany.bind(null, id)}
                triggerLabel="Bedrijf verwijderen"
                title={`${company.name} verwijderen?`}
                description="Alle producten, gebruikers en bestellingen van dit bedrijf worden verwijderd."
                confirmLabel="Definitief verwijderen"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Producten */}
        <TabsContent value="products" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Link
              href="/admin/catalog/new"
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="h-4 w-4" /> Nieuw product
            </Link>
          </div>
          {productList.length === 0 ? (
            <EmptyState icon={Package} title="Nog geen producten" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {productList.map((p) => {
                return (
                  <Link
                    key={p.id}
                    href={`/admin/catalog/${p.id}`}
                    className="group"
                  >
                    <Card className="overflow-hidden p-0 transition hover:border-foreground/20">
                      <ProductThumb
                        images={
                          (p.images as unknown as {
                            url: string;
                            is_primary: boolean;
                          }[]) ?? []
                        }
                        alt={p.name}
                        className="aspect-square w-full"
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium leading-tight">{p.name}</p>
                          <Badge
                            variant={p.status === "active" ? "default" : "secondary"}
                          >
                            {STATUS[p.status] ?? p.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(p.category as unknown as { name: string } | null)
                            ?.name ?? "—"}
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {formatPrice(p.base_price)}
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Personeel */}
        <TabsContent value="personeel" className="mt-4">
          <PersoneelWorkspace
            data={personeel}
            perms={{
              view: true,
              invite: true,
              update: true,
              remove: true,
              roles: true,
              settings: true,
            }}
            currentUserId={me?.id ?? ""}
            previewBase={`/admin/companies/${id}/bekijk/`}
            initial={{ tab: query.sub, persoon: query.persoon, functie: query.functie }}
            tabParam="sub"
            header={false}
          />
        </TabsContent>

        {/* Bestellingen */}
        <TabsContent value="bestellingen" className="mt-4">
          <Card>
            <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Bestellingen van {company.name}</p>
                <p className="text-sm text-muted-foreground">
                  Zoek en filter op periode, medewerker, functie en product, bekijk per
                  medewerker of per product, en exporteer naar Excel.
                </p>
              </div>
              <Link
                href={`/admin/bestellingen?bedrijf=${id}`}
                className={buttonVariants()}
              >
                Open het bestellingenoverzicht <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leveradressen */}
        <TabsContent value="addresses" className="mt-4">
          <CompanyAddressesPanel
            companyId={id}
            addresses={(addresses ?? []) as CompanyAddress[]}
          />
        </TabsContent>

        {/* JamesPRO */}
        <TabsContent value="jamespro" className="mt-4">
          <CompanyJamespro
            companyId={id}
            companyName={company.name}
            linkedId={company.jamespro_company_id ?? null}
            connected={jamesproConnected}
          />
        </TabsContent>

        {/* Sfeerbeelden */}
        <TabsContent value="media" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sfeerbeelden</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyMedia companyId={id} images={media ?? []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
