/**
 * Inventory request validation — api-specification.md §12–§15.
 *
 * The facade validates *shape*; the database enforces the *rules*
 * (`submit_hoarding_for_review()`, `enforce_hoarding_edit_freeze`, the column
 * grants tightened in 20260905120100). Server-owned fields are rejected here by
 * `.strict()` — sending `approval_status` is a 422, not a silent no-op.
 */
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

/** Zod's structural object type isn't Postgrest's recursive `Json`; the values
 *  are JSON-safe by construction, so a cast at the write boundary is correct. */
export const asJson = (v: unknown): Json => (v ?? {}) as Json;

/** A JSON-object value: type-specific `attributes` keys vary by hoarding type. */
const attributeValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const attributesSchema = z.record(z.string(), attributeValue);

/** Site Intelligence — all optional (INVENTORY-002). The form (docs/04 PB-03
 *  Step 3) collects exactly these three; unknown keys are preserved. */
export const siteIntelligenceSchema = z
  .object({
    traffic_volume: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    visibility_rating: z.enum(["FAIR", "GOOD", "EXCELLENT"]).optional(),
    nearby_landmarks: z.string().max(500).optional(),
  })
  .passthrough();

const price = z.coerce
  .number()
  .positive("Price must be greater than 0")
  .max(99_999_999);
const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);
const priceUnit = z.enum(["DAY", "WEEK", "MONTH"]);

/** POST /api/v1/hoardings — only `type_code` + `title` are required (§12.3);
 *  everything else fills in over the wizard and is gated at submit. */
export const createHoardingSchema = z
  .object({
    type_code: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).nullish(),
    size: z.string().max(100).nullish(),
    price: price.nullish(),
    price_unit: priceUnit.nullish(),
    latitude: latitude.nullish(),
    longitude: longitude.nullish(),
    locality: z.string().max(200).nullish(),
    city: z.string().max(120).nullish(),
    address_text: z.string().max(500).nullish(),
    attributes: attributesSchema.nullish(),
    site_intelligence: siteIntelligenceSchema.nullish(),
  })
  .strict();

/** PATCH /api/v1/hoardings/{id} — partial; `type_code` is immutable (§13.2);
 *  `null` clears a nullable column, `undefined`/absent leaves it. */
export const updateHoardingSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).nullable(),
    size: z.string().max(100).nullable(),
    price: price.nullable(),
    price_unit: priceUnit,
    latitude: latitude.nullable(),
    longitude: longitude.nullable(),
    locality: z.string().max(200).nullable(),
    city: z.string().max(120),
    address_text: z.string().max(500).nullable(),
    attributes: attributesSchema,
    site_intelligence: siteIntelligenceSchema,
    is_paused: z.boolean(),
  })
  .partial()
  .strict();

/** POST /api/v1/hoardings/{id}/availability/blocks (docs/04 PB-05). */
export const createBlockSchema = z
  .object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    reason: z.string().max(200).optional(),
  })
  .strict()
  .refine((v) => v.end_date >= v.start_date, {
    message: "end_date must be on or after start_date",
    path: ["end_date"],
  });

/** PATCH /api/v1/hoardings/{id}/media/{mediaId} — the two client-grantable
 *  columns only (§14.5). */
export const updateMediaSchema = z
  .object({
    is_primary: z.boolean().optional(),
    display_order: z.number().int().min(0).max(999).optional(),
  })
  .strict()
  .refine((v) => v.is_primary !== undefined || v.display_order !== undefined, {
    message: "Provide is_primary or display_order",
  });

/** POST /api/v1/admin/hoardings/{id}/reject — reason mandatory (ADMIN-003). */
export const rejectListingSchema = z
  .object({ reason: z.string().min(1, "A reason is required").max(1000) })
  .strict();

export const availabilityQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export const myHoardingsQuerySchema = z
  .object({
    status: z
      .enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "PAUSED", "DELISTED"])
      .optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  })
  .strict();

export type CreateHoardingInput = z.infer<typeof createHoardingSchema>;
export type UpdateHoardingInput = z.infer<typeof updateHoardingSchema>;
