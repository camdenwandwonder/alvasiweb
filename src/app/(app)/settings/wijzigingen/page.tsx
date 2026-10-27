import { redirect } from "next/navigation";
import { loadSettingsCompany } from "@/lib/settings/load";
import { loadSettingsHistory } from "@/lib/settings/actions";
import { SettingsHistory } from "@/components/settings/settings-history";

export const dynamic = "force-dynamic";

export default async function SettingsHistoryPage() {
  const loaded = await loadSettingsCompany();
  if (!loaded) redirect("/dashboard");
  const res = await loadSettingsHistory(loaded.company.id, 0);
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold">Wijzigingen</h2>
        <p className="mt-1 text-sm text-muted-foreground">Wie de instellingen en leveradressen aanpaste, en wanneer.</p>
      </div>
      <SettingsHistory companyId={loaded.company.id} initial={res.ok ? res.entries : []} more={res.ok ? res.more : false} />
    </div>
  );
}
