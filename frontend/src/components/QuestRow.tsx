import { memo, useEffect, useId, useRef, useState } from "react";
import { RepeatIcon, TrashIcon } from "./icons";
import { formatDay, localCalendarDay } from "../dateFormat";
import type { Quest } from "../types";
// The delete confirm reuses ArcCard's .arc-delete-confirm* styles rather than copying them.
import "./ArcCard.css";
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

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocusRef = useRef(false);
  const deletePromptId = useId();

  useEffect(() => {
    if (isConfirmingDelete) {
      cancelDeleteRef.current?.focus();
    } else if (restoreDeleteFocusRef.current) {
      restoreDeleteFocusRef.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [isConfirmingDelete]);

  function cancelDelete() {
    restoreDeleteFocusRef.current = true;
    setIsConfirmingDelete(false);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(quest.id);
    } catch {
      // error displayed by parent via mutationError; the disabled buttons dropped focus,
      // so hand it back to the trash button
      cancelDelete();
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

  // Only an open instance can be overdue; once done, its due day is just history. Upcoming
  // instances never reach a QuestRow (they live in UpcomingFooter), so an open dated
  // quest here is due today or overdue.
  const isOverdue =
    !quest.completed && quest.dueOn !== null && quest.dueOn < localCalendarDay(new Date());
  const dueLabel = isOverdue ? formatDay(quest.dueOn) : null;

  return (
    <div className="quest-row" data-selected={isSelected}>
      <span className="quest-accent" aria-hidden="true" />
      <button
        type="button"
        className="quest-select-area"
        data-quest-id={quest.id}
        onClick={() => {
          onSelect(quest);
        }}
      >
        <span className="quest-title" data-completed={quest.completed}>
          {quest.title}
        </span>
        {/* Inside the select button so both markers are part of its accessible name --
            the icon is aria-hidden, so the visually-hidden word carries it. */}
        {quest.recurrence && (
          <span className="quest-repeat-marker" title="Repeats">
            <RepeatIcon />
            <span className="visually-hidden">Repeats</span>
          </span>
        )}
        {isOverdue && (
          <span className="quest-overdue">Overdue{dueLabel ? ` · due ${dueLabel}` : ""}</span>
        )}
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
      {isConfirmingDelete ? (
        <div
          className="arc-delete-confirm"
          role="group"
          aria-labelledby={deletePromptId}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isDeleting) cancelDelete();
          }}
        >
          <span id={deletePromptId} className="arc-delete-confirm-text">
            Delete quest?
          </span>
          <button
            type="button"
            className="arc-delete-confirm-button arc-delete-confirm-button--danger"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            aria-label={`Delete quest: ${quest.title}`}
          >
            Delete
          </button>
          <button
            ref={cancelDeleteRef}
            type="button"
            className="arc-delete-confirm-button"
            onClick={cancelDelete}
            disabled={isDeleting}
            aria-label={`Cancel deleting quest: ${quest.title}`}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          ref={deleteButtonRef}
          type="button"
          className="icon-button"
          onClick={() => {
            setIsConfirmingDelete(true);
          }}
          aria-label={`Delete quest: ${quest.title}`}
          title="Delete quest"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
});
