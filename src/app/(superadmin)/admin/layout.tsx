import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { AppShell } from "@/components/app-shell";
import type { SidebarNavItem } from "@/components/app-sidebar";

export const dynamic = "force-dynamic";

const NAV: SidebarNavItem[] = [
  { href: "/admin", label: "Overzicht", icon: "dashboard" },
  { href: "/admin/companies", label: "Bedrijven", icon: "companies" },
  { href: "/admin/catalog", label: "Catalogus", icon: "catalog" },
  { href: "/admin/orders", label: "Productie", icon: "production" },
  { href: "/admin/reports", label: "Rapportages", icon: "reports" },
  { href: "/admin/config", label: "Configuratie", icon: "settings" },
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
      subtitle="Beheer"
      items={NAV}
      userName={user.fullName ?? "Alvasi Beheer"}
      userEmail={user.email ?? ""}
      accountHref="/admin/account"
      topbarTitle="Alvasi Beheer"
    >
      {children}
    </AppShell>
  );
}
