import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Field, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { formatPrice } from "@/lib/format";
import { createBudget, deleteBudget, saveApprovalThreshold } from "./actions";

export const dynamic = "force-dynamic";

const PERIOD: Record<string, string> = {
  monthly: "per maand",
  quarterly: "per kwartaal",
  yearly: "per jaar",
  once: "eenmalig",
};

export default async function BudgetsPage() {
  const user = await getCurrentUser();
  if (!can(user, "settings.manage")) redirect("/dashboard");
  const supabase = await createClient();
  const companyId = user!.companyId!;

  const [{ data: roles }, { data: people }, { data: budgets }, { data: company }] =
    await Promise.all([
      supabase.from("roles").select("id, name").eq("company_id", companyId).order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("company_id", companyId)
        .order("full_name"),
      supabase
        .from("budgets")
        .select("id, scope, target_id, amount, period")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("settings").eq("id", companyId).single(),
    ]);

  const roleList = roles ?? [];
  const peopleList = people ?? [];
  const nameFor = (scope: string, targetId: string) =>
    scope === "role"
      ? (roleList.find((r) => r.id === targetId)?.name ?? "Onbekende rol")
      : (() => {
          const p = peopleList.find((x) => x.id === targetId);
          return p?.full_name ?? p?.email ?? "Onbekende gebruiker";
        })();

  const threshold =
    (company?.settings as Record<string, unknown> | null)?.approval_over_amount ??
    "";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Regels & budgetten"
        description="Bepaal wanneer goedkeuring nodig is en stel bestedingslimieten in."
      />

      {/* Approval rule */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Goedkeuringsregel</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={saveApprovalThreshold}
            className="flex flex-wrap items-end gap-3"
          >
            <Field
              label="Goedkeuring vereist boven bedrag (€)"
              hint="Leeg = geen drempel. Naast de rol-instelling."
            >
              <Input
                name="approval_over_amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={String(threshold)}
                placeholder="bijv. 100"
                className="w-48"
              />
            </Field>
            <SubmitButton>Opslaan</SubmitButton>
          </form>
        </CardContent>
      </Card>

      {/* Existing budgets */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Budgetten</CardTitle>
        </CardHeader>
        <CardContent>
          {!budgets || budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen budgetten ingesteld.
            </p>
          ) : (
            <ul className="divide-y">
              {budgets.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {b.scope === "role" ? "Rol" : "Gebruiker"}
                    </Badge>
                    <span className="text-sm font-medium">
                      {nameFor(b.scope, b.target_id)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(b.amount)} {PERIOD[b.period] ?? b.period}
                    </span>
                  </div>
                  <form action={deleteBudget.bind(null, b.id)}>
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
        {/* Budget per role */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget per rol</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createBudget.bind(null, "role")} className="space-y-3">
              <Field label="Rol">
                <NativeSelect name="target_id" required defaultValue="">
                  <option value="" disabled>
                    Kies rol…
                  </option>
                  {roleList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bedrag (€)">
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

        {/* Budget per user */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget per gebruiker</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createBudget.bind(null, "user")} className="space-y-3">
              <Field label="Gebruiker">
                <NativeSelect name="target_id" required defaultValue="">
                  <option value="" disabled>
                    Kies gebruiker…
                  </option>
                  {peopleList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bedrag (€)">
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
      </div>
    </div>
  );
}
