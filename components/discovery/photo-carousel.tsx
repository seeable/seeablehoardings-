"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * VW-03 photo carousel — keyboard-navigable (arrow keys), one alt text per
 * photo, a `surface-2` placeholder for a failed load (never a broken glyph,
 * docs/07 §26).
 */
export function PhotoCarousel({
  images,
  title,
}: {
  images: { id: string; url: string }[];
  title: string;
}) {
  const [i, setI] = React.useState(0);
  const [broken, setBroken] = React.useState<Set<string>>(new Set());
  const count = images.length;

  if (count === 0) {
    return (
      <div className="bg-surface-2 text-ink-300 flex aspect-video w-full items-center justify-center rounded-lg">
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }

  const go = (delta: number) => setI((v) => (v + delta + count) % count);
  const cur = images[i];

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${title} — ${count} photos`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
      tabIndex={0}
    >
      <div className="bg-surface-2 aspect-video w-full overflow-hidden rounded-lg">
        {broken.has(cur.id) ? (
          <div className="text-ink-300 flex h-full items-center justify-center">
            <ImageOff className="h-8 w-8" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cur.url}
            alt={`${title} — photo ${i + 1} of ${count}`}
            className="h-full w-full object-cover"
            onError={() => setBroken((s) => new Set(s).add(cur.id))}
          />
        )}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="bg-surface-1/90 text-ink-900 hover:bg-surface-1 absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full shadow-md"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="bg-surface-1/90 text-ink-900 hover:bg-surface-1 absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full shadow-md"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                aria-label={`Go to photo ${idx + 1}`}
                aria-current={idx === i}
                onClick={() => setI(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === i ? "bg-surface-1 w-4" : "bg-surface-1/60 w-1.5",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
