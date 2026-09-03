"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/auth/session";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
});

/**
 * Client-side mirror of GET /api/v1/auth/me, kept fresh by Supabase auth
 * events. Server components still read the session directly via
 * getSessionUser() — this powers interactive client surfaces (Phase 4's
 * notification bell, header menus).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { cache: "no-store" });
      setUser(res.ok ? (await res.json()).data : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe, so the
    // first load is handled here too — no separate mount fetch needed.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        void refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return React.useContext(AuthContext);
}
