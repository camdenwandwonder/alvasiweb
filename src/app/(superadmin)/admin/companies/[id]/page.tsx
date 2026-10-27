import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Users,
  Plus,
  LayoutDashboard,
  Palette,
  Eye,
  Wallet,
  Images,
  MapPin,
  Plug,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageHeader,
  EmptyState,
  Field,
  NativeSelect,
  StatCard,
} from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { CompanyBrandingForm } from "@/components/company-branding-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BrandPreview } from "@/components/brand-preview";
import { ProductThumb } from "@/components/product-thumb";
import { BudgetSettingsPanel } from "@/components/budget-settings-panel";
import { CompanyAddressesPanel } from "@/components/company-addresses-panel";
import type { CompanyAddress } from "@/lib/address-actions";
import type { BudgetMode } from "@/lib/allowance";
import { getIntegration } from "@/lib/jamespro/sync";
import { CompanyMedia } from "./company-media";
import { CompanyJamespro } from "./company-jamespro";
import type { SizeSet } from "@/components/user-sizes-dialog";
import { UsersManager } from "@/components/users-manager";
import { getCurrentUser } from "@/lib/auth/user";
import { formatPrice } from "@/lib/format";
import {
  updateCompany,
  deleteCompany,
  setCompanyCategoryVisibility,
} from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  active: "Actief",
  draft: "Concept",
  archived: "Gearchiveerd",
};

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [
    { data: products },
    { data: roles },
    { data: users },
    { data: crv },
    { data: budgets },
    { data: allotments },
    { data: media },
    { data: addresses },
    { data: sizeSets },
  ] = await Promise.all([
    admin
      .from("products")
      .select(
        "id, name, status, base_price, category:categories(id, name), images:product_images(url, is_primary)",
      )
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("roles")
      .select("id, name, requires_order_approval")
      .eq("company_id", id)
      .order("name"),
    admin
      .from("profiles")
      .select("id, full_name, email, status, sizes, role_id")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("category_role_visibility")
      .select("category_id, role_id")
      .eq("company_id", id),
    admin
      .from("budgets")
      .select("id, scope, target_id, amount, period, kind")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("product_allotments")
      .select("id, scope, target_id, product_id, max_quantity, period")
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
    admin
      .from("option_sets")
      .select("id, name, values:option_values(id, value, label, sort_order)")
      .eq("kind", "size")
      .order("name"),
  ]);

  const productList = products ?? [];
  const userList = users ?? [];
  const roleList = roles ?? [];

  // Distinct categories used by this company's catalog (for visibility tab).
  const catMap = new Map<string, string>();
  for (const p of productList) {
    const c = p.category as unknown as { id: string; name: string } | null;
    if (c) catMap.set(c.id, c.name);
  }
  const usedCategories = [...catMap.entries()].map(([cid, name]) => ({
    id: cid,
    name,
  }));
  const allowedByCat = new Map<string, Set<string>>();
  for (const r of crv ?? []) {
    const s = allowedByCat.get(r.category_id) ?? new Set<string>();
    s.add(r.role_id);
    allowedByCat.set(r.category_id, s);
  }

  const settings = (company.settings as Record<string, unknown>) ?? {};
  const budgetMode = (settings.budget_mode as BudgetMode) ?? "euro";
  const threshold = settings.approval_over_amount;

  return (
    <div>
      <Link
        href="/admin/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Alle bedrijven
      </Link>

      <PageHeader title={company.name} description={`/${company.slug}`} />

      <Tabs defaultValue="overview" className="w-full">
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
          <TabsTrigger value="users">
            <Users className="h-4 w-4" /> Gebruikers
          </TabsTrigger>
          <TabsTrigger value="visibility">
            <Eye className="h-4 w-4" /> Zichtbaarheid
          </TabsTrigger>
          <TabsTrigger value="budget">
            <Wallet className="h-4 w-4" /> Bestelwijze
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
            <StatCard label="Gebruikers" value={userList.length} icon={Users} />
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

        {/* Gebruikers */}
        <TabsContent value="users" className="mt-4">
          <UsersManager
            companyId={company.id}
            users={userList.map((u) => ({
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              status: u.status,
              role_id: u.role_id,
              sizes: (u.sizes as Record<string, string> | null) ?? null,
            }))}
            roles={roleList.map((r) => ({ id: r.id, name: r.name }))}
            sizeSets={(sizeSets ?? []) as unknown as SizeSet[]}
            currentUserId={me?.id ?? ""}
            canInvite
            canUpdate
            canRemove
          />
        </TabsContent>

        {/* Zichtbaarheid */}
        <TabsContent value="visibility" className="mt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Bepaal welke rollen de producten van een categorie zien. Geen
            selectie = zichtbaar voor iedereen.
          </p>
          {usedCategories.length === 0 ? (
            <EmptyState
              icon={Eye}
              title="Nog geen categorieën in de catalogus"
              description="Voeg producten met een categorie toe om zichtbaarheid in te stellen."
            />
          ) : roleList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Dit bedrijf heeft nog geen rollen.
            </p>
          ) : (
            <div className="space-y-4">
              {usedCategories.map((c) => {
                const set = allowedByCat.get(c.id) ?? new Set<string>();
                const restricted = set.size > 0;
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        {c.name}
                        <span className="text-xs font-normal text-muted-foreground">
                          {restricted
                            ? `Zichtbaar voor ${set.size} rol(len)`
                            : "Zichtbaar voor iedereen"}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        action={setCompanyCategoryVisibility.bind(null, id, c.id)}
                        className="space-y-3"
                      >
                        <div className="flex flex-wrap gap-2">
                          {roleList.map((r) => (
                            <label
                              key={r.id}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5"
                            >
                              <input
                                type="checkbox"
                                name="role_ids"
                                value={r.id}
                                defaultChecked={set.has(r.id)}
                                className="h-3.5 w-3.5"
                              />
                              {r.name}
                            </label>
                          ))}
                        </div>
                        <SubmitButton size="sm">Opslaan</SubmitButton>
                      </form>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Bestelwijze */}
        <TabsContent value="budget" className="mt-4">
          <BudgetSettingsPanel
            companyId={id}
            mode={budgetMode}
            approvalThreshold={threshold != null ? String(threshold) : ""}
            roles={roleList.map((r) => ({ id: r.id, name: r.name }))}
            people={userList.map((u) => ({
              id: u.id,
              full_name: u.full_name,
              email: u.email,
            }))}
            products={productList.map((p) => ({ id: p.id, name: p.name }))}
            budgets={(budgets ?? []) as never}
            allotments={(allotments ?? []) as never}
          />
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
