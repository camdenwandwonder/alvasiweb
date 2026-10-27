import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth/user";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.company || !can(user, "settings.manage")) redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Instellingen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hoe het portaal van {user.company.name} eruitziet en werkt.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <aside>
          <SettingsNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
