import { describe, expect, it } from "vitest";
import {
  ErrorCode,
  ERROR_STATUS,
  ERROR_MESSAGE,
  ApiError,
  resolveError,
} from "@/lib/api/errors";

const codes = Object.values(ErrorCode);

describe("error taxonomy (§8.3 / §8.4)", () => {
  it("every code has a 4xx/5xx status and a safe message", () => {
    for (const c of codes) {
      expect(ERROR_STATUS[c], `${c} status`).toBeGreaterThanOrEqual(400);
      expect(ERROR_STATUS[c], `${c} status`).toBeLessThan(600);
      expect(ERROR_MESSAGE[c], `${c} message`).toBeTruthy();
    }
  });

  it("no message leaks SQL / identifiers / a stack marker", () => {
    for (const c of codes) {
      const m = ERROR_MESSAGE[c].toLowerCase();
      expect(m).not.toMatch(/select |insert |sqlstate|pg_|\bat \/|undefined/);
    }
  });

  it("ApiError.of uses the code's default status + message", () => {
    const e = ApiError.of("REQUEST_DATE_CONFLICT");
    expect(e.status).toBe(409);
    expect(e.message).toBe(ERROR_MESSAGE.REQUEST_DATE_CONFLICT);
    expect(e.details).toEqual({});
  });

  it("ApiError.of accepts an override message + details", () => {
    const e = ApiError.of("HOARDING_INCOMPLETE_ATTRIBUTES", "custom", {
      missing_attribute_keys: ["illumination"],
    });
    expect(e.message).toBe("custom");
    expect(e.details).toEqual({ missing_attribute_keys: ["illumination"] });
  });

  it("resolveError falls back to INTERNAL_ERROR for an unknown code", () => {
    expect(resolveError("NOPE_NOT_A_CODE")).toEqual({
      status: 500,
      message: ERROR_MESSAGE.INTERNAL_ERROR,
    });
  });

  it("the §8.5 SQLSTATE targets all exist", () => {
    for (const c of [
      "REQUEST_DATE_CONFLICT",
      "REQUEST_DUPLICATE_PENDING",
      "HOARDING_HAS_REQUEST_HISTORY",
      "VALIDATION_ERROR",
      "FORBIDDEN",
      "ADMIN_ONLY",
      "RESOURCE_NOT_FOUND",
      "SERVICE_UNAVAILABLE",
    ] as const) {
      expect(ErrorCode[c]).toBe(c);
    }
  });
});
