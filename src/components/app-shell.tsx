import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar, type SidebarNavItem } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CartButton } from "@/components/cart/cart-button";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { HeaderAllowance } from "@/components/cart/header-allowance";

export function AppShell({
  brandName,
  subtitle,
  logoUrl,
  logoIconUrl,
  primaryColor,
  secondaryColor,
  items,
  userName,
  userEmail,
  accountHref,
  showCart = false,
  children,
}: {
  brandName: string;
  subtitle: string;
  logoUrl?: string | null;
  /** Square icon; preferred in the 32px brand slot. */
  logoIconUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  items: SidebarNavItem[];
  userName: string;
  userEmail: string;
  accountHref: string;
  /** Cart button in the header plus its drawer (ordering users only). */
  showCart?: boolean;
  children: React.ReactNode;
}) {
  const brand = primaryColor ?? "#0f172a";
  const brand2 = secondaryColor ?? "#6366f1";
  // Map the company's brand color onto the design-system tokens so that every
  // `bg-primary`, focus ring and sidebar accent across the member/manager
  // portal visibly adopts the company's colors (not just a few accents).
  const style = {
    "--brand": brand,
    "--brand-2": brand2,
    "--primary": brand,
    "--primary-foreground": "var(--brand-foreground)",
    "--ring": brand,
    "--sidebar-primary": brand,
    "--sidebar-ring": brand,
    "--accent": "color-mix(in oklch, var(--brand) 10%, var(--background))",
    "--accent-foreground": brand,
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <CommandPalette items={items} />
      <AppSidebar
        brandName={brandName}
        subtitle={subtitle}
        logoUrl={logoIconUrl || logoUrl}
        items={items}
        userName={userName}
        userEmail={userEmail}
        accountHref={accountHref}
      />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <Breadcrumbs />
          {showCart ? (
            <div className="ml-auto flex items-center gap-2">
              <HeaderAllowance />
              <CartButton />
            </div>
          ) : null}
        </header>
        {showCart ? <CartDrawer /> : null}
        <div className="p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
