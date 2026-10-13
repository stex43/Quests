import { memo } from "react";
import type { Quest } from "../types";
import { formatShortDateFromTimestamp } from "../dateFormat";
import { QuestRow } from "./QuestRow";
import { CompletedPreviewList } from "./CompletedPreviewList";
import "./ArcCard.css";

interface Props {
  arcId: string;
  title: string;
  sealedAt: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  mode: "tasks" | "archive";
  // Archive mode only: the full completed history for this arc, uncapped. Unused in
  // tasks mode -- a sealed arc has no open quests, so its `quests` (open-only in the
  // active view) is always empty there; recentCompleted/completedCount cover tasks
  // mode's "completed today" preview instead.
  quests: Quest[];
  recentCompleted: Quest[];
  completedCount: number;
  selectedQuestId: string | null;
  onSelectQuest: (quest: Quest) => void;
  onDeleteQuest: (questId: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
  onUnseal: () => void;
  onViewInArchive?: (arcId: string) => void;
}

export const SealedArcHeader = memo(function SealedArcHeader({
  arcId,
  title,
  sealedAt,
  isExpanded,
  onToggleExpand,
  mode,
  quests,
  recentCompleted,
  completedCount,
  selectedQuestId,
  onSelectQuest,
  onDeleteQuest,
  onToggleComplete,
  onUnseal,
  onViewInArchive,
}: Props) {
  return (
    <div className="arc-header arc-header--sealed">
      <button
        type="button"
        className="arc-expand-area"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
      >
        <span
          className={`arc-chevron${isExpanded ? " arc-chevron--expanded" : ""}`}
          aria-hidden="true"
        >
          ▶
        </span>
        <span className="arc-seal-glyph" aria-hidden="true">
          ✓
        </span>
        <span className="arc-title">{title}</span>
        <span className="arc-sealed-label">sealed</span>
        <span className="arc-sealed-filler" aria-hidden="true" />
        <span className="arc-sealed-date">sealed {formatShortDateFromTimestamp(sealedAt)}</span>
      </button>

      {isExpanded && (
        <div className="arc-sealed-body">
          {mode === "archive" &&
            quests.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                isSelected={selectedQuestId === quest.id}
                onSelect={onSelectQuest}
                onDelete={onDeleteQuest}
                onToggleComplete={onToggleComplete}
              />
            ))}
          {mode === "tasks" && (
            <>
              <CompletedPreviewList
                arcId={arcId}
                quests={recentCompleted}
                completedCount={completedCount}
                onViewInArchive={onViewInArchive}
              />
              <button type="button" className="arc-unseal-link" onClick={onUnseal}>
                Unseal this arc
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});
