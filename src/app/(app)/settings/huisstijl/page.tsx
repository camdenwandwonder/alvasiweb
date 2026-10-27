import { redirect } from "next/navigation";
import { loadSettingsCompany } from "@/lib/settings/load";
import { BrandingEditor } from "@/components/settings/branding-editor";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const loaded = await loadSettingsCompany();
  if (!loaded) redirect("/dashboard");
  const { company } = loaded;
  return (
    <BrandingEditor
      companyId={company.id}
      companyName={company.short_name || company.name}
      initial={{
        logo_url: company.logo_url ?? "",
        logo_icon_url: company.logo_icon_url ?? "",
        primary_color: company.primary_color ?? "#0f172a",
        secondary_color: company.secondary_color ?? "#6366f1",
      }}
    />
  );
}
