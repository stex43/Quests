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
  // optimistic flip is itself the feedback, so there is nothing left to signal, and
  // disabling a focused button blurs it to <body> -- which loses a keyboard user's
  // place mid-toggle and never gives it back. A second click is absorbed by
  // toggleInFlightRef in useQuests.toggleComplete, so nothing here is unguarded.
  // The symptom that finally motivated this was narrower: a `:disabled { cursor: default }`
  // rule, since deleted, flicked the pointer from hand to arrow and back, which reads
  // as the page reloading. Re-adding `disabled` would no longer do that -- the reasons
  // above are the ones that still hold.
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
