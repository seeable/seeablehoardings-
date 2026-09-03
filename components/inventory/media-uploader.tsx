"use client";

import * as React from "react";
import { ImagePlus, Loader2, Star, Trash2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  deleteMedia,
  setPrimaryMedia,
  uploadMedia,
} from "@/lib/inventory/client";
import { MEDIA_MAX_PER_LISTING, MEDIA_RECOMMENDED } from "@/lib/inventory/media";
import { ApiClientError } from "@/lib/api/client";
import type { MediaAsset } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

type Pending = {
  key: string;
  name: string;
  status: "watermarking" | "error";
  error?: string;
  file: File;
};

/**
 * PB-03 Step 4 — drag/drop upload. Each photo is watermarked in the browser
 * (Canvas, "Watermarking…" state), uploaded as multipart, then shown as a
 * thumbnail. A failed upload shows a retry on that thumbnail only and never
 * blocks the others (docs/04 PB-03 States).
 */
export function MediaUploader({
  hoardingId,
  media,
  onChange,
}: {
  hoardingId: string;
  media: MediaAsset[];
  onChange: (media: MediaAsset[]) => void;
}) {
  const toast = useToast();
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const total = media.length + pending.length;

  const runUpload = React.useCallback(
    async (file: File, key: string) => {
      try {
        const asset = await uploadMedia(hoardingId, file, {
          isPrimary: media.length === 0,
        });
        setPending((p) => p.filter((x) => x.key !== key));
        onChange([...media, asset]);
      } catch (e) {
        const msg =
          e instanceof ApiClientError ? e.message : "Upload failed.";
        setPending((p) =>
          p.map((x) =>
            x.key === key ? { ...x, status: "error", error: msg } : x,
          ),
        );
      }
    },
    [hoardingId, media, onChange],
  );

  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const room = MEDIA_MAX_PER_LISTING - total;
      if (list.length > room) {
        toast.error(`You can add ${room} more photo${room === 1 ? "" : "s"}.`);
      }
      for (const file of list.slice(0, Math.max(0, room))) {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        setPending((p) => [
          ...p,
          { key, name: file.name, status: "watermarking", file },
        ]);
        void runUpload(file, key);
      }
    },
    [total, runUpload, toast],
  );

  async function remove(asset: MediaAsset) {
    const next = media.filter((m) => m.id !== asset.id);
    onChange(next);
    try {
      await deleteMedia(hoardingId, asset.id);
    } catch (e) {
      onChange(media); // roll back
      toast.error(
        e instanceof ApiClientError ? e.message : "Couldn't remove that photo.",
      );
    }
  }

  async function makePrimary(asset: MediaAsset) {
    onChange(
      media.map((m) => ({ ...m, is_primary: m.id === asset.id })),
    );
    try {
      await setPrimaryMedia(hoardingId, asset.id);
    } catch {
      toast.error("Couldn't set the cover photo.");
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-border flex flex-col items-center rounded-lg border border-dashed p-6 text-center",
          dragOver && "border-gold-500 bg-gold-100/30",
        )}
      >
        <ImagePlus className="text-ink-500 mb-2 h-6 w-6" />
        <p className="text-ink-700 text-sm">
          Drag photos here, or{" "}
          <button
            type="button"
            className="text-gold-700 font-medium underline"
            onClick={() => inputRef.current?.click()}
          >
            choose files
          </button>
        </p>
        <p className="text-ink-500 mt-1 text-xs">
          JPG / PNG / WebP · up to 10 MB · {MEDIA_RECOMMENDED} or more recommended
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {(media.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((m) => (
            <li
              key={m.id}
              className="border-border group relative overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url ?? ""}
                alt=""
                className="aspect-video w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5">
                <button
                  type="button"
                  onClick={() => makePrimary(m)}
                  aria-label={m.is_primary ? "Cover photo" : "Make cover photo"}
                  className="text-white"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      m.is_primary && "fill-gold-500 text-gold-500",
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  aria-label="Remove photo"
                  className="text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li
              key={p.key}
              className="border-border bg-surface-2 flex aspect-video flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center"
            >
              {p.status === "watermarking" ? (
                <>
                  <Loader2 className="text-ink-500 h-4 w-4 animate-spin" />
                  <span className="text-ink-500 text-[11px]">Watermarking…</span>
                </>
              ) : (
                <>
                  <CircleAlert className="text-danger-700 h-4 w-4" />
                  <span className="text-danger-700 text-[11px]">{p.error}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPending((x) =>
                        x.map((y) =>
                          y.key === p.key
                            ? { ...y, status: "watermarking", error: undefined }
                            : y,
                        ),
                      );
                      void runUpload(p.file, p.key);
                    }}
                  >
                    Retry
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
