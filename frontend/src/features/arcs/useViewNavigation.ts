import { useCallback, useState } from "react";

export type View = "active" | "archive";

// Main/Archive tab switching as local client state (no React Router in this codebase).
// focusArcId is a one-shot: set by goToArchive so the Archive view can expand and
// scroll to that arc, then cleared via clearFocus once it has been handled.
export function useViewNavigation() {
  const [view, setView] = useState<View>("active");
  const [focusArcId, setFocusArcId] = useState<string | null>(null);

  const goToTasks = useCallback(() => {
    setView("active");
  }, []);

  const goToArchive = useCallback((arcId?: string) => {
    setFocusArcId(arcId ?? null);
    setView("archive");
  }, []);

  const clearFocus = useCallback(() => {
    setFocusArcId(null);
  }, []);

  return { view, focusArcId, goToTasks, goToArchive, clearFocus };
}
