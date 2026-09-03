import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Paths that require a session. Everything else is public. */
const PROTECTED_PREFIXES = [
  "/discover",
  "/publisher",
  "/admin",
  "/account",
  "/requests",
];
/** Auth pages a signed-in user should be bounced away from. */
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/**
 * Refresh the Supabase session cookie on every request (@supabase/ssr
 * requirement) and apply coarse route guards. Fine-grained role checks live in
 * the server components themselves (Phase 3 hardens this).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession) — it revalidates the JWT with Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (
    user &&
    AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    // Role-specific landing is resolved by /post-login (a server component that
    // can read the profile); middleware only knows there IS a user.
    const url = request.nextUrl.clone();
    url.pathname = "/post-login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
