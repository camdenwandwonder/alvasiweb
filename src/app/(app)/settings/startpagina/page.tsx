import { redirect } from "next/navigation";
import { loadSettingsCompany, loadStartImages } from "@/lib/settings/load";
import { StartPageEditor } from "@/components/settings/start-page-editor";

export const dynamic = "force-dynamic";

export default async function StartPageSettingsPage() {
  const loaded = await loadSettingsCompany();
  if (!loaded) redirect("/dashboard");
  const { company } = loaded;
  const images = await loadStartImages(company.id);
  return (
    <StartPageEditor
      companyId={company.id}
      companyName={company.name}
      images={images}
      initial={{
        welcome_text: company.welcome_text ?? "",
        announcement_text: company.announcement_text ?? "",
        announcement_from: company.announcement_from ?? "",
        announcement_until: company.announcement_until ?? "",
      }}
    />
  );
}
