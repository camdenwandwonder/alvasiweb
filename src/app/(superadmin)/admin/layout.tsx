import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { AppShell } from "@/components/app-shell";
import type { SidebarNavItem } from "@/components/app-sidebar";

export const dynamic = "force-dynamic";

const NAV: SidebarNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/companies", label: "Companies", icon: "companies" },
  { href: "/admin/config", label: "Configuration", icon: "settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperadmin) redirect("/dashboard");

  return (
    <AppShell
      brandName="Alvasi"
      subtitle="Superadmin"
      items={NAV}
      userName={user.fullName ?? "Alvasi Admin"}
      userEmail={user.email ?? ""}
      topbarTitle="Alvasi Admin"
    >
      {children}
    </AppShell>
  );
}
