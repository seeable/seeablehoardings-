/**
 * Request Engine request validation — api-specification.md §17.2, §20.2.
 *
 * The facade validates *shape*; the database enforces every *rule*
 * (`validate_request_creation` trigger, `confirm_request()` and friends, the
 * EXCLUDE constraint, the VIEWER-002 partial unique index). `.strict()` turns a
 * server-owned field — `status`, `publisher_id`, `amount_agreed` at creation —
 * into a 422, not a silent drop (§17.3).
 */
import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), {
    message: "Not a real date",
  });

/** POST /api/v1/requests (§17.2). `amount_agreed`/`status` present → 422. */
export const createRequestSchema = z
  .object({
    hoarding_id: z.string().uuid(),
    start_date: isoDate,
    end_date: isoDate,
    message: z.string().max(1000).optional(),
  })
  .strict();

/** PATCH /api/v1/requests/{id} (§20.2). One endpoint, four actions; the route
 *  rejects a field that does not belong to the action with REQUEST_ACTION_INVALID. */
export const requestActionSchema = z
  .object({
    action: z.string().min(1),
    reason: z.string().max(500).optional(),
    amount_agreed: z.coerce.number().positive().max(99_999_999).optional(),
  })
  .strict();

export const myRequestsQuerySchema = z
  .object({
    status: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  })
  .strict();

export const inboxQuerySchema = z
  .object({
    status: z.string().optional(),
    hoarding_id: z.string().uuid().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  })
  .strict();

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type RequestActionInput = z.infer<typeof requestActionSchema>;
