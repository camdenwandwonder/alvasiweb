/**
 * The order overview's selection (period + filters + view), read from and
 * written to the URL so every overview can be shared as a link. Pure: used by
 * the server pages, the export route and the client.
 */

export const PERIODS = [
  { key: "vandaag", label: "Vandaag" },
  { key: "week", label: "Deze week" },
  { key: "maand", label: "Deze maand" },
  { key: "vorige-maand", label: "Vorige maand" },
  { key: "kwartaal", label: "Dit kwartaal" },
  { key: "vorig-kwartaal", label: "Vorig kwartaal" },
  { key: "jaar", label: "Dit jaar" },
  { key: "vorig-jaar", label: "Vorig jaar" },
  { key: "30d", label: "Laatste 30 dagen" },
  { key: "12m", label: "Laatste 12 maanden" },
  { key: "alles", label: "Alles" },
  { key: "aangepast", label: "Aangepast" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];
export const DEFAULT_PERIOD: PeriodKey = "jaar";

export type OrderView = "bestellingen" | "medewerkers" | "producten";

export const SORTS = ["datum", "nummer", "medewerker", "bedrag", "status"] as const;
export type OrderSort = (typeof SORTS)[number];

export const PAGE_SIZE = 50;

/** Statuses as shown in the tabs; "open" expands to the unfinished ones. */
export const OPEN_STATUSES = ["pending_approval", "approved", "in_production", "shipped"];
export const STATUS_TABS: { key: string; label: string; statuses: string[] }[] = [
  { key: "alles", label: "Alles", statuses: [] },
  { key: "pending_approval", label: "Wacht op goedkeuring", statuses: ["pending_approval"] },
  { key: "in_production", label: "In productie", statuses: ["in_production", "approved"] },
  { key: "shipped", label: "Verzonden", statuses: ["shipped"] },
  { key: "delivered", label: "Geleverd", statuses: ["delivered", "fulfilled"] },
  { key: "closed", label: "Afgewezen of geannuleerd", statuses: ["rejected", "cancelled"] },
];

export type OrderQuery = {
  periode: PeriodKey;
  /** YYYY-MM-DD, inclusive; only for "aangepast". */
  van: string;
  tot: string;
  zoek: string;
  status: string[];
  medewerker: string[];
  functie: string[];
  product: string[];
  categorie: string[];
  bedrijf: string[];
  goedgekeurd: string[];
  adres: string;
  min: string;
  max: string;
  aanvraag: boolean;
  notitie: boolean;
  proef: boolean;
  weergave: OrderView;
  sorteer: OrderSort;
  richting: "asc" | "desc";
  pagina: number;
  /** Per medewerker: also people who did not order. */
  iedereen: boolean;
};

export const EMPTY_QUERY: OrderQuery = {
  periode: DEFAULT_PERIOD,
  van: "",
  tot: "",
  zoek: "",
  status: [],
  medewerker: [],
  functie: [],
  product: [],
  categorie: [],
  bedrijf: [],
  goedgekeurd: [],
  adres: "",
  min: "",
  max: "",
  aanvraag: false,
  notitie: false,
  proef: false,
  weergave: "bestellingen",
  sorteer: "datum",
  richting: "desc",
  pagina: 1,
  iedereen: true,
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(sp: Params, key: string): string {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (s: string) => s.split(",").map((x) => x.trim()).filter((x) => UUID.test(x));
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isAmount = (s: string) => /^\d+([.,]\d+)?$/.test(s);

export function parseQuery(sp: Params): OrderQuery {
  const periode = get(sp, "periode");
  const weergave = get(sp, "weergave");
  const sorteer = get(sp, "sorteer");
  const pagina = Number(get(sp, "pagina"));
  return {
    periode: (PERIODS.some((p) => p.key === periode) ? periode : DEFAULT_PERIOD) as PeriodKey,
    van: isDate(get(sp, "van")) ? get(sp, "van") : "",
    tot: isDate(get(sp, "tot")) ? get(sp, "tot") : "",
    zoek: get(sp, "zoek").slice(0, 200),
    status: list(get(sp, "status")).filter((s) => /^[a-z_]+$/.test(s)),
    medewerker: ids(get(sp, "medewerker")),
    functie: ids(get(sp, "functie")),
    product: ids(get(sp, "product")),
    categorie: ids(get(sp, "categorie")),
    bedrijf: ids(get(sp, "bedrijf")),
    goedgekeurd: ids(get(sp, "goedgekeurd")),
    adres: get(sp, "adres").slice(0, 300),
    min: isAmount(get(sp, "min")) ? get(sp, "min") : "",
    max: isAmount(get(sp, "max")) ? get(sp, "max") : "",
    aanvraag: get(sp, "aanvraag") === "1",
    notitie: get(sp, "notitie") === "1",
    proef: get(sp, "proef") === "1",
    weergave: (["bestellingen", "medewerkers", "producten"].includes(weergave)
      ? weergave
      : "bestellingen") as OrderView,
    sorteer: ((SORTS as readonly string[]).includes(sorteer) ? sorteer : "datum") as OrderSort,
    richting: get(sp, "richting") === "asc" ? "asc" : "desc",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
    iedereen: get(sp, "iedereen") !== "0",
  };
}

/** Query string without defaults (keeps links short). */
export function toSearch(q: OrderQuery, extra?: Record<string, string | null>): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string, def = "") => {
    if (v && v !== def) p.set(k, v);
  };
  set("periode", q.periode, DEFAULT_PERIOD);
  if (q.periode === "aangepast") {
    set("van", q.van);
    set("tot", q.tot);
  }
  set("zoek", q.zoek);
  set("status", q.status.join(","));
  set("medewerker", q.medewerker.join(","));
  set("functie", q.functie.join(","));
  set("product", q.product.join(","));
  set("categorie", q.categorie.join(","));
  set("bedrijf", q.bedrijf.join(","));
  set("goedgekeurd", q.goedgekeurd.join(","));
  set("adres", q.adres);
  set("min", q.min);
  set("max", q.max);
  if (q.aanvraag) p.set("aanvraag", "1");
  if (q.notitie) p.set("notitie", "1");
  if (q.proef) p.set("proef", "1");
  set("weergave", q.weergave, "bestellingen");
  set("sorteer", q.sorteer, "datum");
  set("richting", q.richting, "desc");
  if (q.pagina > 1) p.set("pagina", String(q.pagina));
  if (!q.iedereen) p.set("iedereen", "0");
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Number of filters beyond period and view (for "Wissen"). */
export function activeFilterCount(q: OrderQuery): number {
  return (
    (q.zoek ? 1 : 0) +
    (q.status.length ? 1 : 0) +
    (q.medewerker.length ? 1 : 0) +
    (q.functie.length ? 1 : 0) +
    (q.product.length ? 1 : 0) +
    (q.categorie.length ? 1 : 0) +
    (q.bedrijf.length ? 1 : 0) +
    (q.goedgekeurd.length ? 1 : 0) +
    (q.adres ? 1 : 0) +
    (q.min || q.max ? 1 : 0) +
    (q.aanvraag ? 1 : 0) +
    (q.notitie ? 1 : 0) +
    (q.proef ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Periods in Dutch time.

const TZ = "Europe/Amsterdam";

function offsetMinutes(at: Date): number {
  const local = new Date(at.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  return (local.getTime() - utc.getTime()) / 60000;
}

/** Midnight of a (possibly overflowing) Dutch calendar date, as an instant. */
export function nlMidnight(y: number, m: number, d: number): Date {
  const guess = new Date(Date.UTC(y, m, d));
  const first = new Date(guess.getTime() - offsetMinutes(guess) * 60000);
  return new Date(guess.getTime() - offsetMinutes(first) * 60000);
}

export function nlToday(now = new Date()): { y: number; m: number; d: number; dow: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!);
  return { y: Number(parts.year), m: Number(parts.month) - 1, d: Number(parts.day), dow };
}

export type Range = {
  from: Date | null;
  to: Date | null;
  label: string;
  prev: { from: Date; to: Date; label: string } | null;
};

function parseDay(s: string): { y: number; m: number; d: number } | null {
  if (!isDate(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return { y: y!, m: m! - 1, d: d! };
}

const dayLabel = (d: Date) =>
  d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

export function periodRange(q: Pick<OrderQuery, "periode" | "van" | "tot">, now = new Date()): Range {
  const { y, m, d, dow } = nlToday(now);
  const label = PERIODS.find((p) => p.key === q.periode)?.label ?? "";
  let from: Date | null = null;
  let to: Date | null = null;
  let prevStart: Date | null = null;
  let prevLabel = "de periode ervoor";

  switch (q.periode) {
    case "vandaag":
      from = nlMidnight(y, m, d);
      to = nlMidnight(y, m, d + 1);
      prevStart = nlMidnight(y, m, d - 1);
      prevLabel = "gisteren";
      break;
    case "week": {
      const mon = d - ((dow + 6) % 7);
      from = nlMidnight(y, m, mon);
      to = nlMidnight(y, m, mon + 7);
      prevStart = nlMidnight(y, m, mon - 7);
      prevLabel = "vorige week";
      break;
    }
    case "maand":
      from = nlMidnight(y, m, 1);
      to = nlMidnight(y, m + 1, 1);
      prevStart = nlMidnight(y, m - 1, 1);
      prevLabel = "vorige maand";
      break;
    case "vorige-maand":
      from = nlMidnight(y, m - 1, 1);
      to = nlMidnight(y, m, 1);
      prevStart = nlMidnight(y, m - 2, 1);
      prevLabel = "de maand ervoor";
      break;
    case "kwartaal": {
      const q0 = m - (m % 3);
      from = nlMidnight(y, q0, 1);
      to = nlMidnight(y, q0 + 3, 1);
      prevStart = nlMidnight(y, q0 - 3, 1);
      prevLabel = "vorig kwartaal";
      break;
    }
    case "vorig-kwartaal": {
      const q0 = m - (m % 3) - 3;
      from = nlMidnight(y, q0, 1);
      to = nlMidnight(y, q0 + 3, 1);
      prevStart = nlMidnight(y, q0 - 3, 1);
      prevLabel = "het kwartaal ervoor";
      break;
    }
    case "jaar":
      from = nlMidnight(y, 0, 1);
      to = nlMidnight(y + 1, 0, 1);
      prevStart = nlMidnight(y - 1, 0, 1);
      prevLabel = "dezelfde periode vorig jaar";
      break;
    case "vorig-jaar":
      from = nlMidnight(y - 1, 0, 1);
      to = nlMidnight(y, 0, 1);
      prevStart = nlMidnight(y - 2, 0, 1);
      prevLabel = "het jaar ervoor";
      break;
    case "30d":
      from = nlMidnight(y, m, d - 29);
      to = nlMidnight(y, m, d + 1);
      break;
    case "12m":
      from = nlMidnight(y - 1, m, d + 1);
      to = nlMidnight(y, m, d + 1);
      break;
    case "aangepast": {
      const a = parseDay(q.van);
      const b = parseDay(q.tot);
      from = a ? nlMidnight(a.y, a.m, a.d) : null;
      to = b ? nlMidnight(b.y, b.m, b.d + 1) : null;
      if (from && to && to < from) [from, to] = [nlMidnight(b!.y, b!.m, b!.d), nlMidnight(a!.y, a!.m, a!.d + 1)];
      break;
    }
    case "alles":
      break;
  }

  // Compare the elapsed part of the period with the same span before it.
  let prev: Range["prev"] = null;
  if (from && to) {
    const end = new Date(Math.min(to.getTime(), Math.max(now.getTime(), from.getTime())));
    const span = end.getTime() - from.getTime();
    if (span > 0) {
      const start = prevStart ?? new Date(from.getTime() - (to.getTime() - from.getTime()));
      prev = { from: start, to: new Date(start.getTime() + span), label: prevLabel };
    }
  }

  const customLabel =
    q.periode === "aangepast"
      ? from && to
        ? `${dayLabel(from)} – ${dayLabel(new Date(to.getTime() - 1))}`
        : from
          ? `Vanaf ${dayLabel(from)}`
          : to
            ? `Tot en met ${dayLabel(new Date(to.getTime() - 1))}`
            : "Alles"
      : label;
  return { from, to, label: customLabel, prev };
}
