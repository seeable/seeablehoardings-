import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, homePathForRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * OAuth (Google) + email-link PKCE callback. Exchanges the `code` for a session
 * cookie, then routes by role. Google sign-ins are always VIEWER
 * (handle_new_user default) — Decision: Google = Viewer only.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange`);
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const user = await getSessionUser();
  return NextResponse.redirect(
    `${origin}${user ? homePathForRole(user.role) : "/login"}`,
  );
}
