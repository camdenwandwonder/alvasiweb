import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyBrandingForm } from "@/components/company-branding-form";
import { createCompany } from "../actions";

export const dynamic = "force-dynamic";

export default function NewCompanyPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Bedrijven
      </Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Nieuw bedrijf
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Voeg een klantbedrijf toe en stel de huisstijl in.
      </p>

      <Card>
        <CardContent className="pt-6">
          <CompanyBrandingForm
            action={createCompany}
            submitLabel="Bedrijf aanmaken"
          />
        </CardContent>
      </Card>
    </div>
  );
}
