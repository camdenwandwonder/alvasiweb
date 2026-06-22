import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { updateProfile } from "./actions";

export const dynamic = "force-dynamic";

type SizeSet = {
  id: string;
  name: string;
  values: { id: string; value: string; label: string | null; sort_order: number }[];
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [{ data: profile }, { data: sizeSets }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, sizes")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("option_sets")
      .select("id, name, values:option_values(id, value, label, sort_order)")
      .eq("kind", "size")
      .order("name"),
  ]);

  const sizes = (profile?.sizes as Record<string, string>) ?? {};
  const sets = (sizeSets ?? []) as unknown as SizeSet[];

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Mijn profiel"
        description="Je gegevens en maten voor snellere bestellingen."
      />

      <Card>
        <CardContent className="pt-6">
          <form action={updateProfile} className="space-y-4">
            <Field label="Volledige naam">
              <Input name="full_name" defaultValue={profile?.full_name ?? ""} />
            </Field>
            <Field label="Telefoon">
              <Input name="phone" defaultValue={profile?.phone ?? ""} />
            </Field>

            {sets.length > 0 ? (
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Mijn maten</p>
                {sets.map((s) => (
                  <Field key={s.id} label={s.name}>
                    <NativeSelect
                      name={`size_${s.id}`}
                      defaultValue={sizes[s.id] ?? ""}
                    >
                      <option value="">—</option>
                      {[...s.values]
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((v) => (
                          <option key={v.id} value={v.value}>
                            {v.label ?? v.value}
                          </option>
                        ))}
                    </NativeSelect>
                  </Field>
                ))}
              </div>
            ) : null}

            <SubmitButton>Opslaan</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
