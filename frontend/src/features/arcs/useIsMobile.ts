import { useSyncExternalStore } from "react";

// The one place the mobile breakpoint is defined for script. The CSS repeats the same
// 640px in its `@media (max-width: 640px)` blocks (a media query cannot read a custom
// property), each pointing back here -- change them together.
export const MOBILE_MEDIA_QUERY = "(max-width: 640px)";

// Created on first use rather than at import, so nothing touches `window` until a
// component actually renders.
let mediaQueryList: MediaQueryList | null = null;

function getMediaQueryList(): MediaQueryList {
  mediaQueryList ??= window.matchMedia(MOBILE_MEDIA_QUERY);
  return mediaQueryList;
}

function subscribe(onChange: () => void): () => void {
  const mql = getMediaQueryList();
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return getMediaQueryList().matches;
}

// True while the viewport is at or below the mobile breakpoint. Re-renders only when
// the query flips, not on every resize.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
