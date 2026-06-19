import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
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
          "id, name, category, active, max_quantity_per_order, variants:product_variants(id, attributes)",
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
        className="mb-4 inline-block text-sm text-muted hover:underline"
      >
        ← All companies
      </Link>

      <PageHeader
        title={company.name}
        description={`/${company.slug}`}
        action={
          <div className="flex gap-2">
            <span
              className="h-9 w-9 rounded-lg border border-border"
              style={{ background: company.primary_color }}
            />
            <span
              className="h-9 w-9 rounded-lg border border-border"
              style={{ background: company.secondary_color }}
            />
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Products */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Products</h2>
          {!products || products.length === 0 ? (
            <EmptyState title="No products yet" />
          ) : (
            <ul className="mb-4 space-y-2">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{p.name}</p>
                    {p.active ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge>Inactive</Badge>
                    )}
                  </div>
                  {p.variants && p.variants.length > 0 ? (
                    <p className="mt-1 text-sm text-muted">
                      {p.variants
                        .map((v) =>
                          variantLabel(
                            v.attributes as Record<string, unknown>,
                          ),
                        )
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">No variants</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Card>
            <h3 className="mb-3 font-medium">Add product</h3>
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
                <Field label="Max qty / order" hint="Blank = unlimited">
                  <Input name="max_quantity_per_order" type="number" min="1" />
                </Field>
              </div>
              <Field label="Image URL" hint="Optional">
                <Input name="image_url" placeholder="https://…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sizes" hint="Comma-separated">
                  <Input name="sizes" placeholder="S, M, L, XL" />
                </Field>
                <Field label="Colors" hint="Comma-separated">
                  <Input name="colors" placeholder="Navy, Black" />
                </Field>
              </div>
              <Button type="submit" className="w-full">
                Add product
              </Button>
            </form>
          </Card>
        </section>

        {/* Users */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Users</h2>
          {!users || users.length === 0 ? (
            <EmptyState title="No users yet" />
          ) : (
            <ul className="mb-4 space-y-2">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                >
                  <div>
                    <p className="font-medium">{u.full_name ?? u.email}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </div>
                  <Badge tone="blue">
                    {(u.role as unknown as { name: string } | null)?.name ??
                      "No role"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          <Card>
            <h3 className="mb-3 font-medium">Add user</h3>
            {!roles || roles.length === 0 ? (
              <p className="text-sm text-muted">
                Default roles are still being created. Refresh in a moment.
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
                  <Input name="password" type="text" required minLength={6} />
                </Field>
                <Field label="Role">
                  <Select name="role_id" required defaultValue="">
                    <option value="" disabled>
                      Select a role…
                    </option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.requires_order_approval ? " (approval required)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" className="w-full">
                  Create user
                </Button>
              </form>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
