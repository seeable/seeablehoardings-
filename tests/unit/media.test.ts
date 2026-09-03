import { describe, expect, it } from "vitest";
import {
  imageDimensions,
  publicStoragePath,
  sniffImageMime,
} from "@/lib/inventory/media";

const jpeg = () => {
  // SOI, APP0 (len 8), then SOF0: len 0x0011, precision 08, H 0x0258(600), W 0x0320(800)
  const b = new Uint8Array(24);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x08, 0, 0, 0, 0, 0, 0], 0);
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20], 12);
  return b;
};
const png = () => {
  const b = new Uint8Array(26);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR width @16 = 1024, height @20 = 768
  new DataView(b.buffer).setUint32(16, 1024);
  new DataView(b.buffer).setUint32(20, 768);
  return b;
};
const webp = () => {
  const b = new Uint8Array(32);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
  new DataView(b.buffer).setUint16(26, 1280 & 0x3fff, true);
  new DataView(b.buffer).setUint16(28, 720 & 0x3fff, true);
  return b;
};

describe("sniffImageMime — magic bytes, not the declared header", () => {
  it("recognises JPEG / PNG / WebP", () => {
    expect(sniffImageMime(jpeg())).toBe("image/jpeg");
    expect(sniffImageMime(png())).toBe("image/png");
    expect(sniffImageMime(webp())).toBe("image/webp");
  });
  it("rejects an unknown / spoofed blob", () => {
    expect(sniffImageMime(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
    // a text file claiming to be a JPEG
    expect(sniffImageMime(new TextEncoder().encode("GIF89a not a jpeg"))).toBeNull();
  });
});

describe("imageDimensions", () => {
  it("reads JPEG SOF0 dimensions", () => {
    expect(imageDimensions(jpeg(), "image/jpeg")).toEqual({ width: 800, height: 600 });
  });
  it("reads the PNG IHDR", () => {
    expect(imageDimensions(png(), "image/png")).toEqual({ width: 1024, height: 768 });
  });
  it("reads a lossy WebP VP8 header", () => {
    expect(imageDimensions(webp(), "image/webp")).toEqual({ width: 1280, height: 720 });
  });
  it("returns null rather than throwing on garbage", () => {
    expect(imageDimensions(new Uint8Array(4), "image/jpeg")).toBeNull();
  });
});

describe("publicStoragePath (§14.4)", () => {
  it("is {hoarding}/{media}-watermarked.{ext}, bucket implied", () => {
    expect(
      publicStoragePath("aaaa", "bbbb", "image/jpeg"),
    ).toBe("aaaa/bbbb-watermarked.jpg");
    expect(publicStoragePath("h", "m", "image/webp")).toBe("h/m-watermarked.webp");
  });
});
