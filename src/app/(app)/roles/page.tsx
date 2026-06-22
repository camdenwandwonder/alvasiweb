import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/primitives";
import { NewRoleDialog } from "./new-role-dialog";

export const dynamic = "force-dynamic";

type Role = {
  id: string;
  name: string;
  is_system: boolean;
  requires_order_approval: boolean;
  perms: { count: number }[];
};

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!can(user, "roles.manage")) redirect("/dashboard");
  const supabase = await createClient();

  const { data } = await supabase
    .from("roles")
    .select(
      "id, name, is_system, requires_order_approval, perms:role_permissions(count)",
    )
    .eq("company_id", user!.companyId!)
    .order("name");

  const roles = (data ?? []) as unknown as Role[];

  return (
    <div>
      <PageHeader
        title="Rollen & rechten"
        description="Maak rollen en bepaal per rol wat gebruikers mogen."
        action={<NewRoleDialog />}
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Nog geen rollen"
          action={<NewRoleDialog />}
        />
      ) : (
        <div className="space-y-2">
          {roles.map((r) => (
            <Link key={r.id} href={`/roles/${r.id}`} className="block">
              <div className="flex items-center gap-4 rounded-xl border bg-card p-4 transition hover:border-foreground/20">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{r.name}</p>
                    {r.is_system ? (
                      <Badge variant="secondary">Standaard</Badge>
                    ) : null}
                    {r.requires_order_approval ? (
                      <Badge variant="outline">Goedkeuring vereist</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.perms?.[0]?.count ?? 0} rechten
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
