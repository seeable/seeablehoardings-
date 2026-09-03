/**
 * Publisher / profile PATCH validation — api-specification.md §22.3, §23.5.
 * `.strict()` rejects server-owned fields (`role`, `verification_status`,
 * `suspended`) with a 422; the column grants would reject them anyway.
 */
import { z } from "zod";

const fullName = z.string().trim().min(1).max(120).nullable();
const phone = z.string().trim().max(20).nullable();
const email = z.string().trim().email().max(200).nullable();
const city = z.string().trim().min(1).max(120).nullable();

/** PATCH /api/v1/profiles/me — the fields `GRANT UPDATE` on `profiles` allows. */
export const profilePatchSchema = z
  .object({ full_name: fullName, phone, email, city })
  .partial()
  .strict();

/** PATCH /api/v1/publishers/me — the same, plus `business_name` (§22.3 — one
 *  PATCH may span both tables). */
export const publisherPatchSchema = z
  .object({
    full_name: fullName,
    phone,
    email,
    city,
    business_name: z.string().trim().min(1).max(200).nullable(),
  })
  .partial()
  .strict();

/** POST /api/v1/publishers/me/verification — multipart; validated field-by-field
 *  in the route. This covers the text parts. */
export const verificationFieldsSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  business_type: z.string().trim().max(120).optional(),
});

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type PublisherPatchInput = z.infer<typeof publisherPatchSchema>;
