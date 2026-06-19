export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return euro.format(value);
}

export const ORDER_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" }
> = {
  pending_approval: { label: "Wacht op goedkeuring", tone: "amber" },
  approved: { label: "Goedgekeurd", tone: "green" },
  rejected: { label: "Afgewezen", tone: "red" },
  in_production: { label: "In productie", tone: "blue" },
  shipped: { label: "Verzonden", tone: "blue" },
  delivered: { label: "Geleverd", tone: "green" },
  fulfilled: { label: "Afgehandeld", tone: "blue" },
  cancelled: { label: "Geannuleerd", tone: "neutral" },
};

export function variantLabel(
  attributes: Record<string, unknown> | null,
): string {
  if (!attributes) return "";
  return Object.entries(attributes)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
