import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

// The facade unconditionally builds a Supabase server client (even for a
// public route with no auth check), and that client's cookie access needs a
// real Next.js request-scope this test harness doesn't provide. The CSRF
// tests below only exercise the Origin check ahead of it, so a harmless
// stub is enough — no test here reads from the returned "client".
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));
import {
  parsePagination,
  paginationMeta,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/lib/api/pagination";
import { zodFields } from "@/lib/api/validation";
import { consume, resetRateLimits } from "@/lib/api/ratelimit";
import { requireRow, forbidNotOwner } from "@/lib/api/authz";
import { ApiError } from "@/lib/api/errors";
import { defineRoute } from "@/lib/api/facade";

const sp = (qs: string) => new URLSearchParams(qs);

describe("parsePagination (§9)", () => {
  it("defaults to page 1, DEFAULT_PAGE_SIZE", () => {
    const p = parsePagination(sp(""));
    expect(p).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE, from: 0 });
    expect(p.to).toBe(DEFAULT_PAGE_SIZE - 1);
  });

  it("computes the zero-based inclusive range for page 3", () => {
    const p = parsePagination(sp("page=3&pageSize=20"));
    expect(p.from).toBe(40);
    expect(p.to).toBe(59);
  });

  it.each([
    "page=0",
    "page=-1",
    "pageSize=0",
    "pageSize=101",
    "page=1.5",
    "pageSize=abc",
  ])("rejects %s with INVALID_PAGINATION (400)", (qs) => {
    try {
      parsePagination(sp(qs));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("INVALID_PAGINATION");
      expect((e as ApiError).status).toBe(400);
    }
  });

  it("accepts the max page size", () => {
    expect(parsePagination(sp(`pageSize=${MAX_PAGE_SIZE}`)).pageSize).toBe(
      MAX_PAGE_SIZE,
    );
  });
});

describe("paginationMeta (§9.2)", () => {
  it("57 rows / 20 per page -> 3 pages, page 1 has next not previous", () => {
    expect(paginationMeta(57, { page: 1, pageSize: 20 })).toEqual({
      page: 1,
      page_size: 20,
      total: 57,
      total_pages: 3,
      has_next: true,
      has_previous: false,
    });
  });

  it("0 rows -> 0 pages, no next/previous (§9.2)", () => {
    expect(paginationMeta(0, { page: 1, pageSize: 20 })).toMatchObject({
      total_pages: 0,
      has_next: false,
      has_previous: false,
    });
  });

  it("a page past the end still reports has_previous (§9.3)", () => {
    expect(paginationMeta(57, { page: 9, pageSize: 20 })).toMatchObject({
      has_next: false,
      has_previous: true,
    });
  });
});

describe("zodFields (§8.2 — report every failed field)", () => {
  it("flattens nested + array paths", () => {
    const schema = z.object({
      email: z.string().email(),
      blocks: z.array(z.object({ end_date: z.string().min(1) })),
    });
    const r = schema.safeParse({ email: "nope", blocks: [{ end_date: "" }] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const f = zodFields(r.error);
      expect(Object.keys(f)).toEqual(
        expect.arrayContaining(["email", "blocks[0].end_date"]),
      );
    }
  });

  it("reports ALL failures, not just the first", () => {
    const schema = z.object({ a: z.string(), b: z.number() }).strict();
    const r = schema.safeParse({ a: 1, b: "x" });
    if (!r.success)
      expect(Object.keys(zodFields(r.error)).length).toBeGreaterThanOrEqual(2);
  });
});

describe("rate-limit token bucket", () => {
  beforeEach(() => resetRateLimits());

  it("allows `perMinute` calls then throws RATE_LIMITED with Retry-After", () => {
    for (let i = 0; i < 5; i++) consume("k", { perMinute: 5, burst: 5 });
    try {
      consume("k", { perMinute: 5, burst: 5 });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiError).code).toBe("RATE_LIMITED");
      expect((e as ApiError).status).toBe(429);
      expect(
        (e as ApiError).details.retry_after_seconds,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("keys are independent", () => {
    for (let i = 0; i < 3; i++) consume("a", { perMinute: 3, burst: 3 });
    expect(() => consume("b", { perMinute: 3, burst: 3 })).not.toThrow();
  });
});

describe("CSRF — same-origin check on mutating requests (Phase 11, §33)", () => {
  // A minimal public route (no auth/body) so a 200 unambiguously means the
  // request cleared the Origin check and reached the handler.
  const route = defineRoute({
    path: "/api/v1/_test",
    handler: async () => ({ data: { ok: true } }),
  });

  async function call(method: string, headers: Record<string, string> = {}) {
    const req = new NextRequest("http://localhost:3000/api/v1/_test", {
      method,
      headers,
    });
    const res = await route(req, undefined);
    return { status: res.status, body: (await res.json()) as unknown };
  }

  it("rejects POST with no Origin or Referer", async () => {
    const { status, body } = await call("POST");
    expect(status).toBe(403);
    expect((body as { error: { code: string } }).error.code).toBe(
      "FORBIDDEN_ORIGIN",
    );
  });

  it("rejects POST from a foreign Origin", async () => {
    const { status, body } = await call("POST", {
      origin: "https://evil.example.com",
    });
    expect(status).toBe(403);
    expect((body as { error: { code: string } }).error.code).toBe(
      "FORBIDDEN_ORIGIN",
    );
  });

  it("rejects DELETE from a foreign Origin", async () => {
    const { status } = await call("DELETE", {
      origin: "https://evil.example.com",
    });
    expect(status).toBe(403);
  });

  it("allows POST whose Origin matches the request's own host", async () => {
    const { status } = await call("POST", { origin: "http://localhost:3000" });
    expect(status).toBe(200);
  });

  it("falls back to Referer when Origin is absent", async () => {
    const { status } = await call("PATCH", {
      referer: "http://localhost:3000/some/page",
    });
    expect(status).toBe(200);
  });

  it("does not check Origin on GET", async () => {
    const { status } = await call("GET", {
      origin: "https://evil.example.com",
    });
    expect(status).toBe(200);
  });
});

describe("403 vs 404 helpers (§6.5)", () => {
  it("requireRow: null -> RESOURCE_NOT_FOUND (404)", () => {
    expect(() => requireRow(null)).toThrowError(
      expect.objectContaining({ code: "RESOURCE_NOT_FOUND", status: 404 }),
    );
  });
  it("requireRow: a row passes through", () => {
    expect(requireRow({ id: "x" })).toEqual({ id: "x" });
  });
  it("requireRow: custom code", () => {
    expect(() => requireRow(undefined, "HOARDING_NOT_FOUND")).toThrowError(
      expect.objectContaining({ code: "HOARDING_NOT_FOUND" }),
    );
  });
  it("forbidNotOwner -> FORBIDDEN_NOT_OWNER (403)", () => {
    expect(() => forbidNotOwner()).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN_NOT_OWNER", status: 403 }),
    );
  });
});
