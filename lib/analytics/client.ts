"use client";

/**
 * Fire-and-forget analytics emitter — Phase 10, mvp-brd.md §14 / database-design.md
 * §44. Writes straight to `analytics_events` (RLS: any signed-in or anon caller
 * may insert, Admin-only may read — grants.sql). Never throws and never blocks
 * the UI: a failed insert (offline, a lost session) is swallowed, matching
 * IMPLEMENTATION-PLAN.md §Phase 10 "failure never blocks the UI".
 */
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

export const ANALYTICS_EVENTS = [
  "PAGE_VIEW",
  "SEARCH",
  "FILTER_USED",
  "HOARDING_VIEWED",
  "REQUEST_STARTED",
  "REQUEST_SUBMITTED",
  "REQUEST_ACCEPTED",
  "REQUEST_REJECTED",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export async function emitAnalyticsEvent(
  event_name: AnalyticsEventName,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("analytics_events")
      .insert({
        event_name,
        properties: properties as Json,
        user_id: session?.user.id ?? null,
      });
    if (error) {
      console.debug(`[analytics] ${event_name} not recorded:`, error.message);
    }
  } catch {
    /* best-effort only — analytics must never surface to the user */
  }
}
