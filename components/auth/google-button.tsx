"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { clientEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";

/**
 * Google sign-in. Decision: a Google account is always a VIEWER
 * (handle_new_user default) — publishers use email + password.
 */
export function GoogleButton({ next }: { next?: string }) {
  const [loading, setLoading] = React.useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", clientEnv.NEXT_PUBLIC_APP_URL);
    if (next) redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) setLoading(false); // otherwise we're navigating away
  }

  return (
    <Button
      type="button"
      variant="secondary"
      block
      loading={loading}
      onClick={signIn}
    >
      {!loading && (
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"
          />
        </svg>
      )}
      Continue with Google
    </Button>
  );
}
