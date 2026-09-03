/**
 * Admin API request validation — api-specification.md §24–§26.
 * The facade validates *shape*; the DB functions enforce the *rules*
 * (`approve_listing`, `verify_publisher`, `suspend_publisher`, … all raise
 * `SEEABLE_CODE`-tagged errors). Repeatable filters (`approval_status`,
 * `verification_status`, `action_type`) are read with `searchParams.getAll()`
 * in the handler — the schema only has to not reject the key as unknown.
 */
import { z } from "zod";

const boolParam = z.enum(["true", "false"]);

export const adminListingQuerySchema = z
  .object({
    approval_status: z.string().max(120).optional(),
    delisted: boolParam.optional(),
    publisher_id: z.string().uuid().optional(),
    type: z.string().max(64).optional(),
    site_intelligence_complete: boolParam.optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  })
  .strict();

export const adminPublisherQuerySchema = z
  .object({
    verification_status: z.string().max(120).optional(),
    suspended: boolParam.optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  })
  .strict();

export const adminActionsQuerySchema = z
  .object({
    action_type: z.string().max(200).optional(),
    target_hoarding_id: z.string().uuid().optional(),
    target_publisher_id: z.string().uuid().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  })
  .strict();

/** Listing rejection — reason mandatory (ADMIN-003). */
export const requiredReasonSchema = z
  .object({ reason: z.string().trim().min(1, "A reason is required").max(1000) })
  .strict();

/** Verification rejection / delist — reason optional (api-spec §25.4, §26.4). */
export const optionalReasonSchema = z
  .object({ reason: z.string().trim().max(1000).optional() })
  .strict();

export type AdminListingQuery = z.infer<typeof adminListingQuerySchema>;
export type AdminPublisherQuery = z.infer<typeof adminPublisherQuerySchema>;
export type AdminActionsQuery = z.infer<typeof adminActionsQuerySchema>;
