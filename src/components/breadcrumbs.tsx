"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  admin: "Beheer",
  companies: "Bedrijven",
  catalog: "Catalogus",
  config: "Configuratie",
  categories: "Categorieën",
  options: "Opties & maten",
  orders: "Bestellingen",
  reports: "Rapportages",
  account: "Account",
  new: "Nieuw",
  dashboard: "Overzicht",
  products: "Winkel",
  cart: "Winkelwagen",
  approvals: "Goedkeuringen",
  people: "Personeel",
  roles: "Rollen",
  budgets: "Regels & budget",
  settings: "Instellingen",
  profile: "Mijn profiel",
};

function labelFor(seg: string) {
  if (LABELS[seg]) return LABELS[seg];
  // dynamic id segments
  if (/^[0-9a-f-]{8,}$/i.test(seg)) return "Details";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: labelFor(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    last: i === segments.length - 1,
  }));

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1.5">
          {c.last ? (
            <span className="font-medium">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {c.label}
            </Link>
          )}
          {!c.last ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : null}
        </span>
      ))}
    </nav>
  );
}
