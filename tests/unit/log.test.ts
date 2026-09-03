import { describe, expect, it, vi, afterEach } from "vitest";
import { logRequest } from "@/lib/log";

const asProd = () => {
  const prev = process.env.NODE_ENV;
  // @ts-expect-error test override
  process.env.NODE_ENV = "production";
  return () => {
    // @ts-expect-error test override
    process.env.NODE_ENV = prev;
  };
};

describe("logRequest — PII-safe allow-list (§35.3)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits only allow-listed fields, drops anything else", () => {
    const restore = asProd();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logRequest({
      request_id: "req_01ABC",
      method: "POST",
      path: "/api/v1/notifications/{id}",
      status: 200,
      latency_ms: 12,
      role: "VIEWER",
      user_id: "11111111-1111-1111-1111-111111111111",
      // @ts-expect-error — deliberately smuggling disallowed keys
      email: "leak@example.com",
      password: "hunter2",
      access_token: "eyJ...",
      authorization: "Bearer secret",
    });

    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      request_id: "req_01ABC",
      method: "POST",
      path: "/api/v1/notifications/{id}",
      status: 200,
      role: "VIEWER",
      user_id: "11111111-1111-1111-1111-111111111111",
    });
    const serialized = JSON.stringify(line);
    expect(serialized).not.toContain("leak@example.com");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("eyJ");
    expect(serialized).not.toContain("Bearer");
    restore();
  });

  it("omits empty / null / undefined values", () => {
    const restore = asProd();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logRequest({
      request_id: "req_x",
      method: "GET",
      path: "/api/v1/auth/me",
      status: 401,
      latency_ms: 3,
      error_code: "AUTH_REQUIRED",
      role: undefined,
      user_id: "",
    });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect("role" in line).toBe(false);
    expect("user_id" in line).toBe(false);
    expect(line.error_code).toBe("AUTH_REQUIRED");
    restore();
  });
});
