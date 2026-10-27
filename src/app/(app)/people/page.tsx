import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { PageHeader } from "@/components/primitives";
import type { SizeSet } from "@/components/user-sizes-dialog";
import { UsersManager, type ManagedUser } from "@/components/users-manager";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "users.view")) redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: people }, { data: roles }, { data: sizeSets }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, status, role_id, sizes")
        .eq("company_id", user.companyId)
        .order("full_name"),
      supabase
        .from("roles")
        .select("id, name")
        .eq("company_id", user.companyId)
        .order("name"),
      supabase
        .from("option_sets")
        .select("id, name, values:option_values(id, value, label, sort_order)")
        .eq("kind", "size")
        .order("name"),
    ]);

  return (
    <div>
      <PageHeader
        title="Personeel"
        description="Beheer gebruikers, rollen, standaardmaten en toegang."
      />
      <UsersManager
        companyId={user.companyId}
        users={(people ?? []).map(
          (p): ManagedUser => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            status: p.status,
            role_id: p.role_id,
            sizes: (p.sizes as Record<string, string> | null) ?? null,
          }),
        )}
        roles={roles ?? []}
        sizeSets={(sizeSets ?? []) as unknown as SizeSet[]}
        currentUserId={user.id}
        canInvite={can(user, "users.invite")}
        canUpdate={can(user, "users.update")}
        canRemove={can(user, "users.remove")}
      />
    </div>
  );
}
