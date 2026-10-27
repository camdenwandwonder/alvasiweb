"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, History, Home, MapPin, Palette, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { slug: "algemeen", label: "Algemeen", icon: Building2 },
  { slug: "huisstijl", label: "Huisstijl", icon: Palette },
  { slug: "startpagina", label: "Startpagina", icon: Home },
  { slug: "leveradressen", label: "Leveradressen", icon: MapPin },
  { slug: "wijzigingen", label: "Wijzigingen", icon: History },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = SETTINGS_SECTIONS.find((s) => pathname.startsWith(`/settings/${s.slug}`))?.slug ?? "algemeen";

  return (
    <>
      {/* Mobiel: keuzelijst */}
      <select
        value={active}
        onChange={(e) => router.push(`/settings/${e.target.value}`)}
        aria-label="Onderdeel van de instellingen"
        className="mb-4 h-10 w-full rounded-lg border bg-background px-3 text-sm md:hidden"
      >
        {SETTINGS_SECTIONS.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.label}
          </option>
        ))}
      </select>

      <nav aria-label="Instellingen" className="hidden md:block">
        <ul className="space-y-0.5">
          {SETTINGS_SECTIONS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/settings/${s.slug}`}
                aria-current={active === s.slug ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  active === s.slug
                    ? "bg-[var(--brand)]/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/personeel"
          className="mt-6 block rounded-xl border bg-card p-3 text-sm transition hover:border-[var(--brand)]/40"
        >
          <span className="flex items-center gap-2 font-medium">
            <Users className="h-4 w-4 text-muted-foreground" /> Personeel
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Budget, credits, maxima en goedkeuring beheer je op Personeel.
          </span>
        </Link>
      </nav>
    </>
  );
}
