import { describe, expect, it } from "vitest";
import {
  addDays,
  daysInMonth,
  eachDay,
  isWithin,
  monthGrid,
  monthLabel,
  shiftMonth,
  weekday,
} from "@/lib/date";

describe("addDays / weekday", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("weekday: 2026-09-15 is a Tuesday", () => {
    expect(weekday("2026-09-15")).toBe(2);
  });
});

describe("daysInMonth", () => {
  it("Feb 2028 is a leap year", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 9)).toBe(30);
  });
});

describe("shiftMonth", () => {
  it("wraps across the year", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, 8)).toEqual({ year: 2027, month: 2 });
  });
});

describe("monthGrid", () => {
  it("is 42 cells, Monday-first, padded from adjacent months", () => {
    const grid = monthGrid(2026, 9); // Sep 2026: 1st is a Tuesday
    expect(grid).toHaveLength(42);
    expect(grid[0].date).toBe("2026-08-31"); // Monday before the 1st
    expect(grid[0].inMonth).toBe(false);
    expect(grid[1]).toEqual({ date: "2026-09-01", inMonth: true });
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
  });
});

describe("isWithin / eachDay", () => {
  it("isWithin is inclusive and order-independent", () => {
    expect(isWithin("2026-09-15", "2026-09-10", "2026-09-20")).toBe(true);
    expect(isWithin("2026-09-10", "2026-09-10", "2026-09-20")).toBe(true);
    expect(isWithin("2026-09-21", "2026-09-10", "2026-09-20")).toBe(false);
    expect(isWithin("2026-09-15", "2026-09-20", "2026-09-10")).toBe(true);
  });
  it("eachDay enumerates the inclusive range", () => {
    expect(eachDay("2026-09-28", "2026-10-02")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });
});

describe("monthLabel", () => {
  it("formats human-readable", () => {
    expect(monthLabel(2026, 9)).toBe("September 2026");
  });
});
