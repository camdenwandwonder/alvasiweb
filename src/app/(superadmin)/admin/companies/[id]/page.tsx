import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Users, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, EmptyState, Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatPrice } from "@/lib/format";
import { createCompanyUser } from "./actions";

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
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, secondary_color")
    .eq("id", id)
    .maybeSingle();
  if (!company) notFound();

  const [{ data: products }, { data: roles }, { data: users }] =
    await Promise.all([
      admin
        .from("products")
        .select(
          "id, name, status, base_price, category:categories(name), images:product_images(url, is_primary)",
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
        .select("id, full_name, email, status, role:roles(name)")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div>
      <Link
        href="/admin/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Alle bedrijven
      </Link>

      <PageHeader
        title={company.name}
        description={`/${company.slug}`}
        action={
          <>
            <span
              className="h-9 w-9 rounded-lg border"
              style={{ background: company.primary_color }}
            />
            <span
              className="h-9 w-9 rounded-lg border"
              style={{ background: company.secondary_color }}
            />
          </>
        }
      />

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products">
            <Package className="h-4 w-4" /> Producten
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4" /> Gebruikers
          </TabsTrigger>
        </TabsList>

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
          {!products || products.length === 0 ? (
            <EmptyState icon={Package} title="Nog geen producten" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const img =
                  (p.images as { url: string; is_primary: boolean }[] | null)?.find(
                    (i) => i.is_primary,
                  )?.url ??
                  (p.images as { url: string }[] | null)?.[0]?.url;
                return (
                  <Link key={p.id} href={`/admin/catalog/${p.id}`}>
                    <Card className="overflow-hidden p-0 transition hover:border-foreground/20">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={p.name}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
                          <Package className="h-7 w-7" />
                        </div>
                      )}
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
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              {!users || users.length === 0 ? (
                <EmptyState icon={Users} title="Nog geen gebruikers" />
              ) : (
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-xl border bg-card p-4"
                    >
                      <div>
                        <p className="font-medium">{u.full_name ?? u.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.email}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {(u.role as unknown as { name: string } | null)?.name ??
                          "Geen rol"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Gebruiker toevoegen</CardTitle>
              </CardHeader>
              <CardContent>
                {!roles || roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Standaardrollen worden aangemaakt. Ververs zo even.
                  </p>
                ) : (
                  <form
                    action={createCompanyUser.bind(null, company.id)}
                    className="space-y-3"
                  >
                    <Field label="Volledige naam">
                      <Input name="full_name" placeholder="Jan Jansen" />
                    </Field>
                    <Field label="E-mailadres">
                      <Input name="email" type="email" required />
                    </Field>
                    <Field label="Tijdelijk wachtwoord">
                      <Input name="password" type="text" required minLength={6} />
                    </Field>
                    <Field label="Rol">
                      <NativeSelect name="role_id" required defaultValue="">
                        <option value="" disabled>
                          Kies een rol…
                        </option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                            {r.requires_order_approval
                              ? " (goedkeuring vereist)"
                              : ""}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <SubmitButton className="w-full">
                      Gebruiker aanmaken
                    </SubmitButton>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
