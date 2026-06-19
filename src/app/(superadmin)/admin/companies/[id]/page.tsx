import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageHeader,
  EmptyState,
  Field,
  NativeSelect,
} from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { ImageUploader } from "@/components/image-uploader";
import { variantLabel } from "@/lib/format";
import { createProduct, createCompanyUser } from "./actions";

export const dynamic = "force-dynamic";

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
          "id, name, category, active, variants:product_variants(id, attributes)",
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
        <ArrowLeft className="h-4 w-4" /> All companies
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
            <Package className="h-4 w-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
        </TabsList>

        {/* Products */}
        <TabsContent value="products" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              {!products || products.length === 0 ? (
                <EmptyState icon={Package} title="No products yet" />
              ) : (
                <ul className="space-y-2">
                  {products.map((p) => (
                    <li key={p.id} className="rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          {p.category ? (
                            <p className="text-xs text-muted-foreground">
                              {p.category}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant={p.active ? "default" : "secondary"}>
                          {p.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {p.variants && p.variants.length > 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {p.variants
                            .map((v) =>
                              variantLabel(
                                v.attributes as Record<string, unknown>,
                              ),
                            )
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Add product</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action={createProduct.bind(null, company.id)}
                  className="space-y-3"
                >
                  <Field label="Name">
                    <Input name="name" required placeholder="Work jacket" />
                  </Field>
                  <Field label="Description">
                    <Textarea name="description" rows={2} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Category">
                      <Input name="category" placeholder="Clothing" />
                    </Field>
                    <Field label="Max qty/order" hint="Blank = ∞">
                      <Input
                        name="max_quantity_per_order"
                        type="number"
                        min="1"
                      />
                    </Field>
                  </div>
                  <Field label="Product image" hint="Optional">
                    <ImageUploader name="image_url" bucket="product-images" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sizes" hint="Comma-separated">
                      <Input name="sizes" placeholder="S, M, L, XL" />
                    </Field>
                    <Field label="Colors" hint="Comma-separated">
                      <Input name="colors" placeholder="Navy, Black" />
                    </Field>
                  </div>
                  <SubmitButton className="w-full">Add product</SubmitButton>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              {!users || users.length === 0 ? (
                <EmptyState icon={Users} title="No users yet" />
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
                          "No role"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Add user</CardTitle>
              </CardHeader>
              <CardContent>
                {!roles || roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Default roles are being created. Refresh in a moment.
                  </p>
                ) : (
                  <form
                    action={createCompanyUser.bind(null, company.id)}
                    className="space-y-3"
                  >
                    <Field label="Full name">
                      <Input name="full_name" placeholder="Jane Doe" />
                    </Field>
                    <Field label="Email">
                      <Input name="email" type="email" required />
                    </Field>
                    <Field label="Temporary password">
                      <Input
                        name="password"
                        type="text"
                        required
                        minLength={6}
                      />
                    </Field>
                    <Field label="Role">
                      <NativeSelect name="role_id" required defaultValue="">
                        <option value="" disabled>
                          Select a role…
                        </option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                            {r.requires_order_approval
                              ? " (approval required)"
                              : ""}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <SubmitButton className="w-full">Create user</SubmitButton>
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
