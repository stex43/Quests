import { memo } from "react";
import type { Quest } from "../types";
import { formatShortDate } from "../dateFormat";
import "./CompletedPreviewList.css";

const PREVIEW_CAP = 5;

interface Props {
  arcId: string;
  quests: Quest[];
  completedCount: number;
  onViewInArchive?: (arcId: string) => void;
}

// Inert compact rows -- no onClick, no checkbox, no delete button. The mock's own JS
// never wires these up; only the "View all" link below is interactive.
export const CompletedPreviewList = memo(function CompletedPreviewList({
  arcId,
  quests,
  completedCount,
  onViewInArchive,
}: Props) {
  return (
    <div className="completed-preview-list">
      {quests.map((quest) => (
        <div className="completed-preview-row" key={quest.id}>
          <span className="completed-preview-accent" aria-hidden="true" />
          <span className="completed-preview-title">{quest.title}</span>
          {quest.completedOn && (
            <span className="completed-preview-date">{formatShortDate(quest.completedOn)}</span>
          )}
        </div>
      ))}
      {completedCount > PREVIEW_CAP && (
        <button
          type="button"
          className="completed-preview-viewall"
          onClick={() => {
            onViewInArchive?.(arcId);
          }}
        >
          View all {completedCount.toString()} in the Archive →
        </button>
      )}
    </div>
  );
});
