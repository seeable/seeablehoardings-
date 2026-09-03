"use client";

import * as React from "react";

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),summary';

function focusablesIn(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Focus management for overlays — docs/07 §24.2. While `active`:
 *   - moves focus into the container (first focusable, or the container),
 *   - keeps Tab / Shift+Tab cycling inside it,
 *   - calls `onClose` on Escape,
 *   - restores focus to the previously-focused element on deactivate.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    (focusablesIn(node)[0] ?? node).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusablesIn(node!);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const activeEl = document.activeElement as HTMLElement;
      const idx = items.indexOf(activeEl);
      const inside = node!.contains(activeEl);
      if (e.shiftKey && (idx <= 0 || !inside)) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && (idx === items.length - 1 || !inside)) {
        e.preventDefault();
        items[0].focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [active, onClose]);

  return ref;
}

/** Lock body scroll while an overlay is open. Ref-counted for stacked cases. */
let lockCount = 0;
export function useBodyScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    lockCount += 1;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = prev;
    };
  }, [active]);
}
