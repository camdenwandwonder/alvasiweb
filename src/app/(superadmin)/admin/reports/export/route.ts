import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) {
    return new NextResponse("Geen toegang", { status: 403 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      "order_number, status, total, created_at, company:companies(name), items:order_items(quantity)",
    )
    .order("created_at", { ascending: false });

  type Row = {
    order_number: string | null;
    status: string;
    total: number;
    created_at: string;
    company: { name: string } | null;
    items: { quantity: number }[];
  };
  const orders = (data ?? []) as unknown as Row[];

  const header = ["Bestelnummer", "Bedrijf", "Status", "Artikelen", "Totaal", "Datum"];
  const lines = [header.join(",")];
  for (const o of orders) {
    const qty = o.items.reduce((s, i) => s + i.quantity, 0);
    lines.push(
      [
        csvCell(o.order_number),
        csvCell(o.company?.name),
        csvCell(o.status),
        csvCell(qty),
        csvCell(Number(o.total ?? 0).toFixed(2)),
        csvCell(new Date(o.created_at).toLocaleString("nl-NL")),
      ].join(","),
    );
  }

  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alvasi-bestellingen.csv"`,
    },
  });
}
