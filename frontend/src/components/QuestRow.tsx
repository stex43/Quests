import { memo, useState } from "react";
import { TrashIcon } from "./icons";
import type { Quest } from "../types";
import "./QuestRow.css";

interface Props {
  quest: Quest;
  isSelected: boolean;
  onSelect: (quest: Quest) => void;
  onDelete: (questId: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
}

export const QuestRow = memo(function QuestRow({
  quest,
  isSelected,
  onSelect,
  onDelete,
  onToggleComplete,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(quest.id);
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsDeleting(false);
    }
  }

  // The control is deliberately not disabled while the toggle is in flight. The
  // optimistic flip has already landed, and a disabled button swaps the pointer for
  // an arrow and back for the length of the round trip, which reads as the page
  // reloading. A second click is absorbed by toggleInFlightRef in
  // useQuests.toggleComplete, so the guard costs nothing visually.
  async function handleToggle() {
    try {
      await onToggleComplete(quest.id, quest.completed);
    } catch {
      // error displayed by parent via mutationError
    }
  }

  return (
    <div className="quest-row" data-selected={isSelected}>
      <span className="quest-accent" aria-hidden="true" />
      <button
        type="button"
        className="quest-select-area"
        onClick={() => {
          onSelect(quest);
        }}
      >
        <span className="quest-title" data-completed={quest.completed}>
          {quest.title}
        </span>
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={quest.completed}
        aria-label={`Quest complete: ${quest.title}`}
        className="quest-complete-checkbox"
        onClick={() => void handleToggle()}
      >
        {quest.completed && (
          <span className="quest-check" aria-hidden="true">
            ✓
          </span>
        )}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        aria-label="Delete quest"
        title="Delete quest"
      >
        <TrashIcon />
      </button>
    </div>
  );
});
