/**
 * Company ordering preferences kept in companies.settings (jsonb), next to the
 * ordering rules: an order reference (e.g. a PO number) and cost centres.
 */
export type ReferenceMode = "off" | "ask" | "required";

export type OrderPrefs = {
  reference: ReferenceMode;
  /** Label shown to the orderer, e.g. "PO-nummer". */
  referenceLabel: string;
  costCenter: ReferenceMode;
  costCenters: string[];
};

const MODES: ReferenceMode[] = ["off", "ask", "required"];

export function readOrderPrefs(raw: Record<string, unknown> | null | undefined): OrderPrefs {
  const s = raw ?? {};
  const mode = (v: unknown): ReferenceMode => (MODES.includes(v as ReferenceMode) ? (v as ReferenceMode) : "off");
  const list = Array.isArray(s.cost_centers)
    ? (s.cost_centers as unknown[]).map((x) => String(x).trim()).filter(Boolean).slice(0, 100)
    : [];
  return {
    reference: mode(s.order_reference),
    referenceLabel: typeof s.order_reference_label === "string" && s.order_reference_label.trim()
      ? s.order_reference_label.trim().slice(0, 40)
      : "Bestelreferentie",
    costCenter: list.length ? mode(s.cost_center_mode) : "off",
    costCenters: list,
  };
}

/** The settings keys to merge into companies.settings when saving. */
export function writeOrderPrefs(p: OrderPrefs): Record<string, unknown> {
  return {
    order_reference: p.reference,
    order_reference_label: p.referenceLabel,
    cost_center_mode: p.costCenter,
    cost_centers: p.costCenters,
  };
}
