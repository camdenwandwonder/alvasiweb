import { redirect } from "next/navigation";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CartProvider } from "@/components/cart";
import type { SidebarNavItem } from "@/components/app-sidebar";
import { RecipientBar } from "@/components/recipient-bar";
import { getOrderRecipient } from "@/lib/shop/recipient";
import { displayFor, readOrderingSettings } from "@/lib/ordering";

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

  const [recipient, { data: companyRow }] = await Promise.all([
    getOrderRecipient(user),
    createAdminClient().from("companies").select("settings, short_name, logo_icon_url").eq("id", user.company.id).maybeSingle(),
  ]);
  const ordering = readOrderingSettings((companyRow?.settings as Record<string, unknown>) ?? {});
  const canOrder = can(user, "orders.create");

  // Waiting approvals (orders + budget requests) for the menu badge.
  let waiting = 0;
  if (can(user, "orders.approve")) {
    const admin = createAdminClient();
    const [{ count: orders }, { count: requests }] = await Promise.all([
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", user.company.id)
        .eq("status", "pending_approval"),
      admin
        .from("budget_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", user.company.id)
        .eq("status", "pending"),
    ]);
    waiting = (orders ?? 0) + (requests ?? 0);
  }

  const order = "Bestellen";
  const manage = "Beheer";
  const items: SidebarNavItem[] = [];
  // Plain members have no Start page — the Winkel is their landing page.
  if (!isMember(user))
    items.push({ href: "/dashboard", label: "Start", icon: "dashboard", group: order });
  if (can(user, "products.view"))
    items.push({ href: "/products", label: "Winkel", icon: "shop", group: order });
  if (can(user, "orders.create"))
    items.push({ href: "/cart", label: "Winkelwagen", icon: "cart", group: order });
  if (can(user, "orders.view_own") || can(user, "orders.view_all"))
    items.push({ href: "/orders", label: "Bestellingen", icon: "orders", group: order });
  if (can(user, "orders.approve"))
    items.push({
      href: "/approvals",
      label: "Goedkeuringen",
      icon: "approvals",
      group: manage,
      badge: waiting,
    });
  if (can(user, "users.view") || can(user, "roles.manage") || can(user, "settings.manage"))
    items.push({ href: "/personeel", label: "Personeel", icon: "people", group: manage });
  if (can(user, "settings.manage"))
    items.push({ href: "/settings", label: "Instellingen", icon: "settings", group: manage });
  items.push({ href: "/profile", label: "Mijn profiel", icon: "profile", group: "Account" });

  return (
    <CartProvider
      companyId={user.company.id}
      recipientId={recipient?.id ?? null}
      forName={recipient ? recipient.name.split(" ")[0]! : null}
      display={displayFor(ordering, isMember(user) ? "member" : "manager")}
      payment={ordering.payment}
      sync={canOrder}
    >
      <AppShell
        brandName={(companyRow?.short_name as string | null) || user.company.name}
        subtitle="Bestelportaal"
        logoUrl={user.company.logo_url}
        logoIconUrl={(companyRow?.logo_icon_url as string | null) ?? null}
        primaryColor={user.company.primary_color}
        secondaryColor={user.company.secondary_color}
        items={items}
        userName={user.fullName ?? ""}
        userEmail={user.email ?? ""}
        accountHref="/profile"
        showCart={canOrder}
      >
        {recipient ? <RecipientBar name={recipient.name} roleName={recipient.roleName} /> : null}
        {children}
      </AppShell>
    </CartProvider>
  );
}
