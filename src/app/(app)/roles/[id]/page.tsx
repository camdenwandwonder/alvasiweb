import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/primitives";
import { SubmitButton } from "@/components/submit-button";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { updateRole, deleteRole } from "../actions";

export const dynamic = "force-dynamic";

export default async function RoleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!can(user, "roles.manage")) redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: role }, { data: perms }] = await Promise.all([
    supabase.from("roles").select("*").eq("id", id).maybeSingle(),
    supabase.from("role_permissions").select("permission").eq("role_id", id),
  ]);
  if (!role) notFound();
  const granted = new Set((perms ?? []).map((p) => p.permission as string));

  return (
    <div className="max-w-2xl">
      <Link
        href="/roles"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Rollen
      </Link>

      <form action={updateRole.bind(null, id)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rol</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Naam">
              <Input name="name" defaultValue={role.name} required />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requires_order_approval"
                defaultChecked={role.requires_order_approval}
                className="h-4 w-4 rounded border"
              />
              Bestellingen van deze rol moeten worden goedgekeurd
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rechten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-2 text-sm font-medium">{g.title}</p>
                <div className="space-y-1.5">
                  {g.items.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="permissions"
                        value={item.key}
                        defaultChecked={granted.has(item.key)}
                        className="h-4 w-4 rounded border"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Wijzigingen gelden voor gebruikers nadat ze opnieuw inloggen.
            </p>
          </CardContent>
        </Card>

        <SubmitButton>Wijzigingen opslaan</SubmitButton>
      </form>

      {!role.is_system ? (
        <form action={deleteRole.bind(null, id)} className="mt-4 border-t pt-4">
          <SubmitButton variant="destructive" size="sm">
            Rol verwijderen
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
