import { useCallback, useEffect } from "react";

// Marks the history entry pushed when the mobile detail screen opens. There is no router,
// so this key in `history.state` is the only record of which entry is ours.
const DETAIL_ENTRY_KEY = "questsMobileDetail";

type HistoryState = Record<string, unknown>;

function asState(state: unknown): HistoryState {
  return typeof state === "object" && state !== null ? (state as HistoryState) : {};
}

function isDetailEntry(state: unknown): boolean {
  return asState(state)[DETAIL_ENTRY_KEY] === true;
}

// Ties the mobile list/detail stack to browser history so the Android/browser back
// gesture returns to the list instead of leaving the app:
//   - the detail opening pushes an entry carrying DETAIL_ENTRY_KEY;
//   - popstate onto an entry without it (back gesture or our own history.back()) clears
//     the selection, which closes the detail;
//   - the detail closing any other way (tab switch, the open quest deleted, a resize to
//     desktop) replaces our entry with an unmarked copy (marker set to false), so no stale "detail" entry is
//     left on top. That leaves one same-looking entry beneath it, so the next back
//     press is a visible no-op -- the cost of not calling history.back() behind the
//     user's back, which would race any quest they open next.
// Every step checks the current entry rather than tracking transitions, so StrictMode's
// double-run and a reload onto our entry (browsers keep history.state) both settle.
// Returns the handler for the header's back button.
export function useMobileDetailHistory(
  isMobile: boolean,
  isDetailShown: boolean,
  clearSelection: () => void,
) {
  useEffect(() => {
    if (isDetailShown) {
      if (!isDetailEntry(history.state)) {
        history.pushState({ ...asState(history.state), [DETAIL_ENTRY_KEY]: true }, "");
      }
    } else if (isDetailEntry(history.state)) {
      history.replaceState({ ...asState(history.state), [DETAIL_ENTRY_KEY]: false }, "");
    }
  }, [isDetailShown]);

  // Forward onto one of our entries while the list shows is ignored: the entry does not
  // record which quest it was, and the next open reuses it instead of pushing again.
  useEffect(() => {
    if (!isMobile) return;
    const handlePopState = (e: PopStateEvent) => {
      if (!isDetailEntry(e.state)) clearSelection();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMobile, clearSelection]);

  // history.back() when the entry is ours, so the stack stays as if the user had used
  // the gesture; popstate above then does the clearing.
  return useCallback(() => {
    if (isDetailEntry(history.state)) history.back();
    else clearSelection();
  }, [clearSelection]);
}
