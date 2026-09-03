"use client";

/**
 * Client-side watermarking — Decision D1 Variant B (seeable_free_first_techstack
 * §16–§18). Resizes to ≤ 2000 px long edge, tiles a low-opacity "SEEABLE"
 * diagonal mark across the frame, and re-encodes as JPEG. The server re-checks
 * the bytes before publishing (api-specification.md §14.2); this is a
 * demo-grade control, not a trust boundary — see the CHANGELOG note.
 */
import { MEDIA_MAX_LONG_EDGE } from "@/lib/inventory/media";

export interface WatermarkResult {
  blob: Blob;
  width: number;
  height: number;
}

export async function watermarkImage(file: File): Promise<WatermarkResult> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(
    1,
    MEDIA_MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();

  // Tiled diagonal watermark.
  const step = Math.max(160, Math.round(Math.min(width, height) / 4));
  const fontSize = Math.max(18, Math.round(step / 7));
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  const reach = Math.hypot(width, height);
  for (let y = -reach; y < reach; y += step) {
    for (let x = -reach; x < reach; x += step * 2.2) {
      ctx.strokeText("SEEABLE", x, y);
      ctx.fillText("SEEABLE", x, y);
    }
  }
  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Failed to encode watermarked image");
  return { blob, width, height };
}

async function loadBitmap(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
