import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/primitives";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-xl">
      <PageHeader title="Account" description="Je Alvasi-beheeraccount." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Gegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Naam</span>
            <span className="font-medium">{user.fullName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rol</span>
            <span className="font-medium">Superadmin</span>
          </div>
        </CardContent>
      </Card>

      <LogoutButton />
    </div>
  );
}
