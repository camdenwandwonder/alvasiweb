import Image from "next/image";
import { NavLinks, type NavItem } from "@/components/nav";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * App frame with a branded header. `brand` colors are applied as CSS variables
 * so every `var(--brand)` consumer (buttons, active nav, accents) re-themes to
 * the logged-in company.
 */
export function Shell({
  brandName,
  subtitle,
  logoUrl,
  primaryColor,
  secondaryColor,
  nav,
  userLabel,
  children,
}: {
  brandName: string;
  subtitle?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  nav: NavItem[];
  userLabel: string;
  children: React.ReactNode;
}) {
  const style = {
    ["--brand"]: primaryColor ?? "#0f172a",
    ["--brand-2"]: secondaryColor ?? "#6366f1",
  } as React.CSSProperties;

  return (
    <div style={style} className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={brandName}
                width={36}
                height={36}
                className="h-9 w-9 rounded-lg object-contain"
                unoptimized
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-[var(--brand-foreground)]">
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-sm font-semibold">{brandName}</div>
              {subtitle ? (
                <div className="text-xs text-muted">{subtitle}</div>
              ) : null}
            </div>
          </div>

          <div className="hidden md:block">
            <NavLinks items={nav} />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {userLabel}
            </span>
            <SignOutButton />
          </div>
        </div>
        <div className="border-t border-border px-4 py-2 md:hidden">
          <NavLinks items={nav} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
