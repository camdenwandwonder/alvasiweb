import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { Button, Card, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { createCompany } from "./actions";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const admin = createAdminClient();
  const { data: companies } = await admin
    .from("companies")
    .select("id, name, slug, logo_url, primary_color, secondary_color")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Add a client company and configure its branding."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          {!companies || companies.length === 0 ? (
            <EmptyState
              title="No companies yet"
              description="Create your first client company with the form."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/companies/${c.id}`}>
                    <Card className="transition hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                          style={{ background: c.primary_color }}
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted">/{c.slug}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <span
                          className="h-6 w-6 rounded-full border border-border"
                          style={{ background: c.primary_color }}
                          title="Primary"
                        />
                        <span
                          className="h-6 w-6 rounded-full border border-border"
                          style={{ background: c.secondary_color }}
                          title="Secondary"
                        />
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 font-semibold">New company</h2>
          <form action={createCompany} className="space-y-4">
            <Field label="Company name">
              <Input name="name" required placeholder="Acme Workwear" />
            </Field>
            <Field label="Logo URL" hint="Optional — paste an image URL for now.">
              <Input name="logo_url" placeholder="https://…/logo.png" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary color">
                <input
                  type="color"
                  name="primary_color"
                  defaultValue="#0f172a"
                  className="h-10 w-full rounded-lg border border-border"
                />
              </Field>
              <Field label="Secondary color">
                <input
                  type="color"
                  name="secondary_color"
                  defaultValue="#6366f1"
                  className="h-10 w-full rounded-lg border border-border"
                />
              </Field>
            </div>
            <Button type="submit" className="w-full">
              Create company
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
