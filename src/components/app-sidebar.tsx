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
  LogOut,
  ChevronsUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  reports: BarChart3,
  production: Boxes,
  settings: Settings,
};

export type SidebarNavItem = { href: string; label: string; icon: string };

export function AppSidebar({
  brandName,
  subtitle,
  logoUrl,
  items,
  userName,
  userEmail,
}: {
  brandName: string;
  subtitle: string;
  logoUrl?: string | null;
  items: SidebarNavItem[];
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                      className="data-[active=true]:bg-[var(--brand)] data-[active=true]:text-[var(--brand-foreground)]"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left outline-none hover:bg-sidebar-accent data-[popup-open]:bg-sidebar-accent">
                <Avatar className="h-8 w-8 rounded-md">
                  <AvatarFallback className="rounded-md bg-[var(--brand)] text-xs text-[var(--brand-foreground)]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-medium">
                    {userName || userEmail}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                className="w-56"
              >
                <DropdownMenuLabel className="truncate">
                  {userEmail}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Uitloggen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
