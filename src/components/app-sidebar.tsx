"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  Store,
  ClipboardList,
  Users,
  User,
  Shield,
  Settings,
  Boxes,
  CheckSquare,
  SlidersHorizontal,
  BarChart3,
  Eye,
  Plug,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCartCount } from "@/components/cart";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  companies: Building2,
  catalog: Package,
  shop: Store,
  cart: ShoppingCart,
  orders: ClipboardList,
  approvals: CheckSquare,
  people: Users,
  profile: User,
  roles: Shield,
  rules: SlidersHorizontal,
  visibility: Eye,
  reports: BarChart3,
  production: Boxes,
  integrations: Plug,
  settings: Settings,
};

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  /** Section heading the item is listed under. */
  group?: string;
  /** Count shown next to the item (e.g. waiting approvals). */
  badge?: number;
};

/** Keeps the order of first appearance for groups and items. */
function groupItems(items: SidebarNavItem[]) {
  const out: { group?: string; items: SidebarNavItem[] }[] = [];
  for (const item of items) {
    const last = out.find((g) => g.group === item.group);
    if (last) last.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out;
}

export function AppSidebar({
  brandName,
  subtitle,
  logoUrl,
  items,
  userName,
  userEmail,
  accountHref,
}: {
  brandName: string;
  subtitle: string;
  logoUrl?: string | null;
  items: SidebarNavItem[];
  userName: string;
  userEmail: string;
  accountHref: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const cartCount = useCartCount();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (userName || userEmail || "?")
    .split(" ")
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={brandName}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 shrink-0 rounded-md object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-sm font-bold text-[var(--brand-foreground)]">
              {brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">{brandName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groupItems(items).map(({ group, items: groupList }) => (
          <SidebarGroup key={group ?? "_"} className="py-1">
            {group ? (
              <SidebarGroupLabel className="text-[11px] font-semibold tracking-wide uppercase">
                {group}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {groupList.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  const count =
                    item.icon === "cart" ? (cartCount ?? 0) : (item.badge ?? 0);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        className="h-10 gap-3 px-3 text-[15px] data-[active=true]:bg-[var(--brand)] data-[active=true]:text-[var(--brand-foreground)] [&_svg]:size-5 group-data-[collapsible=icon]:[&_svg]:size-4"
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {count > 0 ? (
                        <SidebarMenuBadge className="top-2.5 right-2 min-w-6 rounded-full bg-[var(--brand)] px-1.5 text-[var(--brand-foreground)] peer-data-active/menu-button:bg-[var(--brand-foreground)] peer-data-active/menu-button:text-[var(--brand)]">
                          {count > 99 ? "99+" : count}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-1">
          <Link
            href={accountHref}
            className="flex flex-1 items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none hover:bg-sidebar-accent"
          >
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarFallback className="rounded-md bg-[var(--brand)] text-xs text-[var(--brand-foreground)]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">
                {userName || userEmail}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
            </div>
          </Link>
          <button
            onClick={signOut}
            title="Uitloggen"
            aria-label="Uitloggen"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
