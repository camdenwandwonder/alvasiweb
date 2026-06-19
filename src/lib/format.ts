export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const ORDER_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" }
> = {
  pending_approval: { label: "Pending approval", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  fulfilled: { label: "Fulfilled", tone: "blue" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function variantLabel(attributes: Record<string, unknown> | null): string {
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
