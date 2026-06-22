import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatPrice } from "@/lib/format";
import {
  setBudgetMode,
  saveApprovalThreshold,
  createAllowance,
  deleteAllowance,
  createAllotment,
  deleteAllotment,
} from "@/lib/budget-actions";

const PERIOD: Record<string, string> = {
  monthly: "per maand",
  quarterly: "per kwartaal",
  yearly: "per jaar",
  once: "eenmalig",
};

type Role = { id: string; name: string };
type Person = { id: string; full_name: string | null; email: string | null };
type Product = { id: string; name: string };
type Budget = {
  id: string;
  scope: string;
  target_id: string;
  amount: number;
  period: string;
  kind: string;
};
type Allotment = {
  id: string;
  scope: string;
  target_id: string;
  product_id: string;
  max_quantity: number;
  period: string;
};

export function BudgetSettingsPanel({
  companyId,
  mode,
  approvalThreshold,
  roles,
  people,
  products,
  budgets,
  allotments,
}: {
  companyId: string;
  mode: "euro" | "credits" | "quantity";
  approvalThreshold: string;
  roles: Role[];
  people: Person[];
  products: Product[];
  budgets: Budget[];
  allotments: Allotment[];
}) {
  const isCredits = mode === "credits";
  const unit = isCredits ? "credits" : "€";

  const nameFor = (scope: string, targetId: string) =>
    scope === "role"
      ? (roles.find((r) => r.id === targetId)?.name ?? "Onbekende rol")
      : (() => {
          const p = people.find((x) => x.id === targetId);
          return p?.full_name ?? p?.email ?? "Onbekende gebruiker";
        })();
  const productName = (pid: string) =>
    products.find((p) => p.id === pid)?.name ?? "Onbekend product";

  const showAllowances = mode === "euro" || mode === "credits";
  const relevantBudgets = budgets.filter((b) =>
    isCredits ? b.kind === "credits" : b.kind !== "credits",
  );

  return (
    <div className="space-y-6">
      {/* Bestelwijze */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bestelwijze</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Bepaal hoe medewerkers &quot;betalen&quot;: met een budget in euro&apos;s,
            met credits, of met een vast aantal per product.
          </p>
          <form
            action={setBudgetMode.bind(null, companyId)}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="Modus">
              <NativeSelect
                name="budget_mode"
                defaultValue={mode}
                className="w-56"
              >
                <option value="euro">Budget in euro&apos;s (€)</option>
                <option value="credits">Budget in credits</option>
                <option value="quantity">Aantal per product</option>
              </NativeSelect>
            </Field>
            <SubmitButton>Opslaan</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Goedkeuringsregel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goedkeuringsregel</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={saveApprovalThreshold.bind(null, companyId)}
            className="flex flex-wrap items-end gap-3"
          >
            <Field
              label={`Goedkeuring vereist boven bedrag (${unit})`}
              hint="Leeg = geen drempel."
            >
              <Input
                name="approval_over_amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={approvalThreshold}
                className="w-48"
              />
            </Field>
            <SubmitButton>Opslaan</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {showAllowances ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Budgetten ({isCredits ? "credits" : "euro"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relevantBudgets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nog geen budgetten ingesteld.
                </p>
              ) : (
                <ul className="divide-y">
                  {relevantBudgets.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {b.scope === "role" ? "Rol" : "Gebruiker"}
                        </Badge>
                        <span className="text-sm font-medium">
                          {nameFor(b.scope, b.target_id)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {isCredits
                            ? `${b.amount} credits`
                            : formatPrice(b.amount)}{" "}
                          {PERIOD[b.period] ?? b.period}
                        </span>
                      </div>
                      <form action={deleteAllowance.bind(null, companyId, b.id)}>
                        <SubmitButton variant="ghost" size="icon-sm">
                          <Trash2 className="h-4 w-4" />
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            {(["role", "user"] as const).map((scope) => (
              <Card key={scope}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Budget per {scope === "role" ? "rol" : "gebruiker"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    action={createAllowance.bind(
                      null,
                      companyId,
                      scope,
                      isCredits ? "credits" : "euro",
                    )}
                    className="space-y-3"
                  >
                    <Field label={scope === "role" ? "Rol" : "Gebruiker"}>
                      <NativeSelect name="target_id" required defaultValue="">
                        <option value="" disabled>
                          Kies…
                        </option>
                        {(scope === "role" ? roles : people).map((t) => (
                          <option key={t.id} value={t.id}>
                            {scope === "role"
                              ? (t as Role).name
                              : ((t as Person).full_name ??
                                (t as Person).email)}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={`Bedrag (${unit})`}>
                        <Input name="amount" type="number" step="0.01" min="0" required />
                      </Field>
                      <Field label="Periode">
                        <NativeSelect name="period" defaultValue="yearly">
                          <option value="monthly">Per maand</option>
                          <option value="quarterly">Per kwartaal</option>
                          <option value="yearly">Per jaar</option>
                          <option value="once">Eenmalig</option>
                        </NativeSelect>
                      </Field>
                    </div>
                    <SubmitButton className="w-full">Toevoegen</SubmitButton>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aantallen per product</CardTitle>
            </CardHeader>
            <CardContent>
              {allotments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nog geen aantallen ingesteld.
                </p>
              ) : (
                <ul className="divide-y">
                  {allotments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {a.scope === "role" ? "Rol" : "Gebruiker"}
                        </Badge>
                        <span className="text-sm font-medium">
                          {nameFor(a.scope, a.target_id)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {a.max_quantity}× {productName(a.product_id)}{" "}
                          {PERIOD[a.period] ?? a.period}
                        </span>
                      </div>
                      <form action={deleteAllotment.bind(null, companyId, a.id)}>
                        <SubmitButton variant="ghost" size="icon-sm">
                          <Trash2 className="h-4 w-4" />
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            {(["role", "user"] as const).map((scope) => (
              <Card key={scope}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Aantal per {scope === "role" ? "rol" : "gebruiker"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    action={createAllotment.bind(null, companyId, scope)}
                    className="space-y-3"
                  >
                    <Field label={scope === "role" ? "Rol" : "Gebruiker"}>
                      <NativeSelect name="target_id" required defaultValue="">
                        <option value="" disabled>
                          Kies…
                        </option>
                        {(scope === "role" ? roles : people).map((t) => (
                          <option key={t.id} value={t.id}>
                            {scope === "role"
                              ? (t as Role).name
                              : ((t as Person).full_name ?? (t as Person).email)}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label="Product">
                      <NativeSelect name="product_id" required defaultValue="">
                        <option value="" disabled>
                          Kies product…
                        </option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Max. aantal">
                        <Input name="max_quantity" type="number" min="1" required />
                      </Field>
                      <Field label="Periode">
                        <NativeSelect name="period" defaultValue="yearly">
                          <option value="monthly">Per maand</option>
                          <option value="quarterly">Per kwartaal</option>
                          <option value="yearly">Per jaar</option>
                          <option value="once">Eenmalig</option>
                        </NativeSelect>
                      </Field>
                    </div>
                    <SubmitButton className="w-full">Toevoegen</SubmitButton>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
