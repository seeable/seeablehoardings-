import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

/**
 * Phase 11 (IMPLEMENTATION-PLAN.md §Phase 11 "CSP headers; frame-ancestors;
 * HTTPS-only"). Exercises the actual `headers()` function next.config.ts
 * ships, rather than re-typing the expected values — a change to the real
 * config is what this test would catch.
 */
describe("security headers (next.config.ts)", () => {
  async function headerMap() {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === "/:path*")!;
    return Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
  }

  it("sets a restrictive Content-Security-Policy", async () => {
    const h = await headerMap();
    const csp = h["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // The Supabase project and MapTiler are the only external network hosts.
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("https://api.maptiler.com");
  });

  it("denies framing and sniffing", async () => {
    const h = await headerMap();
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sends HSTS", async () => {
    const h = await headerMap();
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
  });

  it("does not grant camera/microphone/payment", async () => {
    const h = await headerMap();
    const pp = h["Permissions-Policy"];
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("payment=()");
  });
});
