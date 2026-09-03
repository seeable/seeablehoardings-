import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * 1. CSRF: reject a cross-origin mutating request (Decision D3). Cookie
 *    sessions are SameSite=Lax, and this Origin check is the second layer.
 * 2. Refresh the Supabase session + coarse route guards (updateSession).
 */
export async function proxy(request: NextRequest) {
  if (MUTATING.has(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    // Same-origin browser requests always send Origin on these methods.
    if (origin) {
      const ok = (() => {
        try {
          return new URL(origin).host === host;
        } catch {
          return false;
        }
      })();
      if (!ok) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Cross-origin request refused.",
              details: {},
            },
          },
          { status: 403 },
        );
      }
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next internals, static assets, and the health probe.
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
