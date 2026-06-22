import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { setCategoryVisibility } from "./actions";

export const dynamic = "force-dynamic";

export default async function VisibilityPage() {
  const user = await getCurrentUser();
  if (!can(user, "settings.manage")) redirect("/dashboard");
  const supabase = await createClient();
  const companyId = user!.companyId!;

  const [{ data: prods }, { data: roles }, { data: rules }] = await Promise.all([
    supabase
      .from("products")
      .select("category:categories(id, name)")
      .eq("company_id", companyId)
      .not("category_id", "is", null),
    supabase.from("roles").select("id, name").eq("company_id", companyId).order("name"),
    supabase
      .from("category_role_visibility")
      .select("category_id, role_id")
      .eq("company_id", companyId),
  ]);

  // Distinct categories used by this company's catalog.
  const catMap = new Map<string, string>();
  for (const p of prods ?? []) {
    const c = p.category as unknown as { id: string; name: string } | null;
    if (c) catMap.set(c.id, c.name);
  }
  const categories = [...catMap.entries()].map(([id, name]) => ({ id, name }));

  const allowed = new Map<string, Set<string>>();
  for (const r of rules ?? []) {
    if (!allowed.has(r.category_id)) allowed.set(r.category_id, new Set());
    allowed.get(r.category_id)!.add(r.role_id);
  }

  const roleList = roles ?? [];

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Catalogus-zichtbaarheid"
        description="Bepaal welke rollen de producten van een categorie zien. Geen selectie = zichtbaar voor iedereen."
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="Nog geen categorieën in je catalogus"
          description="Zodra er producten met een categorie zijn, kun je hier de zichtbaarheid per rol instellen."
        />
      ) : (
        <div className="space-y-4">
          {categories.map((c) => {
            const set = allowed.get(c.id) ?? new Set<string>();
            const restricted = set.size > 0;
            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {c.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      {restricted
                        ? `Zichtbaar voor ${set.size} rol(len)`
                        : "Zichtbaar voor iedereen"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    action={setCategoryVisibility.bind(null, c.id)}
                    className="space-y-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      {roleList.map((r) => (
                        <label
                          key={r.id}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand)]/5"
                        >
                          <input
                            type="checkbox"
                            name="role_ids"
                            value={r.id}
                            defaultChecked={set.has(r.id)}
                            className="h-3.5 w-3.5"
                          />
                          {r.name}
                        </label>
                      ))}
                    </div>
                    <SubmitButton size="sm">Opslaan</SubmitButton>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
