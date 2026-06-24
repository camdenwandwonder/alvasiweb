/** Token-based templates for JamesPRO project/task text. Server + client safe. */

import { formatPrice } from "@/lib/format";

export type OrderTokens = {
  order_number: string;
  company_name: string;
  ordered_by: string;
  order_total: string;
  order_date: string;
  item_count: string;
  items: string; // HTML list (one <li> per line)
  items_plain: string; // newline-joined
  delivery_address: string;
  note: string;
  request_reason: string;
  order_url: string;
};

export const DEFAULT_TEMPLATES = {
  project_title_template: "Bestelling {{order_number}} — {{company_name}}",
  project_briefing_template: `<p><strong>Bestelling {{order_number}}</strong> — {{company_name}}<br/>
Besteld door: {{ordered_by}} op {{order_date}}</p>
<ul>{{items}}</ul>
<p><strong>Totaal: {{order_total}}</strong></p>
<p><strong>Leveradres:</strong><br/>{{delivery_address}}</p>
<p><strong>Notitie:</strong> {{note}}</p>
<p><a href="{{order_url}}">Bekijk bestelling in Alvasi</a></p>`,
  task_description_template: "Verwerk bestelling {{order_number}}",
  task_note_template: "{{item_count}} artikel(en) · {{order_total}}",
};

/** Replace every {{token}} with its value (missing tokens become empty). */
export function renderTemplate(
  template: string,
  tokens: Partial<OrderTokens>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = (tokens as Record<string, string | undefined>)[key];
    return v ?? "";
  });
}

export const TOKEN_REFERENCE: { token: string; description: string }[] = [
  { token: "{{order_number}}", description: "Bestelnummer (ALV-…)" },
  { token: "{{company_name}}", description: "Naam van het bedrijf" },
  { token: "{{ordered_by}}", description: "Wie de bestelling plaatste" },
  { token: "{{order_total}}", description: "Totaalbedrag" },
  { token: "{{order_date}}", description: "Besteldatum" },
  { token: "{{item_count}}", description: "Aantal artikelen" },
  { token: "{{items}}", description: "Artikellijst (HTML <li> per regel)" },
  { token: "{{items_plain}}", description: "Artikellijst (platte tekst)" },
  { token: "{{delivery_address}}", description: "Leveradres" },
  { token: "{{note}}", description: "Notitie bij de bestelling" },
  { token: "{{request_reason}}", description: "Reden bij een aanvraag" },
  { token: "{{order_url}}", description: "Link naar de bestelling in Alvasi" },
];

export const SAMPLE_TOKENS: OrderTokens = {
  order_number: "ALV-2026-00042",
  company_name: "Zieleman",
  ordered_by: "Camden Normaal",
  order_total: "€ 61,50",
  order_date: "24-06-2026",
  item_count: "2",
  items:
    "<li>1× Werkplaats T-Shirt (Maat: M, Kleur: Navy)</li><li>1× Geurhanger (Maat: 12 × 12 cm)</li>",
  items_plain:
    "1× Werkplaats T-Shirt (Maat: M, Kleur: Navy)\n1× Geurhanger (Maat: 12 × 12 cm)",
  delivery_address: "Zieleman Nieuwleusen\nBurgemeester Backxlaan 206\n7711 AL Nieuwleusen",
  note: "Graag voor vrijdag leveren.",
  request_reason: "",
  order_url: "https://alvasiweb.vercel.app/admin/orders/sample",
};

type OrderLine = {
  product_name: string;
  variant_label: string | null;
  quantity: number;
  line_total: number;
};

/** Build the token set from a real order's data. */
export function buildOrderTokens(input: {
  orderId: string;
  orderNumber: string | null;
  companyName: string;
  orderedBy: string;
  total: number;
  createdAt: string;
  items: OrderLine[];
  shipTo: { name?: string | null; address?: string | null; postal?: string | null; city?: string | null };
  note: string | null;
  requestReason: string | null;
  appUrl: string;
}): OrderTokens {
  const lineText = (l: OrderLine) =>
    `${l.quantity}× ${l.product_name}${l.variant_label ? ` (${l.variant_label})` : ""}`;
  const addressLines = [
    input.shipTo.name,
    input.shipTo.address,
    [input.shipTo.postal, input.shipTo.city].filter(Boolean).join(" "),
  ].filter(Boolean) as string[];

  return {
    order_number: input.orderNumber ?? "—",
    company_name: input.companyName,
    ordered_by: input.orderedBy,
    order_total: formatPrice(input.total),
    order_date: new Date(input.createdAt).toLocaleDateString("nl-NL"),
    item_count: String(input.items.reduce((s, i) => s + i.quantity, 0)),
    items: input.items.map((l) => `<li>${lineText(l)}</li>`).join(""),
    items_plain: input.items.map(lineText).join("\n"),
    delivery_address: addressLines.join("\n") || "—",
    note: input.note ?? "",
    request_reason: input.requestReason ?? "",
    order_url: `${input.appUrl.replace(/\/$/, "")}/admin/orders/${input.orderId}`,
  };
}
