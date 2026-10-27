import { redirect } from "next/navigation";
import { readOrderPrefs } from "@/lib/company-prefs";
import { loadSettingsCompany } from "@/lib/settings/load";
import { AlvasiContactBlock, CompanyDetailsBlock, OrderPrefsBlock } from "@/components/settings/general-settings";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  const loaded = await loadSettingsCompany();
  if (!loaded) redirect("/dashboard");
  const { company } = loaded;
  return (
    <div className="space-y-8">
      <CompanyDetailsBlock company={company} />
      <AlvasiContactBlock company={company} editable={false} />
      <OrderPrefsBlock companyId={company.id} prefs={readOrderPrefs(company.settings as Record<string, unknown>)} />
    </div>
  );
}
