import Link from "next/link";
import { ArrowLeft, Ruler } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/primitives";
import { NewOptionSetDialog } from "./new-option-set-dialog";
import { OptionsTable, type OptionSetRow } from "./options-table";

export const dynamic = "force-dynamic";

type Raw = {
  id: string;
  name: string;
  kind: string;
  values: { count: number }[];
};

export default async function OptionsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("option_sets")
    .select("id, name, kind, values:option_values(count)")
    .order("name");

  const raw = (data ?? []) as unknown as Raw[];
  const rows: OptionSetRow[] = raw.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    valueCount: r.values?.[0]?.count ?? 0,
  }));

  return (
    <div>
      <Link
        href="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Configuratie
      </Link>
      <PageHeader
        title="Opties & maten"
        description="Herbruikbare matensystemen en kleurpaletten voor je categorieën."
        action={<NewOptionSetDialog />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Nog geen optiesets"
          description="Maak een matensysteem of kleurpalet aan."
          action={<NewOptionSetDialog />}
        />
      ) : (
        <OptionsTable rows={rows} />
      )}
    </div>
  );
}
