"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { emitAnalyticsEvent } from "@/lib/analytics/client";

/**
 * Phase 10 PAGE_VIEW emitter — mounted once in the root layout. Renders
 * nothing; fires on every route change (App Router doesn't re-mount layouts
 * on navigation, so this is the one place that sees every pathname).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  React.useEffect(() => {
    void emitAnalyticsEvent("PAGE_VIEW", { path: pathname });
  }, [pathname]);
  return null;
}
