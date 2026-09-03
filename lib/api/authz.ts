/**
 * The 403-vs-404 discipline — api-specification.md §6.5.
 *
 *   wrong role for the endpoint              -> 403 FORBIDDEN_ROLE   (facade)
 *   right role, visible row, not the owner   -> 403 FORBIDDEN_NOT_OWNER
 *   row not visible to the caller at all     -> 404 RESOURCE_NOT_FOUND
 *
 * The last case falls out of RLS for free: a row invisible under RLS returns
 * zero rows, and `requireRow` reports 404 without ever deciding "exists vs not
 * yours" — which is exactly the enumeration oracle §29 warns about.
 */
import { ApiError } from "@/lib/api/errors";

/** A `.maybeSingle()` result that came back empty -> 404. */
export function requireRow<T>(
  row: T | null | undefined,
  code:
    | "RESOURCE_NOT_FOUND"
    | "HOARDING_NOT_FOUND"
    | "REQUEST_NOT_FOUND"
    | "MEDIA_NOT_FOUND"
    | "PUBLISHER_NOT_FOUND" = "RESOURCE_NOT_FOUND",
): T {
  if (row === null || row === undefined) throw ApiError.of(code);
  return row;
}

/** Right role, the row is visible, but the caller does not own it. */
export function forbidNotOwner(): never {
  throw ApiError.of("FORBIDDEN_NOT_OWNER");
}

/** Endpoint requires ADMIN specifically. */
export function forbidAdminOnly(): never {
  throw ApiError.of("ADMIN_ONLY");
}
