import { memo } from "react";
import type { Quest } from "../types";
import { PREVIEW_CAP } from "../previewCap";
import { QuestRow } from "./QuestRow";
import "./CompletedPreviewList.css";

interface Props {
  arcId: string;
  quests: Quest[];
  completedCount: number;
  selectedQuestId: string | null;
  onSelectQuest: (quest: Quest) => void;
  onDeleteQuest: (questId: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
  onViewInArchive?: (arcId: string) => void;
}

// Today's completions as regular QuestRows, so they can be selected and un-completed
// (which reopens the quest, and unseals a sealed arc) just like open rows.
export const CompletedPreviewList = memo(function CompletedPreviewList({
  arcId,
  quests,
  completedCount,
  selectedQuestId,
  onSelectQuest,
  onDeleteQuest,
  onToggleComplete,
  onViewInArchive,
}: Props) {
  const shown = quests.slice(0, PREVIEW_CAP);
  return (
    <div className="completed-preview-list">
      {shown.map((quest) => (
        <QuestRow
          key={quest.id}
          quest={quest}
          isSelected={selectedQuestId === quest.id}
          onSelect={onSelectQuest}
          onDelete={onDeleteQuest}
          onToggleComplete={onToggleComplete}
        />
      ))}
      {completedCount > shown.length && (
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
