import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth/user";
import { AppShell } from "@/components/app-shell";
import type { SidebarNavItem } from "@/components/app-sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuperadmin) redirect("/admin");

  if (!user.company) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">No company assigned</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account isn&apos;t linked to a company yet. Please contact your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  const items: SidebarNavItem[] = [
    { href: "/dashboard", label: "Home", icon: "dashboard" },
  ];
  if (can(user, "products.view"))
    items.push({ href: "/products", label: "Shop", icon: "shop" });
  if (can(user, "orders.view_own") || can(user, "orders.view_all"))
    items.push({ href: "/orders", label: "Orders", icon: "orders" });

  return (
    <AppShell
      brandName={user.company.name}
      subtitle="Ordering portal"
      logoUrl={user.company.logo_url}
      primaryColor={user.company.primary_color}
      secondaryColor={user.company.secondary_color}
      items={items}
      userName={user.fullName ?? ""}
      userEmail={user.email ?? ""}
      topbarTitle={user.company.name}
    >
      {children}
    </AppShell>
  );
}
