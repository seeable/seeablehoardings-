import { describe, expect, it } from "vitest";
import { pgErrorToApiError, seeableCodeOf } from "@/lib/db/errors";
import { ERROR_STATUS } from "@/lib/api/errors";

describe("pgErrorToApiError — D7 SEEABLE_CODE tag", () => {
  it("maps a tagged 55000 to its specific code + status", () => {
    const e = pgErrorToApiError({
      code: "55000",
      message: "These dates are no longer available",
      details: "SEEABLE_CODE=REQUEST_DATE_CONFLICT",
    });
    expect(e.code).toBe("REQUEST_DATE_CONFLICT");
    expect(e.status).toBe(409);
  });

  it("maps a tagged 42501 to ADMIN_ONLY (403)", () => {
    const e = pgErrorToApiError({
      code: "42501",
      message: "Admin access required",
      details: "SEEABLE_CODE=ADMIN_ONLY",
    });
    expect(e.code).toBe("ADMIN_ONLY");
    expect(e.status).toBe(403);
  });

  it("maps a tagged P0002 to *_NOT_FOUND (404)", () => {
    const e = pgErrorToApiError({
      code: "P0002",
      message: "Request not found",
      details: "SEEABLE_CODE=REQUEST_NOT_FOUND",
    });
    expect(e.code).toBe("REQUEST_NOT_FOUND");
    expect(e.status).toBe(404);
  });

  it("maps HOARDING_EDIT_FROZEN from a trigger", () => {
    const e = pgErrorToApiError({
      code: "55000",
      message:
        "Cannot edit core listing details while a request is pending (OWNER-003)",
      details: "SEEABLE_CODE=HOARDING_EDIT_FROZEN",
    });
    expect(e.code).toBe("HOARDING_EDIT_FROZEN");
    expect(e.status).toBe(409);
  });
});

describe("pgErrorToApiError — SQLSTATE fallback (no tag)", () => {
  it("23P01 exclusion_violation -> REQUEST_DATE_CONFLICT", () => {
    const e = pgErrorToApiError({
      code: "23P01",
      message:
        'conflicting key value violates exclusion constraint "requests_no_overlapping_confirmed"',
    });
    expect(e.code).toBe("REQUEST_DATE_CONFLICT");
    expect(e.status).toBe(409);
  });

  it("23505 on the VIEWER-002 index -> REQUEST_DUPLICATE_PENDING", () => {
    const e = pgErrorToApiError({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "requests_one_pending_per_viewer_hoarding"',
    });
    expect(e.code).toBe("REQUEST_DUPLICATE_PENDING");
  });

  it("23505 on some other unique index -> VALIDATION_ERROR (422)", () => {
    const e = pgErrorToApiError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "profiles_pkey"',
    });
    expect(e.code).toBe("VALIDATION_ERROR");
    expect(e.status).toBe(422);
  });

  it("23503 foreign_key_violation -> HOARDING_HAS_REQUEST_HISTORY", () => {
    const e = pgErrorToApiError({
      code: "23503",
      message: 'update or delete on table "hoardings"',
    });
    expect(e.code).toBe("HOARDING_HAS_REQUEST_HISTORY");
  });

  it("23514 check_violation -> VALIDATION_ERROR", () => {
    const e = pgErrorToApiError({
      code: "23514",
      message:
        'new row violates check constraint "hoardings_price_positive_check"',
    });
    expect(e.code).toBe("VALIDATION_ERROR");
  });

  it("bare 42501 -> FORBIDDEN, or ADMIN_ONLY when the text says admin", () => {
    expect(
      pgErrorToApiError({
        code: "42501",
        message: "permission denied for table x",
      }).code,
    ).toBe("FORBIDDEN");
    expect(
      pgErrorToApiError({ code: "42501", message: "Admin access required" })
        .code,
    ).toBe("ADMIN_ONLY");
  });

  it("connection-class SQLSTATEs -> SERVICE_UNAVAILABLE (503)", () => {
    const e = pgErrorToApiError({
      code: "08006",
      message: "connection failure",
    });
    expect(e.code).toBe("SERVICE_UNAVAILABLE");
    expect(e.status).toBe(503);
  });

  it("PGRST116 (zero rows) -> RESOURCE_NOT_FOUND", () => {
    expect(pgErrorToApiError({ code: "PGRST116", message: "" }).code).toBe(
      "RESOURCE_NOT_FOUND",
    );
  });
});

describe("pgErrorToApiError — safety", () => {
  it("null / undefined / unknown -> INTERNAL_ERROR, never throws", () => {
    expect(pgErrorToApiError(null).code).toBe("INTERNAL_ERROR");
    expect(pgErrorToApiError(undefined).code).toBe("INTERNAL_ERROR");
    expect(pgErrorToApiError({ code: "XX999", message: "weird" }).code).toBe(
      "INTERNAL_ERROR",
    );
  });

  it("every code the mapper can produce has a known HTTP status", () => {
    const samples = [
      { code: "55000", details: "SEEABLE_CODE=REQUEST_STATE_CONFLICT" },
      { code: "55000", details: "SEEABLE_CODE=PUBLISHER_SUSPENDED" },
      { code: "55000", details: "SEEABLE_CODE=DATE_RANGE_IN_PAST" },
      { code: "23P01", message: "requests_no_overlapping_confirmed" },
      { code: "P0002", details: "SEEABLE_CODE=HOARDING_NOT_FOUND" },
    ];
    for (const s of samples) {
      const e = pgErrorToApiError(s);
      expect(
        ERROR_STATUS[e.code as keyof typeof ERROR_STATUS] ?? e.status,
      ).toBeGreaterThanOrEqual(400);
      expect(e.status).toBeLessThan(600);
    }
  });

  it("seeableCodeOf pulls the tag or returns null", () => {
    expect(
      seeableCodeOf({ details: "SEEABLE_CODE=REQUEST_DATE_CONFLICT" }),
    ).toBe("REQUEST_DATE_CONFLICT");
    expect(seeableCodeOf({ message: "no tag here" })).toBeNull();
    expect(seeableCodeOf(null)).toBeNull();
  });
});
