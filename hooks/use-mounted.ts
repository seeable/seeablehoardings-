"use client";

import * as React from "react";

const noop = () => () => {};

/**
 * `false` during SSR and the first client render, `true` afterwards — the guard
 * for `createPortal` (which needs `document`). Uses `useSyncExternalStore` so
 * there's no setState-in-effect.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
