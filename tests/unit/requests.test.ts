import { describe, expect, it } from "vitest";
import {
  durationDays,
  rangesOverlap,
  statusLabel,
} from "@/lib/requests/types";
import { availableActions, slaHoursRemaining } from "@/lib/requests/projection";

describe("rangesOverlap — inclusive-inclusive (mvp-prd §12)", () => {
  it("1–15 Sep and 10–20 Sep overlap", () => {
    expect(rangesOverlap("2026-09-01", "2026-09-15", "2026-09-10", "2026-09-20")).toBe(
      true,
    );
  });
  it("1–15 Sep and 16–20 Sep do NOT overlap (adjacent)", () => {
    expect(rangesOverlap("2026-09-01", "2026-09-15", "2026-09-16", "2026-09-20")).toBe(
      false,
    );
  });
  it("a single shared day counts", () => {
    expect(rangesOverlap("2026-09-15", "2026-09-15", "2026-09-15", "2026-09-15")).toBe(
      true,
    );
  });
});

describe("durationDays — inclusive both ends", () => {
  it("1–15 Sep is 15 days", () => {
    expect(durationDays("2026-09-01", "2026-09-15")).toBe(15);
  });
  it("a one-day request is 1 day", () => {
    expect(durationDays("2026-09-10", "2026-09-10")).toBe(1);
  });
  it("spans a month boundary", () => {
    expect(durationDays("2026-09-28", "2026-10-02")).toBe(5);
  });
});

describe("statusLabel — role-scoped (api-spec §18.4)", () => {
  it("LIVE is 'Campaign Period' for the Viewer", () => {
    expect(statusLabel("LIVE", "VIEWER")).toBe("Campaign Period");
  });
  it("REQUESTED reads differently per role", () => {
    expect(statusLabel("REQUESTED", "VIEWER")).toBe("Pending");
    expect(statusLabel("REQUESTED", "PUBLISHER")).toBe("Awaiting your response");
  });
  it("REJECTED is 'Declined' to the Publisher", () => {
    expect(statusLabel("REJECTED", "PUBLISHER")).toBe("Declined");
    expect(statusLabel("REJECTED", "VIEWER")).toBe("Rejected");
  });
});

describe("availableActions — the state machine, computed once (§20.3)", () => {
  const today = "2026-09-15";

  it("a Viewer never has an action", () => {
    for (const s of ["REQUESTED", "CONFIRMED", "LIVE", "COMPLETED"] as const) {
      expect(availableActions(s, "VIEWER", "2026-09-01", today)).toEqual([]);
    }
  });

  it("Publisher on a pending request can accept or reject", () => {
    expect(availableActions("REQUESTED", "PUBLISHER", "2026-10-01", today)).toEqual([
      "ACCEPT",
      "REJECT",
    ]);
  });

  it("Publisher on a confirmed future request can only set the amount", () => {
    expect(availableActions("CONFIRMED", "PUBLISHER", "2026-10-01", today)).toEqual([
      "SET_AMOUNT_AGREED",
    ]);
  });

  it("Publisher on a confirmed request past its start can also complete it", () => {
    expect(availableActions("CONFIRMED", "PUBLISHER", "2026-09-10", today)).toEqual([
      "COMPLETE",
      "SET_AMOUNT_AGREED",
    ]);
  });

  it("Publisher on a LIVE request can complete it", () => {
    expect(availableActions("LIVE", "PUBLISHER", "2026-09-10", today)).toContain(
      "COMPLETE",
    );
  });

  it("terminal states offer nothing to act on", () => {
    expect(availableActions("REJECTED", "PUBLISHER", "2026-09-01", today)).toEqual([]);
    expect(availableActions("EXPIRED", "PUBLISHER", "2026-09-01", today)).toEqual([]);
  });

  it("Admin can only COMPLETE, and only once started", () => {
    expect(availableActions("CONFIRMED", "ADMIN", "2026-10-01", today)).toEqual([]);
    expect(availableActions("CONFIRMED", "ADMIN", "2026-09-10", today)).toEqual([
      "COMPLETE",
    ]);
    expect(availableActions("LIVE", "ADMIN", "2026-09-10", today)).toEqual(["COMPLETE"]);
  });
});

describe("slaHoursRemaining", () => {
  it("is positive before the deadline, negative after", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    expect(
      slaHoursRemaining("2026-09-01T12:00:00Z", now),
    ).toBeCloseTo(12, 1);
    expect(
      slaHoursRemaining("2026-08-31T18:00:00Z", now),
    ).toBeCloseTo(-6, 1);
  });
  it("is null when there is no deadline", () => {
    expect(slaHoursRemaining(null, new Date())).toBeNull();
  });
});
