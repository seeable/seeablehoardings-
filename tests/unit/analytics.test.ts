import { describe, expect, it, vi, beforeEach } from "vitest";

// --- mocks -------------------------------------------------------------------
const insert = vi.fn();
const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: (...a: unknown[]) => getSession(...a) },
    from: (table: string) => ({
      insert: (row: unknown) => insert(table, row),
    }),
  }),
}));

import { emitAnalyticsEvent } from "@/lib/analytics/client";

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: null } });
});

describe("emitAnalyticsEvent — Phase 10, mvp-brd.md §14 / database-design.md §44", () => {
  it("inserts the event with the session's user id attached", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    await emitAnalyticsEvent("HOARDING_VIEWED", { hoarding_id: "h1" });
    expect(insert).toHaveBeenCalledWith("analytics_events", {
      event_name: "HOARDING_VIEWED",
      properties: { hoarding_id: "h1" },
      user_id: "u1",
    });
  });

  it("inserts with a null user_id when there is no session (anon browsing)", async () => {
    await emitAnalyticsEvent("PAGE_VIEW", { path: "/discover" });
    expect(insert).toHaveBeenCalledWith("analytics_events", {
      event_name: "PAGE_VIEW",
      properties: { path: "/discover" },
      user_id: null,
    });
  });

  it("defaults properties to {} when omitted", async () => {
    await emitAnalyticsEvent("REQUEST_STARTED");
    expect(insert).toHaveBeenCalledWith(
      "analytics_events",
      expect.objectContaining({ properties: {} }),
    );
  });

  it("never throws when the insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "RLS denied" } });
    await expect(emitAnalyticsEvent("SEARCH")).resolves.toBeUndefined();
  });

  it("never throws when the client itself throws (offline, no session)", async () => {
    getSession.mockRejectedValue(new Error("network down"));
    await expect(emitAnalyticsEvent("FILTER_USED")).resolves.toBeUndefined();
  });
});
