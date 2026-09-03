import { describe, expect, it } from "vitest";
import { newRequestId } from "@/lib/api/envelope";
import { ApiError, ERROR_STATUS } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

describe("foundation smoke", () => {
  it("generates prefixed, unique request ids", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).toMatch(/^req_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a).not.toEqual(b);
  });

  it("maps every error code to an HTTP status", () => {
    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(ApiError.of(code as keyof typeof ERROR_STATUS, "x").status).toBe(
        status,
      );
    }
  });

  it("merges tailwind classes with conflict resolution", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-ink-900", false && "hidden", "font-semibold")).toBe(
      "text-ink-900 font-semibold",
    );
  });
});
