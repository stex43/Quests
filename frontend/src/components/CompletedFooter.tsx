import { memo, useState } from "react";
import type { Quest } from "../types";
import { CompletedPreviewList } from "./CompletedPreviewList";
import "./CompletedFooter.css";
// CompletedPreviewList.tsx pulls in its own CSS, but referencing it here too documents
// that this component's markup (the toggle line) depends on .arc-chevron from
// ArcCard.css, which every consumer of the chevron visuals already imports.
import "./ArcCard.css";

interface Props {
  arcId: string;
  quests: Quest[];
  completedCount: number;
  onViewInArchive?: (arcId: string) => void;
}

// Only meaningful when completedCount > 0 -- callers (ArcCard) guard on that before
// rendering this at all, rather than this component silently rendering nothing, so an
// empty render isn't mistaken for a bug at the call site.
export const CompletedFooter = memo(function CompletedFooter({
  arcId,
  quests,
  completedCount,
  onViewInArchive,
}: Props) {
  // Defaults to collapsed: keeping the main list short is the whole point of this
  // feature, so an arc with older completions shouldn't reopen them by default.
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="completed-footer">
      <button
        type="button"
        className="completed-footer-toggle"
        aria-expanded={isExpanded}
        onClick={() => {
          setIsExpanded((prev) => !prev);
        }}
      >
        <span
          className={`arc-chevron${isExpanded ? " arc-chevron--expanded" : ""}`}
          aria-hidden="true"
        >
          ▶
        </span>
        {completedCount.toString()} completed
      </button>
      {isExpanded && (
        <CompletedPreviewList
          arcId={arcId}
          quests={quests}
          completedCount={completedCount}
          onViewInArchive={onViewInArchive}
        />
      )}
    </div>
  );
});
