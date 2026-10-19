"use client";

import { useSyncExternalStore } from "react";

/**
 * True while the CSS media query matches. The server (and the first client
 * render) assume the desktop layout, so phone-only UI mounts after hydration
 * instead of being rendered twice and hidden with CSS.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Below Tailwind's lg breakpoint: phones and iPads in portrait. */
export const BELOW_LG = "(max-width: 1023.98px)";
/** Below Tailwind's md breakpoint: phones. */
export const BELOW_MD = "(max-width: 767.98px)";
/** Below Tailwind's sm breakpoint: narrow phones. */
export const BELOW_SM = "(max-width: 639.98px)";
