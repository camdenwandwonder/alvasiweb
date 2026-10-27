import Image from "next/image";
import { cn } from "@/lib/utils";

/** Product photo, resized and converted by Next.js (originals are ~2 MB PNGs). */
export function ProductImg({
  src,
  alt,
  sizes,
  className,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-contain mix-blend-multiply", className)}
    />
  );
}
