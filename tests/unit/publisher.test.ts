import { describe, expect, it } from "vitest";
import { deriveSummary, selectNeedsAttention } from "@/lib/publisher/summary";

const listing = (over: Partial<Parameters<typeof deriveSummary>[0][number]> = {}) => ({
  approval_status: "APPROVED",
  is_paused: false,
  is_delisted: false,
  ...over,
});
const request = (over: Partial<Parameters<typeof deriveSummary>[1][number]> = {}) => ({
  status: "REQUESTED",
  amount_agreed: null as number | null,
  confirmed_at: null as string | null,
  ...over,
});

describe("deriveSummary — PB-01 counts (api-spec §22.6)", () => {
  it("live_in_search counts only APPROVED and not paused/delisted", () => {
    const s = deriveSummary(
      [
        listing(),
        listing({ is_paused: true }),
        listing({ is_delisted: true }),
        listing({ approval_status: "DRAFT" }),
        listing({ approval_status: "PENDING_REVIEW" }),
        listing({ approval_status: "REJECTED" }),
      ],
      [],
      "VERIFIED",
      false,
    );
    expect(s.listings).toEqual({
      total: 6,
      live_in_search: 1,
      pending_approval: 1,
      draft: 1,
      rejected: 1,
    });
  });

  it("confirmed_value sums amount_agreed only where recorded, over held requests", () => {
    const s = deriveSummary(
      [],
      [
        request({ status: "CONFIRMED", amount_agreed: 50000 }),
        request({ status: "LIVE", amount_agreed: null }),
        request({ status: "COMPLETED", amount_agreed: 25000 }),
        request({ status: "REQUESTED", amount_agreed: 99999 }), // not held → ignored
      ],
      "VERIFIED",
      false,
    );
    expect(s.confirmed_value.amount).toBe(75000);
    expect(s.confirmed_value.basis).toMatch(/amount_agreed/);
  });

  it("confirmed_this_month counts held requests confirmed in the current IST month", () => {
    const now = new Date("2026-09-15T06:00:00Z");
    const s = deriveSummary(
      [],
      [
        request({ status: "CONFIRMED", confirmed_at: "2026-09-02T10:00:00Z" }),
        request({ status: "LIVE", confirmed_at: "2026-09-10T10:00:00Z" }),
        request({ status: "COMPLETED", confirmed_at: "2026-08-30T10:00:00Z" }),
        request({ status: "REJECTED", confirmed_at: null }),
      ],
      "VERIFIED",
      false,
      now,
    );
    expect(s.confirmed_this_month).toBe(2);
  });

  it("carries verification_status and suspended through", () => {
    const s = deriveSummary([], [], "PENDING", true);
    expect(s.verification_status).toBe("PENDING");
    expect(s.suspended).toBe(true);
  });
});

describe("selectNeedsAttention — PB-01", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const pending = (id: string, hoursOut: number) => ({
    id,
    hoarding: { title: `Listing ${id}` },
    viewer: { full_name: "Aarav Patel" },
    sla_deadline: new Date(now.getTime() + hoursOut * 3_600_000).toISOString(),
  });

  it("includes requests within a day of their SLA, most urgent first", () => {
    const items = selectNeedsAttention(
      [pending("far", 72), pending("soon", 2), pending("mid", 10)],
      [],
      now,
    );
    expect(items.map((i) => i.id)).toEqual(["soon", "mid"]);
    expect(items[0].kind).toBe("sla");
  });

  it("surfaces an overdue request and labels it", () => {
    const items = selectNeedsAttention([pending("late", -3)], [], now);
    expect(items[0].detail).toMatch(/overdue/);
  });

  it("appends Admin-rejected listings with their reason and edit link", () => {
    const items = selectNeedsAttention(
      [],
      [{ id: "h1", title: "ORR Unipole", rejection_reason: "Photos too dark" }],
      now,
    );
    expect(items[0]).toMatchObject({
      kind: "rejected_listing",
      href: "/publisher/hoardings/h1/edit",
    });
    expect(items[0].detail).toMatch(/Photos too dark/);
  });
});
