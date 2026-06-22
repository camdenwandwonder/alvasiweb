import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Product image with hover-swap: shows the primary image, and crossfades to the
 * second image on hover (when the product has more than one). Place inside an
 * element with the `group` class (e.g. the card link) for card-hover swapping.
 */
export function ProductThumb({
  images,
  alt,
  className,
}: {
  images: { url: string; is_primary: boolean }[];
  alt: string;
  className?: string;
}) {
  const primary = images.find((i) => i.is_primary)?.url ?? images[0]?.url;
  const second = images.find((i) => i.url !== primary)?.url;

  if (!primary) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <Package className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={primary}
        alt={alt}
        className="h-full w-full object-cover"
      />
      {second ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={second}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
      ) : null}
    </div>
  );
}
