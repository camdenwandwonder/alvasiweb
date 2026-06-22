"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/primitives";
import { ImageUploader } from "@/components/image-uploader";
import { SubmitButton } from "@/components/submit-button";
import { BrandPreview } from "@/components/brand-preview";

export function CompanyBrandingForm({
  action,
  defaultName = "",
  defaultLogoUrl = null,
  defaultPrimary = "#0f172a",
  defaultSecondary = "#6366f1",
  submitLabel = "Opslaan",
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultName?: string;
  defaultLogoUrl?: string | null;
  defaultPrimary?: string;
  defaultSecondary?: string;
  submitLabel?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [logoUrl, setLogoUrl] = useState<string | null>(defaultLogoUrl);
  const [primary, setPrimary] = useState(defaultPrimary);
  const [secondary, setSecondary] = useState(defaultSecondary);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form action={action} className="space-y-4">
        <Field label="Bedrijfsnaam">
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Acme Workwear"
          />
        </Field>
        <Field label="Logo" hint="PNG/JPG, vierkant werkt het mooist">
          <ImageUploader
            name="logo_url"
            bucket="logos"
            aspect="square"
            defaultUrl={defaultLogoUrl}
            onChange={(u) => setLogoUrl(u || null)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primaire kleur">
            <input
              type="color"
              name="primary_color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-9 w-full rounded-md border"
            />
          </Field>
          <Field label="Secundaire kleur">
            <input
              type="color"
              name="secondary_color"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              className="h-9 w-full rounded-md border"
            />
          </Field>
        </div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </form>

      <div>
        <p className="mb-2 text-sm font-medium">Voorbeeld</p>
        <BrandPreview
          name={name}
          primary={primary}
          secondary={secondary}
          logoUrl={logoUrl}
        />
      </div>
    </div>
  );
}
