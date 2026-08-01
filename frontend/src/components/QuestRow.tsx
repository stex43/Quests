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
  const [isToggling, setIsToggling] = useState(false);

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

  async function handleToggle() {
    setIsToggling(true);
    try {
      await onToggleComplete(quest.id, quest.completed);
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsToggling(false);
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
        aria-label={quest.completed ? "Mark quest incomplete" : "Mark quest complete"}
        className="quest-complete-checkbox"
        disabled={isToggling}
        onClick={() => void handleToggle()}
      >
        {quest.completed && (
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M1.5 5L4 7.5L8.5 2.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
