import { route, ok } from "@/lib/api/envelope";
import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/auth/me — api-specification.md §5.11.
 * The single source of role + verification gates for every client surface.
 * Auth endpoints are otherwise NOT built (spec §5.2) — the client uses
 * `supabase.auth.*` directly.
 */
export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError("AUTH_REQUIRED", "You are not signed in.", 401);
  }

  const res = ok(user);
  res.headers.set("Cache-Control", "no-store"); // §5.11 — never stale
  return res;
});
