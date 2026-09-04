import { describe, expect, it } from "vitest";
import {
  dashboardFromSummary,
  describeAction,
  kpisFromRow,
  listingDisplayStatus,
  listingSecondaryAnnotation,
  reviewFlags,
  tallyListingCounts,
} from "@/lib/admin/projection";

const summary = {
  total_publishers: 19,
  verified_publishers: 14,
  active_publishers: 12,
  pending_verifications: 3,
  total_listings: 63,
  approved_listings: 55,
  live_in_search_listings: 52,
  pending_listings: 4,
  total_requests: 210,
  confirmed_requests: 88,
  live_campaigns: 9,
  request_to_confirmation_rate: 41.9,
};

describe("dashboardFromSummary — api-spec §24.4 / AD-01", () => {
  it("maps every metric into the response shape", () => {
    const d = dashboardFromSummary(summary, "2026-09-04T10:00:00Z");
    expect(d.listings).toEqual({
      total: 63,
      pending_approval: 4,
      approved: 55,
      live_in_search: 52,
    });
    expect(d.requests).toEqual({
      total: 210,
      confirmed: 88,
      live: 9,
      confirmation_rate_pct: 41.9,
    });
    expect(d.publishers).toEqual({
      total: 19,
      verified: 14,
      active: 12,
      pending_verification: 3,
    });
    expect(d.generated_at).toBe("2026-09-04T10:00:00Z");
  });

  it("coerces a null confirmation rate to 0 (no requests yet)", () => {
    const d = dashboardFromSummary(
      { ...summary, request_to_confirmation_rate: null as unknown as number },
      "x",
    );
    expect(d.requests.confirmation_rate_pct).toBe(0);
  });
});

describe("kpisFromRow — mvp-brd.md §14 (Phase 10)", () => {
  const row = {
    publishers_onboarded: 19,
    publishers_verified: 14,
    live_approved_listings: 52,
    viewer_accounts: 140,
    requests_submitted: 210,
    request_to_confirmation_rate: 41.9,
    median_publisher_response_hours: 6.5,
    repeat_viewers: 22,
    repeat_publishers: 5,
  };

  it("maps every KPI into the response shape", () => {
    const k = kpisFromRow(row, "2026-09-04T10:00:00Z");
    expect(k).toEqual({
      publishers_onboarded: 19,
      publishers_verified: 14,
      live_approved_listings: 52,
      viewer_accounts: 140,
      requests_submitted: 210,
      request_to_confirmation_rate_pct: 41.9,
      median_publisher_response_hours: 6.5,
      repeat_viewers: 22,
      repeat_publishers: 5,
      generated_at: "2026-09-04T10:00:00Z",
    });
  });

  it("coerces a null confirmation rate to 0 (no requests yet)", () => {
    const k = kpisFromRow(
      { ...row, request_to_confirmation_rate: null as unknown as number },
      "x",
    );
    expect(k.request_to_confirmation_rate_pct).toBe(0);
  });

  it("keeps a null median response time as null (no request decided yet)", () => {
    const k = kpisFromRow(
      { ...row, median_publisher_response_hours: null as unknown as number },
      "x",
    );
    expect(k.median_publisher_response_hours).toBeNull();
  });
});

describe("listingDisplayStatus + secondary annotation — INVENTORY-003", () => {
  it("delisted wins over every approval state", () => {
    const h = {
      approval_status: "APPROVED",
      is_paused: true,
      is_delisted: true,
      rejection_reason: null,
      delist_reason: "Site removed",
    };
    expect(listingDisplayStatus(h)).toBe("DELISTED");
    expect(listingSecondaryAnnotation(h)).toBe("Delisted by SEEABLE — Site removed");
  });

  it("an approved-but-paused listing is shown as PAUSED with the reason", () => {
    const h = {
      approval_status: "APPROVED",
      is_paused: true,
      is_delisted: false,
      rejection_reason: null,
      delist_reason: null,
    };
    expect(listingDisplayStatus(h)).toBe("PAUSED");
    expect(listingSecondaryAnnotation(h)).toMatch(/Paused by the Publisher/);
  });

  it("a rejected listing carries its reason", () => {
    const h = {
      approval_status: "REJECTED",
      is_paused: false,
      is_delisted: false,
      rejection_reason: "Photos too dark",
      delist_reason: null,
    };
    expect(listingDisplayStatus(h)).toBe("REJECTED");
    expect(listingSecondaryAnnotation(h)).toBe("Rejected — Photos too dark");
  });

  it("a plain approved listing has no annotation", () => {
    const h = {
      approval_status: "APPROVED",
      is_paused: false,
      is_delisted: false,
      rejection_reason: null,
      delist_reason: null,
    };
    expect(listingSecondaryAnnotation(h)).toBeNull();
  });
});

describe("reviewFlags — INVENTORY-002 + the one defensive check, nothing more", () => {
  it("flags incomplete Site Intelligence as INFO (non-blocking)", () => {
    const flags = reviewFlags(
      { site_intelligence_complete: false },
      { verification_status: "VERIFIED", suspended: false },
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      code: "SITE_INTELLIGENCE_INCOMPLETE",
      severity: "INFO",
    });
  });

  it("warns when the submitting Publisher is no longer verified / is suspended", () => {
    const flags = reviewFlags(
      { site_intelligence_complete: true },
      { verification_status: "PENDING", suspended: true },
    );
    expect(flags.map((f) => f.code)).toEqual([
      "PUBLISHER_UNVERIFIED",
      "PUBLISHER_SUSPENDED",
    ]);
    expect(flags.every((f) => f.severity === "WARN")).toBe(true);
  });

  it("a clean, verified submission has no flags", () => {
    expect(
      reviewFlags(
        { site_intelligence_complete: true },
        { verification_status: "VERIFIED", suspended: false },
      ),
    ).toEqual([]);
  });
});

describe("describeAction — AD-05 plain-language feed", () => {
  it("writes a listing action as the Publisher's listing", () => {
    expect(
      describeAction({
        action_type: "LISTING_APPROVED",
        target_hoarding_title: "Silk Board Gantry",
        target_publisher_label: "Namma Outdoor Media",
        reason: null,
      }),
    ).toBe('Namma Outdoor Media\'s listing "Silk Board Gantry" was approved.');
  });

  it("appends the reason for a rejection", () => {
    expect(
      describeAction({
        action_type: "LISTING_REJECTED",
        target_hoarding_title: "Indiranagar Wall Wrap",
        target_publisher_label: "Bangalore Ad Spaces",
        reason: "Photos too low-resolution",
      }),
    ).toBe(
      'Bangalore Ad Spaces\'s listing "Indiranagar Wall Wrap" was rejected — Photos too low-resolution.',
    );
  });

  it("writes a publisher action against the publisher", () => {
    expect(
      describeAction({
        action_type: "PUBLISHER_VERIFIED",
        target_hoarding_title: null,
        target_publisher_label: "Rao Hoardings",
        reason: null,
      }),
    ).toBe("Rao Hoardings was verified.");
  });

  it("falls back gracefully when labels are missing", () => {
    expect(
      describeAction({
        action_type: "PUBLISHER_SUSPENDED",
        target_hoarding_title: null,
        target_publisher_label: null,
        reason: "policy",
      }),
    ).toBe("A publisher was suspended.");
  });
});

describe("tallyListingCounts", () => {
  it("buckets each publisher's listings by approval state", () => {
    const m = tallyListingCounts([
      { publisher_id: "a", approval_status: "DRAFT" },
      { publisher_id: "a", approval_status: "APPROVED" },
      { publisher_id: "a", approval_status: "APPROVED" },
      { publisher_id: "b", approval_status: "PENDING_REVIEW" },
    ]);
    expect(m.get("a")).toEqual({
      draft: 1,
      pending_review: 0,
      approved: 2,
      rejected: 0,
    });
    expect(m.get("b")).toEqual({
      draft: 0,
      pending_review: 1,
      approved: 0,
      rejected: 0,
    });
  });
});
