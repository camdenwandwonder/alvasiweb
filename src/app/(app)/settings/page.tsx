import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { ImageUploader } from "@/components/image-uploader";
import { updateBranding } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!can(user, "settings.manage") || !user?.company) redirect("/dashboard");
  const company = user.company;

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Instellingen"
        description="Beheer de huisstijl van je bedrijfsportaal."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Huisstijl</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateBranding} className="space-y-4">
            <Field label="Bedrijfsnaam">
              <Input name="name" defaultValue={company.name} required />
            </Field>
            <Field label="Logo" hint="Laat leeg om het huidige logo te behouden">
              <ImageUploader
                name="logo_url"
                bucket="logos"
                aspect="square"
                defaultUrl={company.logo_url}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primaire kleur">
                <input
                  type="color"
                  name="primary_color"
                  defaultValue={company.primary_color}
                  className="h-9 w-full rounded-md border"
                />
              </Field>
              <Field label="Secundaire kleur">
                <input
                  type="color"
                  name="secondary_color"
                  defaultValue={company.secondary_color}
                  className="h-9 w-full rounded-md border"
                />
              </Field>
            </div>
            <SubmitButton>Opslaan</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
