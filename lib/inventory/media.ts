/**
 * Server-side media validation — api-specification.md §14.4.
 * The bytes are validated on the way into the public bucket: MIME is sniffed
 * from magic bytes (never the declared header), size and pixel bounds checked.
 * This is the only integrity control Variant B watermarking can have (§14.2).
 */

export const PUBLIC_BUCKET = "hoarding-public";
export const PRIVATE_BUCKET = "hoarding-private";

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10 MB (§14.4)
export const MEDIA_MAX_LONG_EDGE = 2000;
export const MEDIA_MIN_WIDTH = 640;
export const MEDIA_MIN_HEIGHT = 480;
export const MEDIA_MAX_PER_LISTING = 12;

/** DB gate (`submit_hoarding_for_review`) is "at least one watermarked" (§14.4).
 *  The wizard nudges toward 3 (docs/04 PB-03 Step 4) but that isn't a hard gate. */
export const MEDIA_MIN_TO_SUBMIT = 1;
export const MEDIA_RECOMMENDED = 3;

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionFor(mime: string): string {
  return EXT[mime] ?? "bin";
}

/** Sniff the real image type from the first bytes. Returns null if unrecognised. */
export function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  return null;
}

/** Best-effort pixel dimensions from an image header. null when unparseable. */
export function imageDimensions(
  buf: Uint8Array,
  mime: string,
): { width: number; height: number } | null {
  try {
    if (mime === "image/png") {
      // IHDR is the first chunk: width @ byte 16, height @ byte 20 (big-endian)
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      return { width: dv.getUint32(16), height: dv.getUint32(20) };
    }
    if (mime === "image/jpeg") {
      let i = 2;
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      while (i < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        ) {
          return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
        }
        const len = dv.getUint16(i + 2);
        if (len < 2) return null;
        i += 2 + len;
      }
      return null;
    }
    if (mime === "image/webp") {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const fourcc = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
      if (fourcc === "VP8 ") {
        // lossy: dimensions at offset 26/28, 14-bit
        return {
          width: dv.getUint16(26, true) & 0x3fff,
          height: dv.getUint16(28, true) & 0x3fff,
        };
      }
      if (fourcc === "VP8L") {
        const b = dv.getUint32(21, true);
        return {
          width: (b & 0x3fff) + 1,
          height: ((b >> 14) & 0x3fff) + 1,
        };
      }
      if (fourcc === "VP8X") {
        const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
        const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
        return { width: w + 1, height: h + 1 };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** `hoarding-public/{hoarding_id}/{media_id}-watermarked.{ext}` (§14.4). */
export function publicStoragePath(
  hoardingId: string,
  mediaId: string,
  mime: string,
): string {
  return `${hoardingId}/${mediaId}-watermarked.${extensionFor(mime)}`;
}
