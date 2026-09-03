import { describe, expect, it } from "vitest";
import {
  haversineKm,
  nextAvailableDate,
  pruneSiteIntelligence,
  toDiscoverCard,
} from "@/lib/inventory/public-view";
import { filtersToSearchParams } from "@/lib/discovery/client";

describe("pruneSiteIntelligence — partial-omission (api-spec §11.2)", () => {
  it("drops null / undefined / empty-string keys", () => {
    expect(
      pruneSiteIntelligence({
        traffic_volume: "HIGH",
        visibility_rating: "",
        nearby_landmarks: null,
        footfall: 0,
      }),
    ).toEqual({ traffic_volume: "HIGH", footfall: 0 });
  });
  it("returns null when nothing survives (panel omitted)", () => {
    expect(pruneSiteIntelligence({ a: "", b: null })).toBeNull();
    expect(pruneSiteIntelligence({})).toBeNull();
    expect(pruneSiteIntelligence(null)).toBeNull();
  });
  it("a footfall of 0 is kept — not conflated with unknown", () => {
    expect(pruneSiteIntelligence({ footfall: 0 })).toEqual({ footfall: 0 });
  });
});

describe("nextAvailableDate", () => {
  const today = new Date("2026-09-15T06:00:00Z"); // 15 Sep IST
  it("today when nothing blocks it", () => {
    expect(nextAvailableDate([], [], today)).toBe("2026-09-15");
  });
  it("first day after a leading booked range", () => {
    expect(
      nextAvailableDate(
        [{ start_date: "2026-09-10", end_date: "2026-09-20" }],
        [],
        today,
      ),
    ).toBe("2026-09-21");
  });
  it("composes blocks and bookings", () => {
    expect(
      nextAvailableDate(
        [{ start_date: "2026-09-15", end_date: "2026-09-18" }],
        [{ start_date: "2026-09-19", end_date: "2026-09-19" }],
        today,
      ),
    ).toBe("2026-09-20");
  });
  it("null when fully booked through the window", () => {
    expect(
      nextAvailableDate(
        [{ start_date: "2026-09-15", end_date: "2027-09-15" }],
        [],
        today,
      ),
    ).toBeNull();
  });
});

describe("haversineKm", () => {
  it("MG Road → Electronic City ≈ 18 km", () => {
    const d = haversineKm(12.9756, 77.6068, 12.8452, 77.6602);
    expect(d).toBeGreaterThan(14);
    expect(d).toBeLessThan(18);
  });
  it("same point is 0", () => {
    expect(haversineKm(12.97, 77.59, 12.97, 77.59)).toBeCloseTo(0, 5);
  });
});

describe("toDiscoverCard — the disintermediation boundary (RISK-16)", () => {
  const row = {
    id: "h1",
    title: "ORR Unipole",
    type_code: "UNIPOLE_BILLBOARD",
    locality: "Marathahalli",
    city: "Bengaluru",
    address_text: "ORR near the bridge",
    size: "20ft x 40ft",
    price: 85000,
    price_unit: "MONTH",
    latitude: 12.95,
    longitude: 77.7,
    attributes: { height_ft: 20 },
    site_intelligence: {},
    site_intelligence_complete: false,
    created_at: "2026-09-01T00:00:00Z",
    publisher_business_name: "Kumar Outdoor Media",
    publisher_is_verified: true,
    distance_km: 8.4,
    next_available_date: "2026-09-20",
    total_count: 1,
  };

  it("carries only business_name + is_verified for the publisher", () => {
    const card = toDiscoverCard(row as never, {
      typeName: new Map([["UNIPOLE_BILLBOARD", "Unipole / Billboard"]]),
      primaryUrl: new Map([["h1", "https://cdn/x.jpg"]]),
    });
    expect(card.publisher).toEqual({
      business_name: "Kumar Outdoor Media",
      is_verified: true,
    });
    const json = JSON.stringify(card);
    expect(json).not.toMatch(/phone|email|full_name|publisher_id/i);
    expect(card.type.display_name).toBe("Unipole / Billboard");
    expect(card.primary_media_url).toBe("https://cdn/x.jpg");
  });
});

describe("filtersToSearchParams", () => {
  it("only writes geo params when the triad is complete", () => {
    expect(
      filtersToSearchParams({ center: { latitude: 12.9, longitude: 77.6 } }).toString(),
    ).toBe("");
    expect(
      filtersToSearchParams({
        center: { latitude: 12.9, longitude: 77.6 },
        maxDistance: 5,
      }).toString(),
    ).toBe("latitude=12.9&longitude=77.6&maxDistance=5");
  });
  it("omits sort=distance and page=1", () => {
    expect(filtersToSearchParams({ sort: "distance", page: 1 }).toString()).toBe("");
    expect(filtersToSearchParams({ sort: "price_asc", page: 3 }).toString()).toBe(
      "sort=price_asc&page=3",
    );
  });
});
