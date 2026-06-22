"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Dynamic, animated hero showing a company's atmosphere images. The layout and
 * behaviour adapt to the number of images: a single Ken-Burns still, or an
 * auto-rotating crossfade carousel with a thumbnail rail for several.
 */
export function AtmosphereHero({
  images,
  title,
  subtitle,
}: {
  images: string[];
  title: string;
  subtitle?: string;
}) {
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % images.length);
    }, 5000);
    return () => clearInterval(t);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="mb-8">
      <div
        className="relative h-64 overflow-hidden rounded-2xl sm:h-80"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src + i}
            src={src}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out",
              i === index ? "animate-kenburns opacity-100" : "opacity-0",
            )}
          />
        ))}

        {/* readability overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

        {/* title */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h1 className="animate-fade-up text-3xl font-semibold tracking-tight text-white drop-shadow sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="animate-fade-up mt-1 max-w-xl text-sm text-white/85 sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* dots */}
        {images.length > 1 ? (
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Beeld ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* thumbnail rail — adapts to count */}
      {images.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <button
              key={src + i}
              onClick={() => setIndex(i)}
              className={cn(
                "h-16 w-24 overflow-hidden rounded-lg ring-2 transition",
                i === index
                  ? "ring-[var(--brand)]"
                  : "ring-transparent hover:ring-border",
              )}
            >
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
