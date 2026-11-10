import { memo } from "react";
import type { View } from "../features/arcs/useViewNavigation";

interface Props {
  view: View;
  onGoToTasks: () => void;
  onGoToArchive: () => void;
  // "app-header-nav" on desktop (in the header), "app-bottom-nav" on mobile (a tab bar
  // under the body). Styles for both live in App.css.
  className: string;
}

export const ViewTabs = memo(function ViewTabs({
  view,
  onGoToTasks,
  onGoToArchive,
  className,
}: Props) {
  return (
    <nav className={className} aria-label="Views">
      <button
        type="button"
        className={`app-nav-tab${view === "active" ? " app-nav-tab--active" : ""}`}
        aria-current={view === "active" ? "page" : undefined}
        onClick={onGoToTasks}
      >
        Tasks
      </button>
      <button
        type="button"
        className={`app-nav-tab${view === "archive" ? " app-nav-tab--active" : ""}`}
        aria-current={view === "archive" ? "page" : undefined}
        onClick={onGoToArchive}
      >
        Archive
      </button>
    </nav>
  );
});
