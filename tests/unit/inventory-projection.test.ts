import { describe, expect, it } from "vitest";
import { buildOwnerView } from "@/lib/inventory/projection";
import type { HoardingRow } from "@/lib/inventory/types";

type Result = { data?: unknown; count?: number };

function queryBuilder(result: Result) {
  const p: Record<string, unknown> = {};
  const chain = () => p;
  for (const m of ["select", "eq", "in", "order", "lte", "gte", "limit"])
    p[m] = chain;
  p.maybeSingle = () => Promise.resolve(result);
  p.single = () => Promise.resolve(result);
  p.then = (res: (v: Result) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return p;
}

function mockSupabase(tables: Record<string, Result>) {
  return {
    from: (t: string) => queryBuilder(tables[t] ?? { data: null }),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/${path}` },
        }),
      }),
    },
  } as never;
}

const baseHoarding = (over: Partial<HoardingRow> = {}): HoardingRow =>
  ({
    id: "h1",
    publisher_id: "p1",
    type_code: "UNIPOLE_BILLBOARD",
    title: "ORR Unipole",
    description: null,
    size: null,
    price: 85000,
    price_unit: "MONTH",
    latitude: 12.95,
    longitude: 77.7,
    locality: "Marathahalli",
    city: "Bengaluru",
    address_text: null,
    approval_status: "DRAFT",
    rejection_reason: null,
    approved_at: null,
    approved_by: null,
    is_paused: false,
    paused_at: null,
    is_delisted: false,
    delisted_at: null,
    delisted_by: null,
    delist_reason: null,
    site_intelligence_complete: false,
    site_intelligence: {},
    attributes: {
      height_ft: 20,
      width_ft: 40,
      illumination: "backlit",
      facing_direction: "north",
    },
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  }) as HoardingRow;

const TYPE = {
  data: {
    display_name: "Unipole / Billboard",
    is_digital: false,
    required_attribute_keys: [
      "height_ft",
      "width_ft",
      "illumination",
      "facing_direction",
    ],
  },
};
const VERIFIED = { data: { verification_status: "VERIFIED", suspended: false } };
const watermarked = [
  { id: "m1", media_type: "IMAGE", storage_path: "h1/m1-watermarked.jpg", is_primary: true, display_order: 0, processing_status: "WATERMARKED", watermarked_at: "x", created_at: "x" },
];

describe("buildOwnerView — submission_readiness mirrors the DB gate", () => {
  it("a complete, verified draft has no blockers", async () => {
    const supa = mockSupabase({
      hoarding_types: TYPE,
      publisher_profiles: VERIFIED,
      hoarding_media: { data: watermarked },
      requests: { count: 0 },
    });
    const view = await buildOwnerView(supa, baseHoarding());
    expect(view.submission_readiness.blockers).toEqual([]);
    expect(view.submission_readiness.is_submittable).toBe(true);
    expect(view.media[0].url).toBe("https://cdn.test/h1/m1-watermarked.jpg");
  });

  it("an unverified publisher blocks (OWNER-004)", async () => {
    const supa = mockSupabase({
      hoarding_types: TYPE,
      publisher_profiles: { data: { verification_status: "UNVERIFIED", suspended: false } },
      hoarding_media: { data: watermarked },
      requests: { count: 0 },
    });
    const view = await buildOwnerView(supa, baseHoarding());
    expect(view.submission_readiness.blockers.map((b) => b.code)).toContain(
      "PUBLISHER_NOT_VERIFIED",
    );
  });

  it("missing attribute keys are listed (INVENTORY-001)", async () => {
    const supa = mockSupabase({
      hoarding_types: TYPE,
      publisher_profiles: VERIFIED,
      hoarding_media: { data: watermarked },
      requests: { count: 0 },
    });
    const view = await buildOwnerView(
      supa,
      baseHoarding({ attributes: { height_ft: 20 } }),
    );
    expect(view.missing_attribute_keys).toEqual([
      "width_ft",
      "illumination",
      "facing_direction",
    ]);
    expect(view.submission_readiness.blockers.map((b) => b.code)).toContain(
      "HOARDING_INCOMPLETE_ATTRIBUTES",
    );
  });

  it("no media blocks; media still processing blocks with a retryable message", async () => {
    const none = mockSupabase({
      hoarding_types: TYPE,
      publisher_profiles: VERIFIED,
      hoarding_media: { data: [] },
      requests: { count: 0 },
    });
    expect(
      (await buildOwnerView(none, baseHoarding())).submission_readiness.blockers.map(
        (b) => b.code,
      ),
    ).toContain("HOARDING_MISSING_MEDIA");

    const processing = mockSupabase({
      hoarding_types: TYPE,
      publisher_profiles: VERIFIED,
      hoarding_media: {
        data: [{ ...watermarked[0], processing_status: "PROCESSING" }],
      },
      requests: { count: 0 },
    });
    expect(
      (await buildOwnerView(processing, baseHoarding())).submission_readiness.blockers.map(
        (b) => b.code,
      ),
    ).toContain("HOARDING_MEDIA_NOT_WATERMARKED");
  });

  it("missing price/lat/lng blocks (HOARDING_MISSING_CORE_FIELDS)", async () => {
    const supa = mockSupabase({
      hoarding_types: TYPE,
      publisher_profiles: VERIFIED,
      hoarding_media: { data: watermarked },
      requests: { count: 0 },
    });
    const view = await buildOwnerView(supa, baseHoarding({ price: null }));
    expect(view.submission_readiness.blockers.map((b) => b.code)).toContain(
      "HOARDING_MISSING_CORE_FIELDS",
    );
  });

  it("a REQUESTED request freezes edits", async () => {
    const supa = mockSupabase({
      hoarding_types: TYPE,
      publisher_profiles: VERIFIED,
      hoarding_media: { data: watermarked },
      requests: { count: 2 },
    });
    const view = await buildOwnerView(supa, baseHoarding());
    expect(view.pending_request_count).toBe(2);
    expect(view.is_edit_frozen).toBe(true);
  });
});
