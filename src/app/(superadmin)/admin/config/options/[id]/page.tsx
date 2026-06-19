import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { addOptionValue, deleteOptionValue, deleteOptionSet } from "../../actions";

export const dynamic = "force-dynamic";

export default async function OptionSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: set }, { data: values }] = await Promise.all([
    admin.from("option_sets").select("*").eq("id", id).maybeSingle(),
    admin
      .from("option_values")
      .select("id, value, label, swatch, sort_order")
      .eq("option_set_id", id)
      .order("sort_order"),
  ]);
  if (!set) notFound();

  const isColor = set.kind === "color";

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/config/options"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Opties & maten
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{set.name}</h1>
        <Badge variant="secondary">{set.kind}</Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Waarden</CardTitle>
        </CardHeader>
        <CardContent>
          {!values || values.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen waarden.</p>
          ) : (
            <ul className="mb-4 divide-y rounded-lg border">
              {values.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    {isColor && v.swatch ? (
                      <span
                        className="h-5 w-5 rounded-full border"
                        style={{ background: v.swatch }}
                      />
                    ) : null}
                    <span className="text-sm font-medium">{v.label ?? v.value}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.value}
                    </span>
                  </div>
                  <form action={deleteOptionValue.bind(null, v.id, id)}>
                    <SubmitButton variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={addOptionValue.bind(null, id)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex-1">
              <Field label="Waarde">
                <Input name="value" required placeholder={isColor ? "navy" : "M"} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Label">
                <Input name="label" placeholder={isColor ? "Navy" : "Medium"} />
              </Field>
            </div>
            {isColor ? (
              <Field label="Kleur">
                <input
                  type="color"
                  name="swatch"
                  defaultValue="#1e293b"
                  className="h-9 w-12 rounded-md border"
                />
              </Field>
            ) : null}
            <SubmitButton>Toevoegen</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <form action={deleteOptionSet.bind(null, id)} className="border-t pt-4">
        <SubmitButton variant="destructive" size="sm">
          Optieset verwijderen
        </SubmitButton>
      </form>
    </div>
  );
}
