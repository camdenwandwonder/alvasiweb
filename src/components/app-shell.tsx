import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar, type SidebarNavItem } from "@/components/app-sidebar";

export function AppShell({
  brandName,
  subtitle,
  logoUrl,
  primaryColor,
  secondaryColor,
  items,
  userName,
  userEmail,
  topbarTitle,
  children,
}: {
  brandName: string;
  subtitle: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  items: SidebarNavItem[];
  userName: string;
  userEmail: string;
  topbarTitle?: string;
  children: React.ReactNode;
}) {
  const style = {
    "--brand": primaryColor ?? "#0f172a",
    "--brand-2": secondaryColor ?? "#6366f1",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <AppSidebar
        brandName={brandName}
        subtitle={subtitle}
        logoUrl={logoUrl}
        items={items}
        userName={userName}
        userEmail={userEmail}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <span className="text-sm font-medium">{topbarTitle ?? brandName}</span>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
