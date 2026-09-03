import { defineRoute } from "@/lib/api/facade";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/auth/me — api-specification.md §5.11.
 * The single source of role + verification gates. The facade guarantees a
 * session (`auth: true`), so getSessionUser() is non-null here.
 */
export const GET = defineRoute({
  path: "/api/v1/auth/me",
  auth: true,
  rateLimit: { perMinute: 120 }, // §5.11 RECOMMENDED
  handler: async () => (await getSessionUser())!,
});
