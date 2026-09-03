import { describe, expect, it } from "vitest";
import {
  formatINR,
  formatPrice,
  formatDate,
  formatDateRange,
  formatRelative,
  formatCountdown,
} from "@/lib/format";

describe("formatINR — Indian digit grouping (docs/07 §25)", () => {
  it("groups lakhs correctly", () => {
    expect(formatINR(85000)).toBe("₹85,000");
    expect(formatINR(140000)).toBe("₹1,40,000");
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
  });
  it("no paise", () => {
    expect(formatINR(1499.99)).toBe("₹1,500");
  });
  it("null / NaN → em dash", () => {
    expect(formatINR(null)).toBe("—");
    expect(formatINR(undefined)).toBe("—");
    expect(formatINR(Number.NaN)).toBe("—");
  });
});

describe("formatPrice", () => {
  it("appends the lowercased unit", () => {
    expect(formatPrice(85000, "MONTH")).toBe("₹85,000/month");
    expect(formatPrice(5000, "DAY")).toBe("₹5,000/day");
  });
  it("drops the unit when the price is missing", () => {
    expect(formatPrice(null, "MONTH")).toBe("—");
  });
});

describe("formatDate — absolute, month name, IST", () => {
  it("renders a bare date on its own calendar day", () => {
    expect(formatDate("2026-09-15")).toBe("15 Sep 2026");
  });
  it("renders a late-evening UTC timestamp as the IST day", () => {
    // 2026-09-15T20:00Z === 2026-09-16 01:30 IST
    expect(formatDate("2026-09-15T20:00:00Z")).toBe("16 Sep 2026");
  });
  it("null → em dash", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatDateRange", () => {
  it("shows the year once when both ends share it", () => {
    expect(formatDateRange("2026-09-15", "2026-09-30")).toBe(
      "15 Sep – 30 Sep 2026",
    );
  });
  it("shows both years when they differ", () => {
    expect(formatDateRange("2026-12-20", "2027-01-05")).toBe(
      "20 Dec 2026 – 5 Jan 2027",
    );
  });
});

describe("formatRelative / formatCountdown (supplementary only)", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  it("relative past", () => {
    expect(formatRelative("2026-09-15T11:59:30Z", now)).toBe("just now");
    expect(formatRelative("2026-09-15T11:30:00Z", now)).toBe("30 min ago");
    expect(formatRelative("2026-09-15T09:00:00Z", now)).toBe("3 h ago");
    expect(formatRelative("2026-09-13T12:00:00Z", now)).toBe("2 days ago");
  });
  it("countdown to a future deadline", () => {
    expect(formatCountdown("2026-09-15T12:25:00Z", now)).toBe("in 25 min");
    expect(formatCountdown("2026-09-15T15:00:00Z", now)).toBe("in 3 h");
    expect(formatCountdown("2026-09-15T11:00:00Z", now)).toBe("overdue");
  });
});
