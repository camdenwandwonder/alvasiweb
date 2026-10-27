import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ClipboardList, ShieldCheck, Store } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { getAllowanceFor } from "@/lib/allowance";
import { approverNames } from "@/lib/cart/evaluate";
import { displayFor, formatAmount, PERIOD_LABEL, type Period } from "@/lib/ordering";
import { PERMISSION_GROUPS, summarizePermissions } from "@/lib/permissions";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";
import {
  PasswordButton,
  PersonalRow,
  RequestBudgetButton,
  SignOutEverywhereButton,
  SizesBlock,
  type ProfileSizeSet,
} from "./profile-blocks";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "maten", label: "Mijn maten" },
  { id: "budget", label: "Budget en rechten" },
  { id: "gegevens", label: "Persoonlijke gegevens" },
  { id: "beveiliging", label: "Beveiliging" },
];

const PERIOD_SHORT: Record<string, string> = {
  monthly: "deze maand",
  quarterly: "dit kwartaal",
  yearly: "dit jaar",
  once: "in totaal",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: profile }, { data: sizeSets }, { data: charts }, allowanceData, approvers] =
    await Promise.all([
      supabase.from("profiles").select("full_name, phone, sizes").eq("id", user.id).maybeSingle(),
      supabase
        .from("option_sets")
        .select("id, name, values:option_values(value, label, sort_order)")
        .eq("kind", "size")
        .order("name"),
      supabase.from("size_charts").select("option_set_id, columns, rows, note").not("option_set_id", "is", null),
      user.companyId ? getAllowanceFor(user.companyId, user.id) : Promise.resolve(null),
      user.companyId ? approverNames(user.companyId, user.id) : Promise.resolve([] as string[]),
    ]);

  const chartBySet = new Map(
    (charts ?? []).map((c) => [
      c.option_set_id as string,
      {
        columns: (c.columns as string[] | null) ?? [],
        rows: Array.isArray(c.rows) ? (c.rows as { size: string; values: string[] }[]) : [],
        note: (c.note as string | null) ?? null,
      },
    ]),
  );
  const sets: ProfileSizeSet[] = (
    (sizeSets ?? []) as { id: string; name: string; values: { value: string; label: string | null; sort_order: number }[] }[]
  ).map((s) => ({
    id: s.id,
    name: s.name,
    values: [...(s.values ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ value: v.value, label: v.label ?? v.value })),
    chart: chartBySet.get(s.id) ?? null,
  }));

  const settings = allowanceData?.settings ?? null;
  const allowance = allowanceData?.allowance ?? null;
  const display = settings ? displayFor(settings, isMember(user) ? "member" : "manager") : "euro";
  const capIds = Object.keys(allowance?.caps ?? {});
  const { data: capProducts } = capIds.length
    ? await admin.from("products").select("id, name").in("id", capIds)
    : { data: [] as { id: string; name: string }[] };
  const productName = new Map((capProducts ?? []).map((p) => [p.id as string, p.name as string]));

  const name: string = (profile?.full_name as string | null) || user.fullName || user.email || "Jij";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  const granted = PERMISSION_GROUPS.flatMap((g) => g.items).filter((i) =>
    user.isSuperadmin ? true : user.permissions.includes(i.key),
  );
  const budget = allowance?.budget ?? null;
  const pct = budget && budget.total > 0 ? Math.min(1, Math.max(0, budget.remaining / budget.total)) : 0;
  const hidden = display === "hidden";
  const unit = settings?.payment === "credits" ? "credits" : "euro";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-4 rounded-xl border bg-card p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-lg font-semibold text-[var(--brand-foreground)]">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {[user.roleName, user.company?.name, user.email].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Onderdelen van je profiel" className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          <Block id="maten" title="Mijn maten" description="Je maat staat in de winkel vooraf klaar. Een klik slaat direct op.">
            <SizesBlock sets={sets} initial={(profile?.sizes as Record<string, string> | null) ?? {}} />
          </Block>

          {allowance && settings ? (
            <Block id="budget" title="Mijn budget en rechten" description="Wat je mag bestellen en wie meekijkt.">
              <div className="space-y-5">
                {budget ? (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">
                        {settings.payment === "credits" ? "Credits" : "Budget"}{" "}
                        {(PERIOD_LABEL[budget.period as Period] ?? "").toLowerCase()}
                      </p>
                      {hidden ? (
                        <p className="text-sm text-muted-foreground">
                          {budget.remaining > 0 ? "Je hebt nog ruimte in je budget" : "Je budget is op"}
                        </p>
                      ) : (
                        <p className="text-sm">
                          <span className="font-semibold">{formatAmount(Math.max(0, budget.remaining), settings.payment)}</span>
                          <span className="text-muted-foreground"> van {formatAmount(budget.total, settings.payment)} over</span>
                        </p>
                      )}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div
                        className={cn("h-full rounded-full", pct <= 0.15 ? "bg-amber-500" : "bg-[var(--brand)]")}
                        style={{ width: `${Math.round(pct * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {budget.resetsAt
                        ? `Vernieuwt op ${new Date(budget.resetsAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}.`
                        : "Eenmalig budget."}
                      {!hidden && budget.extra > 0
                        ? ` Inclusief ${formatAmount(budget.extra, settings.payment)} extra budget.`
                        : ""}
                    </p>
                  </div>
                ) : settings.payment !== "none" ? (
                  <p className="text-sm text-muted-foreground">Er is voor jou geen budget ingesteld.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Je bestelt zonder budget.</p>
                )}

                {capIds.length ? (
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Maximum per product</p>
                    <ul className="grid gap-1 text-sm sm:grid-cols-2">
                      {capIds.map((id) => {
                        const c = allowance.caps[id]!;
                        return (
                          <li key={id} className="flex justify-between gap-3 rounded-md bg-muted/40 px-3 py-1.5">
                            <span className="truncate">{productName.get(id) ?? "Product"}</span>
                            <span className={cn("shrink-0", c.remaining <= 0 ? "text-amber-700" : "text-muted-foreground")}>
                              nog {Math.max(0, c.remaining)} van {c.max} {PERIOD_SHORT[c.period] ?? ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Goedkeuring
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {approvers.length
                        ? `Aanvragen worden beoordeeld door ${approvers.join(", ")}.`
                        : "Er is nog niemand die aanvragen kan goedkeuren."}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Wat je functie{user.roleName ? ` (${user.roleName})` : ""} mag</p>
                    <p className="mb-1 text-sm text-muted-foreground">{summarizePermissions(user.permissions)}</p>
                    <ul className="space-y-0.5 text-sm">
                      {granted.map((g) => (
                        <li key={g.key} className="flex items-start gap-1.5">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" /> {g.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {can(user, "orders.order_for_others") ? (
                  <p className="text-sm">
                    Je mag bestellen namens medewerkers — kies dat in de{" "}
                    <Link href="/products" className="font-medium text-[var(--brand)] hover:underline">
                      winkel
                    </Link>
                    .
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {budget && can(user, "orders.create") ? <RequestBudgetButton unit={unit} /> : null}
                  <Link href="/orders" className={buttonVariants({ variant: "outline" })}>
                    <ClipboardList className="h-4 w-4" /> Mijn bestellingen
                  </Link>
                  <Link href="/products" className={buttonVariants({ variant: "ghost" })}>
                    <Store className="h-4 w-4" /> Naar de winkel
                  </Link>
                </div>
              </div>
            </Block>
          ) : null}

          <Block id="gegevens" title="Persoonlijke gegevens">
            <dl className="divide-y">
              <PersonalRow label="Naam" field="full_name" value={profile?.full_name ?? null} placeholder="Voor- en achternaam" />
              <PersonalRow label="Telefoon" field="phone" value={profile?.phone ?? null} placeholder="06 12345678" inputMode="tel" />
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start">
                <dt className="w-40 shrink-0 text-sm text-muted-foreground">E-mail</dt>
                <dd className="flex-1 text-sm">
                  {user.email}
                  <span className="block text-xs text-muted-foreground">
                    Je e-mailadres is ook je inlognaam; wijzigen gaat via je beheerder.
                  </span>
                </dd>
              </div>
            </dl>
          </Block>

          <Block id="beveiliging" title="Beveiliging" description="Wijzig je wachtwoord of log uit op al je apparaten.">
            <div className="flex flex-wrap gap-2">
              <PasswordButton />
              <SignOutEverywhereButton />
              <LogoutButton />
            </div>
          </Block>
        </div>
      </div>
    </div>
  );
}

function Block({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 mb-4 text-sm text-muted-foreground">{description}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}
