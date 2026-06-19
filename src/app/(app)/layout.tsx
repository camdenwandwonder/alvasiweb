import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth/user";
import { Shell } from "@/components/shell";
import type { NavItem } from "@/components/nav";

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
          <p className="mt-1 text-sm text-muted">
            Your account isn&apos;t linked to a company yet. Please contact your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  const nav: NavItem[] = [{ href: "/dashboard", label: "Home" }];
  if (can(user, "products.view"))
    nav.push({ href: "/products", label: "Products" });
  if (can(user, "orders.view_own") || can(user, "orders.view_all"))
    nav.push({ href: "/orders", label: "Orders" });

  return (
    <Shell
      brandName={user.company.name}
      subtitle="Ordering portal"
      logoUrl={user.company.logo_url}
      primaryColor={user.company.primary_color}
      secondaryColor={user.company.secondary_color}
      nav={nav}
      userLabel={`${user.fullName ?? user.email ?? ""}${
        user.roleName ? ` · ${user.roleName}` : ""
      }`}
    >
      {children}
    </Shell>
  );
}
