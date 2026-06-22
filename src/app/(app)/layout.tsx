import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth/user";
import { AppShell } from "@/components/app-shell";
import { CartProvider } from "@/components/cart";
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
          <h1 className="text-lg font-semibold">Geen bedrijf gekoppeld</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Je account is nog niet aan een bedrijf gekoppeld. Neem contact op met
            je beheerder.
          </p>
        </div>
      </div>
    );
  }

  const items: SidebarNavItem[] = [
    { href: "/dashboard", label: "Start", icon: "dashboard" },
  ];
  if (can(user, "products.view"))
    items.push({ href: "/products", label: "Winkel", icon: "shop" });
  if (can(user, "orders.create"))
    items.push({ href: "/cart", label: "Winkelwagen", icon: "cart" });
  if (can(user, "orders.view_own") || can(user, "orders.view_all"))
    items.push({ href: "/orders", label: "Bestellingen", icon: "orders" });
  if (can(user, "orders.approve"))
    items.push({ href: "/approvals", label: "Goedkeuringen", icon: "approvals" });
  if (can(user, "users.view"))
    items.push({ href: "/people", label: "Personeel", icon: "people" });
  if (can(user, "roles.manage"))
    items.push({ href: "/roles", label: "Rollen", icon: "roles" });
  if (can(user, "settings.manage"))
    items.push({ href: "/budgets", label: "Regels & budget", icon: "rules" });

  return (
    <CartProvider companyId={user.company.id}>
      <AppShell
        brandName={user.company.name}
        subtitle="Bestelportaal"
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
    </CartProvider>
  );
}
