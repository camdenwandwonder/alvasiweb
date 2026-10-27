/**
 * Colour contrast following WCAG 2.2: relative luminance, contrast ratio,
 * and a readable shade of the same hue when a brand colour is too light.
 */

export const TEXT_MIN = 4.5;
export const UI_MIN = 3;

export function normalizeHex(input: string): string | null {
  let h = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

function rgb(hex: string): [number, number, number] {
  const h = (normalizeHex(hex) ?? "#000000").slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The text colour (white or black) that reads best on this background. */
export function bestTextColor(bg: string): "#ffffff" | "#000000" {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#000000") ? "#ffffff" : "#000000";
}

export type ContrastCheck = {
  white: number;
  black: number;
  /** White text passes for normal text (4.5:1). */
  whiteText: boolean;
  /** The colour itself is visible against a white page (3:1, for buttons/borders). */
  onWhiteUi: boolean;
};

export function checkColor(hex: string): ContrastCheck {
  const white = contrastRatio(hex, "#ffffff");
  const black = contrastRatio(hex, "#000000");
  return { white, black, whiteText: white >= TEXT_MIN, onWhiteUi: white >= UI_MIN };
}

/**
 * The same colour darkened (in HSL lightness, keeping hue and saturation)
 * just enough for white text to reach `min`. Null when it already passes.
 */
export function readableShade(hex: string, min = TEXT_MIN): string | null {
  if (contrastRatio(hex, "#ffffff") >= min) return null;
  const [h, s, l] = toHsl(rgb(hex));
  for (let light = l; light >= 0; light -= 0.01) {
    const candidate = toHex(fromHsl(h, s, light));
    if (contrastRatio(candidate, "#ffffff") >= min) return candidate;
  }
  return "#000000";
}

export function formatRatio(r: number): string {
  return `${(Math.floor(r * 10) / 10).toLocaleString("nl-NL", { minimumFractionDigits: 1 })}:1`;
}

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}
