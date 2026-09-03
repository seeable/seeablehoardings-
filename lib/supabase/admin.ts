import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role Supabase client — BYPASSES RLS.
 *
 * Sanctioned callers ONLY (IMPLEMENTATION-PLAN.md §1, api-specification.md §6.3):
 *   1. The media upload / watermark write handler
 *      (app/api/v1/hoardings/[id]/media/**)
 *   2. Migration / seed / provisioning tooling (scripts/**)
 *
 * Everything else must use `@/lib/supabase/server` or `@/lib/supabase/client`
 * so RLS stays a live control. The `no-restricted-imports` ESLint rule enforces
 * this — do not add exceptions.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
