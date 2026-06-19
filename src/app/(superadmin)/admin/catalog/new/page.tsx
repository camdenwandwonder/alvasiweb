import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { createProductDraft } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const admin = createAdminClient();
  const [{ data: companies }, { data: categories }] = await Promise.all([
    admin.from("companies").select("id, name").order("name"),
    admin.from("categories").select("id, name").eq("active", true).order("sort_order"),
  ]);

  return (
    <div className="max-w-xl">
      <Link
        href="/admin/catalog"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Catalogus
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Nieuw product
      </h1>

      <Card>
        <CardContent className="pt-6">
          <form action={createProductDraft} className="space-y-4">
            <Field label="Naam">
              <Input name="name" required placeholder="Werkjas" />
            </Field>
            <Field label="Bedrijf">
              <NativeSelect name="company_id" required defaultValue="">
                <option value="" disabled>
                  Kies een bedrijf…
                </option>
                {(companies ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Categorie"
              hint="Bepaalt de standaard maten/kleuren en regels."
            >
              <NativeSelect name="category_id" defaultValue="">
                <option value="">Geen categorie</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <SubmitButton>Aanmaken &amp; bewerken</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
