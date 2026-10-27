"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

export type SizeChartTarget = { optionSetId: string } | { productId: string };
export type SizeChartInput = {
  columns: string[];
  rows: { size: string; values: string[] }[];
  note: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function targetColumn(target: SizeChartTarget): { column: "option_set_id" | "product_id"; id: string } | null {
  const id = "optionSetId" in target ? target.optionSetId : target.productId;
  if (!UUID.test(id)) return null;
  return { column: "optionSetId" in target ? "option_set_id" : "product_id", id };
}

function refresh() {
  revalidatePath("/admin/config/categories", "layout");
  revalidatePath("/admin/catalog", "layout");
  revalidatePath("/products");
}

/** Create or replace the size chart of a size system or of one product. */
export async function saveSizeChart(
  target: SizeChartTarget,
  chart: SizeChartInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) return { ok: false, error: "Geen toegang" };
  const t = targetColumn(target);
  if (!t) return { ok: false, error: "Onbekende maattabel." };

  const columns = chart.columns.map((c) => c.trim().slice(0, 40));
  if (!columns.length) return { ok: false, error: "Geef minstens één kolom." };
  if (columns.length > 8) return { ok: false, error: "Maximaal 8 kolommen." };
  if (columns.some((c) => !c)) return { ok: false, error: "Geef elke kolom een naam." };
  if (chart.rows.length > 30) return { ok: false, error: "Maximaal 30 maten." };

  const rows = chart.rows
    .map((r) => ({
      size: r.size.trim().slice(0, 30),
      values: columns.map((_, i) => (r.values[i] ?? "").trim().slice(0, 40)),
    }))
    .filter((r) => r.size);
  if (!rows.length) return { ok: false, error: "Voeg minstens één maat toe." };
  if (chart.rows.some((r) => r.values.length > columns.length))
    return { ok: false, error: "Een rij heeft meer waarden dan er kolommen zijn." };

  const admin = createAdminClient();
  const record = {
    option_set_id: t.column === "option_set_id" ? t.id : null,
    product_id: t.column === "product_id" ? t.id : null,
    columns,
    rows,
    note: chart.note?.trim().slice(0, 300) || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from("size_charts")
    .select("id")
    .eq(t.column, t.id)
    .maybeSingle();
  const { error } = existing
    ? await admin.from("size_charts").update(record).eq("id", existing.id)
    : await admin.from("size_charts").insert(record);
  if (error) return { ok: false, error: "Opslaan mislukt." };

  refresh();
  return { ok: true };
}

export async function deleteSizeChart(
  target: SizeChartTarget,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) return { ok: false, error: "Geen toegang" };
  const t = targetColumn(target);
  if (!t) return { ok: false, error: "Onbekende maattabel." };
  const { error } = await createAdminClient().from("size_charts").delete().eq(t.column, t.id);
  if (error) return { ok: false, error: "Verwijderen mislukt." };
  refresh();
  return { ok: true };
}
