import Link from "next/link";
import { ArrowLeft, Ruler, ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/primitives";
import { NewOptionSetDialog } from "./new-option-set-dialog";

export const dynamic = "force-dynamic";

type OptionSet = {
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

  const sets = (data ?? []) as unknown as OptionSet[];

  return (
    <div>
      <Link
        href="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Configuration
      </Link>
      <PageHeader
        title="Options & sizes"
        description="Reusable size systems and color palettes for your categories."
        action={<NewOptionSetDialog />}
      />

      {sets.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No option sets yet"
          description="Create a size system or color palette."
          action={<NewOptionSetDialog />}
        />
      ) : (
        <div className="space-y-2">
          {sets.map((s) => (
            <Link key={s.id} href={`/admin/config/options/${s.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:border-foreground/20">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.name}</p>
                    <Badge variant="secondary">{s.kind}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.values?.[0]?.count ?? 0} values
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
