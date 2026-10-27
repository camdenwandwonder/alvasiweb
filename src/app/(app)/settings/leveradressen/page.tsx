import { redirect } from "next/navigation";
import { loadAddresses, loadSettingsCompany } from "@/lib/settings/load";
import { AddressesManager } from "@/components/settings/addresses-manager";
import type { CompanyAddress } from "@/lib/address-actions";

export const dynamic = "force-dynamic";

export default async function AddressSettingsPage() {
  const loaded = await loadSettingsCompany();
  if (!loaded) redirect("/dashboard");
  const addresses = (await loadAddresses(loaded.company.id)) as CompanyAddress[];
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold">Leveradressen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Waar bestellingen naartoe kunnen. Medewerkers kiezen er één bij het afronden; het standaardadres staat
          voorgeselecteerd.
        </p>
      </div>
      <AddressesManager companyId={loaded.company.id} addresses={addresses} />
    </div>
  );
}
