import { MapPin, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import {
  createAddress,
  setDefaultAddress,
  deleteAddress,
  type CompanyAddress,
} from "@/lib/address-actions";

export function CompanyAddressesPanel({
  companyId,
  addresses,
}: {
  companyId: string;
  addresses: CompanyAddress[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leveradressen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Stel vaste leveradressen in en kies welke standaard is. Medewerkers
          kiezen bij het afrekenen een adres. Een handmatig (afwijkend) adres
          moet altijd worden goedgekeurd.
        </p>

        {addresses.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.label}</span>
                      {a.is_default ? (
                        <Badge className="bg-[var(--brand)] text-[var(--brand-foreground)]">
                          Standaard
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {[
                        a.recipient,
                        a.street,
                        [a.postal_code, a.city].filter(Boolean).join(" "),
                        a.country,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Geen adresgegevens"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!a.is_default ? (
                    <form action={setDefaultAddress.bind(null, companyId, a.id)}>
                      <SubmitButton variant="ghost" size="sm">
                        <Star className="h-3.5 w-3.5" /> Standaard
                      </SubmitButton>
                    </form>
                  ) : null}
                  <form action={deleteAddress.bind(null, companyId, a.id)}>
                    <SubmitButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nog geen leveradressen. Voeg er hieronder een toe.
          </p>
        )}

        {/* Add */}
        <form
          action={createAddress.bind(null, companyId)}
          className="space-y-3 border-t pt-5"
        >
          <p className="text-sm font-medium">Nieuw leveradres</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Naam / label">
              <Input name="label" required placeholder="Bijv. Hoofdkantoor" />
            </Field>
            <Field label="Ontvanger (optioneel)">
              <Input name="recipient" placeholder="t.a.v." />
            </Field>
          </div>
          <Field label="Adres">
            <Input name="street" placeholder="Straat en nummer" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Postcode">
              <Input name="postal_code" />
            </Field>
            <Field label="Plaats">
              <Input name="city" />
            </Field>
            <Field label="Land">
              <Input name="country" placeholder="Nederland" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_default"
              className="h-4 w-4 rounded border-input"
            />
            Als standaardadres instellen
          </label>
          <SubmitButton>Adres toevoegen</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
