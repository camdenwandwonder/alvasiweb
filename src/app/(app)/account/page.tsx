import Link from "next/link";
import { redirect } from "next/navigation";
import { User, Settings } from "lucide-react";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-xl">
      <PageHeader title="Account" description="Je accountgegevens en toegang." />

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
            <span className="text-muted-foreground">Bedrijf</span>
            <span className="font-medium">{user.company?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rol</span>
            <span className="font-medium">{user.roleName ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/profile" className={buttonVariants({ variant: "outline" })}>
          <User className="h-4 w-4" /> Mijn profiel
        </Link>
        {can(user, "settings.manage") ? (
          <Link
            href="/settings"
            className={buttonVariants({ variant: "outline" })}
          >
            <Settings className="h-4 w-4" /> Bedrijfsinstellingen
          </Link>
        ) : null}
        <LogoutButton />
      </div>
    </div>
  );
}
