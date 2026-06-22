import Link from "next/link";
import { Tags, Ruler, ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function ConfigOverview() {
  const admin = createAdminClient();
  const [{ count: catCount }, { count: optCount }] = await Promise.all([
    admin.from("categories").select("*", { count: "exact", head: true }),
    admin.from("option_sets").select("*", { count: "exact", head: true }),
  ]);

  const sections = [
    {
      href: "/admin/config/categories",
      icon: Tags,
      title: "Categorieën",
      desc: "Productindeling met standaardregels (goedkeuring, limieten, proef, levertijd) die doorwerken naar elk product.",
      count: `${catCount ?? 0} categorieën`,
    },
    {
      href: "/admin/config/options",
      icon: Ruler,
      title: "Opties & maten",
      desc: "Herbruikbare matensystemen en kleurpaletten. Koppel ze aan categorieën zodat producten standaardopties krijgen.",
      count: `${optCount ?? 0} optiesets`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Configuratie"
        description="Platformbrede instellingen die de catalogus voor elk bedrijf aansturen."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="block h-full">
            <div className="flex h-full items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-foreground/20 hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-foreground)]">
                <s.icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.title}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                <p className="mt-2 text-xs text-muted-foreground">{s.count}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
