import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUser, can, isMember } from "@/lib/auth/user";
import { displayFor, readOrderingSettings, type Display } from "@/lib/ordering";
import { ORDER_STATUS, slugify } from "@/lib/format";
import { parseQuery, periodRange } from "@/lib/orders/filters";
import {
  fetchOrders,
  fetchPeople,
  filterObject,
  type OrderRow,
  type OverviewScope,
} from "@/lib/orders/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind = "money" | "credits" | "int" | "text";
type Column = { header: string; kind: Kind; width?: number };
type Sheet = { columns: Column[]; rows: (string | number | null)[][] };

const TZ = "Europe/Amsterdam";

function dateTime(iso: string | null): string {
  if (!iso) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("nl-NL", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

const statusLabel = (s: string) => ORDER_STATUS[s]?.label ?? s;
const yesNo = (b: boolean) => (b ? "Ja" : "Nee");
const round2 = (n: number) => Math.round(n * 100) / 100;

function contents(o: OrderRow): string {
  return o.items
    .map((i) => `${i.quantity}× ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ""}`)
    .join(", ");
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function resolveScope(scopeParam: string | null): Promise<OverviewScope | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (scopeParam === "admin") return user.isSuperadmin ? { mode: "admin", userId: user.id } : null;
  if (!user.companyId) return null;
  if (can(user, "orders.view_all")) return { mode: "company", companyId: user.companyId, userId: user.id };
  if (can(user, "orders.view_own"))
    return { mode: "own", companyId: user.companyId, userId: user.id, member: isMember(user) };
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = await resolveScope(url.searchParams.get("scope"));
  if (!scope) return new NextResponse("Geen toegang", { status: 403 });

  const q = parseQuery(url.searchParams);
  const soort = url.searchParams.get("soort") ?? "bestellingen";
  const formaat = url.searchParams.get("formaat") === "csv" ? "csv" : "xlsx";
  if (!["bestellingen", "regels", "medewerkers", "producten"].includes(soort))
    return new NextResponse("Onbekend soort export", { status: 400 });
  if (soort === "medewerkers" && scope.mode === "own")
    return new NextResponse("Niet beschikbaar", { status: 400 });

  // Same unit and visibility as the overview page.
  let display: Display = "euro";
  let unit: "euro" | "credits" = "euro";
  if (scope.mode !== "admin") {
    const { data } = await createAdminClient()
      .from("companies")
      .select("settings")
      .eq("id", scope.companyId)
      .maybeSingle();
    const settings = readOrderingSettings((data?.settings as Record<string, unknown>) ?? {});
    display = displayFor(settings, scope.mode === "own" && scope.member ? "member" : "manager");
    unit = settings.payment === "credits" ? "credits" : "euro";
  }
  const showEuro = display === "euro" || display === "both";
  const showCredits = display === "credits" || display === "both";
  const admin = scope.mode === "admin";
  const own = scope.mode === "own";

  const f = filterObject(q, scope, unit);
  let sheet: Sheet;

  try {
    if (soort === "bestellingen" || soort === "regels") {
      const { rows } = await fetchOrders(f, q, { offset: 0, limit: 10000 });
      const anyCredits = rows.some((r) => r.credit_total > 0);

      if (soort === "bestellingen") {
        const columns: Column[] = [
          { header: "Bestelnummer", kind: "text", width: 16 },
          { header: "Datum", kind: "text", width: 17 },
          ...(admin ? [{ header: "Bedrijf", kind: "text" as const, width: 22 }] : []),
          { header: "Medewerker", kind: "text", width: 22 },
          ...(!own ? [{ header: "E-mail", kind: "text" as const, width: 26 }] : []),
          { header: "Functie", kind: "text", width: 16 },
          { header: "Status", kind: "text", width: 20 },
          { header: "Artikelen", kind: "int", width: 10 },
          { header: "Inhoud", kind: "text", width: 50 },
          ...(showEuro ? [{ header: "Bedrag", kind: "money" as const, width: 12 }] : []),
          ...(showCredits && (anyCredits || display === "credits")
            ? [{ header: "Credits", kind: "credits" as const, width: 10 }]
            : []),
          { header: "Leveradres", kind: "text", width: 32 },
          { header: "Afwijkend adres", kind: "text", width: 15 },
          { header: "Aanvraag", kind: "text", width: 10 },
        ];
        const emails = own ? new Map<string, string>() : await emailsFor(rows.map((r) => r.ordered_by));
        sheet = {
          columns,
          rows: rows.map((o) => [
            o.order_number ?? "",
            dateTime(o.created_at),
            ...(admin ? [o.company ?? ""] : []),
            o.name,
            ...(!own ? [emails.get(o.ordered_by) ?? ""] : []),
            o.role_name ?? "",
            statusLabel(o.status),
            o.quantity,
            contents(o),
            ...(showEuro ? [round2(o.total)] : []),
            ...(showCredits && (anyCredits || display === "credits") ? [o.credit_total] : []),
            o.address ?? "",
            yesNo(o.custom_address),
            yesNo(o.is_request),
          ]),
        };
      } else {
        const supabase = await createClient();
        const byOrder = new Map(rows.map((r) => [r.id, r]));
        type Line = {
          order_id: string;
          product_name: string;
          variant_label: string | null;
          sku: string | null;
          quantity: number;
          unit_price: number | null;
          line_total: number | null;
          credit_cost: number | null;
          created_at: string;
        };
        const lines: Line[] = [];
        for (const ids of chunk(rows.map((r) => r.id), 200)) {
          const { data, error } = await supabase
            .from("order_items")
            .select("order_id, product_name, variant_label, sku, quantity, unit_price, line_total, credit_cost, created_at")
            .in("order_id", ids);
          if (error) throw new Error(error.message);
          lines.push(...((data ?? []) as Line[]));
        }
        const position = new Map(rows.map((r, i) => [r.id, i]));
        lines.sort(
          (a, b) =>
            (position.get(a.order_id) ?? 0) - (position.get(b.order_id) ?? 0) ||
            a.created_at.localeCompare(b.created_at),
        );
        const columns: Column[] = [
          { header: "Bestelnummer", kind: "text", width: 16 },
          { header: "Datum", kind: "text", width: 17 },
          ...(admin ? [{ header: "Bedrijf", kind: "text" as const, width: 22 }] : []),
          { header: "Medewerker", kind: "text", width: 22 },
          { header: "Functie", kind: "text", width: 16 },
          { header: "Status", kind: "text", width: 20 },
          { header: "Product", kind: "text", width: 30 },
          { header: "Variant", kind: "text", width: 24 },
          { header: "Artikelnummer", kind: "text", width: 16 },
          { header: "Aantal", kind: "int", width: 8 },
          ...(showEuro
            ? [
                { header: "Stukprijs", kind: "money" as const, width: 12 },
                { header: "Regeltotaal", kind: "money" as const, width: 12 },
              ]
            : []),
          ...(showCredits
            ? [
                { header: "Credits per stuk", kind: "credits" as const, width: 14 },
                { header: "Credits totaal", kind: "credits" as const, width: 14 },
              ]
            : []),
        ];
        sheet = {
          columns,
          rows: lines.map((l) => {
            const o = byOrder.get(l.order_id)!;
            const credits = Number(l.credit_cost ?? 0);
            return [
              o.order_number ?? "",
              dateTime(o.created_at),
              ...(admin ? [o.company ?? ""] : []),
              o.name,
              o.role_name ?? "",
              statusLabel(o.status),
              l.product_name,
              l.variant_label ?? "",
              l.sku ?? "",
              l.quantity,
              ...(showEuro ? [round2(Number(l.unit_price ?? 0)), round2(Number(l.line_total ?? 0))] : []),
              ...(showCredits ? [credits, credits * l.quantity] : []),
            ];
          }),
        };
      }
    } else if (soort === "medewerkers") {
      const people = await fetchPeople(f);
      let companyName = new Map<string, string>();
      if (admin) {
        const { data } = await createAdminClient().from("companies").select("id, name");
        companyName = new Map((data ?? []).map((c) => [c.id as string, c.name as string]));
      }
      people.sort((a, b) => Number(b.value) - Number(a.value) || (a.name ?? "").localeCompare(b.name ?? "", "nl"));
      sheet = {
        columns: [
          { header: "Medewerker", kind: "text", width: 24 },
          ...(admin ? [{ header: "Bedrijf", kind: "text" as const, width: 22 }] : []),
          { header: "Functie", kind: "text", width: 16 },
          { header: "Bestellingen", kind: "int", width: 12 },
          { header: "Artikelen", kind: "int", width: 10 },
          ...(showEuro ? [{ header: "Besteed", kind: "money" as const, width: 12 }] : []),
          ...(showCredits ? [{ header: "Credits", kind: "credits" as const, width: 10 }] : []),
          { header: "Laatste bestelling", kind: "text", width: 17 },
        ],
        rows: people.map((p) => [
          p.name ?? "Onbekend",
          ...(admin ? [p.company_id ? (companyName.get(p.company_id) ?? "") : ""] : []),
          p.role_name ?? "",
          Number(p.orders),
          Number(p.items),
          ...(showEuro ? [round2(Number(p.value))] : []),
          ...(showCredits ? [Number(p.credits)] : []),
          dateTime(p.last_at),
        ]),
      };
    } else {
      const { data, error } = await (await createClient()).rpc("order_by_product", { f });
      if (error) throw new Error(error.message);
      const variants = ((data ?? []) as {
        product_name: string;
        variant_label: string | null;
        quantity: number;
        value: number;
        credits: number;
        buyers: unknown[] | null;
      }[]).sort(
        (a, b) =>
          a.product_name.localeCompare(b.product_name, "nl") ||
          (a.variant_label ?? "").localeCompare(b.variant_label ?? "", "nl", { numeric: true }),
      );
      sheet = {
        columns: [
          { header: "Product", kind: "text", width: 30 },
          { header: "Variant", kind: "text", width: 24 },
          { header: "Aantal", kind: "int", width: 8 },
          ...(showEuro ? [{ header: "Besteed", kind: "money" as const, width: 12 }] : []),
          ...(showCredits ? [{ header: "Credits", kind: "credits" as const, width: 10 }] : []),
          { header: "Besteld door", kind: "int", width: 12 },
        ],
        rows: variants.map((v) => [
          v.product_name,
          v.variant_label ?? "",
          Number(v.quantity),
          ...(showEuro ? [round2(Number(v.value))] : []),
          ...(showCredits ? [Math.round(Number(v.credits))] : []),
          (v.buyers ?? []).length,
        ]),
      };
    }
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Export mislukt", { status: 500 });
  }

  const range = periodRange(q);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const base = `bestellingen-${slugify(range.label) || "export"}${soort === "bestellingen" ? "" : `-${soort}`}-${today}`;

  if (formaat === "csv") {
    const body = toCsv(sheet);
    return new NextResponse("﻿" + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    });
  }

  const buffer = await toXlsx(sheet);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
}

async function emailsFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data } = await createAdminClient().from("profiles").select("id, email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, (p.email as string | null) ?? ""]));
}

function csvCell(v: string | number | null, kind: Kind): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "number") {
    s = kind === "money" ? v.toFixed(2).replace(".", ",") : String(v).replace(".", ",");
  } else s = v;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(sheet: Sheet): string {
  const lines = [sheet.columns.map((c) => csvCell(c.header, "text")).join(";")];
  for (const row of sheet.rows)
    lines.push(row.map((v, i) => csvCell(v, sheet.columns[i]!.kind)).join(";"));
  return lines.join("\r\n");
}

async function toXlsx(sheet: Sheet): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Alvasi";
  wb.created = new Date();
  const ws = wb.addWorksheet("Bestellingen", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = sheet.columns.map((c) => ({
    header: c.header,
    width: c.width ?? 14,
    style:
      c.kind === "money"
        ? { numFmt: '€ #,##0.00' }
        : c.kind === "credits" || c.kind === "int"
          ? { numFmt: "0" }
          : {},
  }));
  ws.getRow(1).font = { bold: true };
  ws.addRows(sheet.rows);
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
