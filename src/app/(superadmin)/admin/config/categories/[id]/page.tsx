import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { updateCategory, deleteCategory } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: category }, { data: optionSets }, { data: assigned }] =
    await Promise.all([
      admin.from("categories").select("*").eq("id", id).maybeSingle(),
      admin.from("option_sets").select("id, name, kind").order("name"),
      admin
        .from("category_option_sets")
        .select("option_set_id")
        .eq("category_id", id),
    ]);
  if (!category) notFound();

  const assignedIds = new Set((assigned ?? []).map((a) => a.option_set_id));

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/config/categories"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Categories
      </Link>

      <form action={updateCategory.bind(null, id)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Name">
              <Input name="name" defaultValue={category.name} required />
            </Field>
            <Field label="Description">
              <Textarea
                name="description"
                rows={2}
                defaultValue={category.description ?? ""}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={category.active}
                className="h-4 w-4 rounded border"
              />
              Active (available when creating products)
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Option axes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Which size systems / palettes products in this category can offer.
            </p>
            {!optionSets || optionSets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No option sets yet —{" "}
                <Link
                  href="/admin/config/options"
                  className="text-[var(--brand-2)] hover:underline"
                >
                  create one
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2">
                {optionSets.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="option_set_ids"
                      value={s.id}
                      defaultChecked={assignedIds.has(s.id)}
                      className="h-4 w-4 rounded border"
                    />
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.kind}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These cascade to every product in this category (a product can
              override them).
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="default_requires_approval"
                defaultChecked={category.default_requires_approval}
                className="h-4 w-4 rounded border"
              />
              Orders require manager approval by default
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="default_requires_proof"
                defaultChecked={category.default_requires_proof}
                className="h-4 w-4 rounded border"
              />
              Require artwork proof approval before production
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Default max qty / order" hint="Blank = unlimited">
                <Input
                  type="number"
                  name="default_max_quantity"
                  min="1"
                  defaultValue={category.default_max_quantity ?? ""}
                />
              </Field>
              <Field label="Default lead time (days)">
                <Input
                  type="number"
                  name="default_lead_time_days"
                  min="0"
                  defaultValue={category.default_lead_time_days ?? ""}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </form>

      <form
        action={deleteCategory.bind(null, id)}
        className="mt-4 border-t pt-4"
      >
        <SubmitButton variant="destructive" size="sm">
          Delete category
        </SubmitButton>
      </form>
    </div>
  );
}
