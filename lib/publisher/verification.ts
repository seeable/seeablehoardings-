/**
 * PB-08 verification-document rules. The document lands in `publisher-private`
 * (no storage policy — service-role write only, Admin-only read). The route
 * re-sniffs the bytes; the browser's declared type is not trusted.
 */
import { sniffImageMime } from "@/lib/inventory/media";

export const DOC_BUCKET = "publisher-private";
export const DOC_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const DOC_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Magic-byte sniff for the allowed document types, or null. */
export function sniffDocumentMime(bytes: Uint8Array): string | null {
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf"; // %PDF
  }
  return sniffImageMime(bytes);
}

export function documentStoragePath(
  publisherId: string,
  mime: string,
  stamp: string,
): string {
  return `${publisherId}/verification-${stamp}.${EXT[mime] ?? "bin"}`;
}
