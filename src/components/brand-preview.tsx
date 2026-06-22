import { Store } from "lucide-react";

/** A small live mock of the company's branded portal header. */
export function BrandPreview({
  name,
  primary,
  secondary,
  logoUrl,
}: {
  name: string;
  primary: string;
  secondary: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ background: primary, color: "#fff" }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-7 w-7 rounded-md bg-white/20 object-contain"
          />
        ) : (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold"
            style={{ background: secondary, color: "#fff" }}
          >
            {(name || "A").charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-semibold">{name || "Bedrijfsnaam"}</span>
      </div>
      <div className="space-y-3 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Store className="h-4 w-4" style={{ color: secondary }} />
          Winkel
        </div>
        <div className="h-2 w-2/3 rounded bg-muted" />
        <div className="h-2 w-1/2 rounded bg-muted" />
        <div className="flex gap-2 pt-1">
          <span
            className="rounded-md px-3 py-1.5 text-xs font-medium"
            style={{ background: primary, color: "#fff" }}
          >
            Bestellen
          </span>
          <span
            className="rounded-md border px-3 py-1.5 text-xs"
            style={{ borderColor: secondary, color: secondary }}
          >
            Details
          </span>
        </div>
      </div>
    </div>
  );
}
