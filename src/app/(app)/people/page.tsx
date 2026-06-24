import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, NativeSelect } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { NewUserDialog } from "./new-user-dialog";
import { UserSizesDialog, type SizeSet } from "@/components/user-sizes-dialog";
import { updateUserRole, setUserStatus } from "./actions";

export const dynamic = "force-dynamic";

type Person = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  role_id: string | null;
  sizes: Record<string, string> | null;
};

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!can(user, "users.view")) redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: people }, { data: roles }, { data: sizeSets }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, status, role_id, sizes")
        .eq("company_id", user!.companyId!)
        .order("created_at", { ascending: false }),
      supabase
        .from("roles")
        .select("id, name")
        .eq("company_id", user!.companyId!)
        .order("name"),
      supabase
        .from("option_sets")
        .select("id, name, values:option_values(id, value, label, sort_order)")
        .eq("kind", "size")
        .order("name"),
    ]);
  const sizeSetList = (sizeSets ?? []) as unknown as SizeSet[];

  const canManage = can(user, "users.update");
  const roleList = roles ?? [];
  const persons = (people ?? []) as Person[];

  return (
    <div>
      <PageHeader
        title="Personeel"
        description="Beheer gebruikers, rollen en toegang."
        action={
          can(user, "users.invite") ? (
            <NewUserDialog roles={roleList} />
          ) : undefined
        }
      />

      {persons.length === 0 ? (
        <EmptyState icon={Users} title="Nog geen gebruikers" />
      ) : (
        <div className="space-y-2">
          {persons.map((p) => (
            <Card
              key={p.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">
                    {p.full_name ?? p.email}
                  </p>
                  {p.status !== "active" ? (
                    <Badge variant="secondary">Inactief</Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {p.email}
                </p>
              </div>

              {canManage ? (
                <div className="flex items-center gap-2">
                  <UserSizesDialog
                    userId={p.id}
                    userName={p.full_name ?? p.email ?? "Gebruiker"}
                    sizeSets={sizeSetList}
                    current={p.sizes ?? {}}
                  />
                  <form
                    action={updateUserRole.bind(null, p.id)}
                    className="flex items-center gap-2"
                  >
                    <NativeSelect
                      name="role_id"
                      defaultValue={p.role_id ?? ""}
                      className="h-8 w-40"
                    >
                      <option value="" disabled>
                        Rol…
                      </option>
                      {roleList.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <SubmitButton variant="outline" size="sm">
                      Opslaan
                    </SubmitButton>
                  </form>
                  <form
                    action={setUserStatus.bind(
                      null,
                      p.id,
                      p.status === "active" ? "disabled" : "active",
                    )}
                  >
                    <SubmitButton variant="ghost" size="sm">
                      {p.status === "active" ? "Deactiveren" : "Activeren"}
                    </SubmitButton>
                  </form>
                </div>
              ) : (
                <Badge variant="secondary">
                  {roleList.find((r) => r.id === p.role_id)?.name ?? "Geen rol"}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
