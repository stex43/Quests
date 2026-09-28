import { memo, useEffect, useId, useRef, useState } from "react";
import { PencilIcon, TrashIcon } from "./icons";
import type { Arc, Quest } from "../types";
import { QuestRow } from "./QuestRow";
import "./ArcCard.css";

interface Props {
  arc: Arc;
  isExpanded: boolean;
  showCompleted: boolean;
  selectedQuestId: string | null;
  onToggleExpand: (arcId: string) => void;
  onEdit: (arcId: string, title: string) => Promise<void>;
  onDelete: (arcId: string) => Promise<void>;
  onSelectQuest: (quest: Quest) => void;
  onDeleteQuest: (questId: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
  onCreateQuest: (arcId: string, title: string) => Promise<void>;
}

export const ArcCard = memo(function ArcCard({
  arc,
  isExpanded,
  showCompleted,
  selectedQuestId,
  onToggleExpand,
  onEdit,
  onDelete,
  onSelectQuest,
  onDeleteQuest,
  onToggleComplete,
  onCreateQuest,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isCreatingQuest, setIsCreatingQuest] = useState(false);
  const [newQuestTitle, setNewQuestTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const commitInFlightRef = useRef(false);
  const createQuestInFlightRef = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocusRef = useRef(false);
  const deletePromptId = useId();

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    if (isConfirmingDelete) {
      cancelDeleteRef.current?.focus();
    } else if (restoreDeleteFocusRef.current) {
      restoreDeleteFocusRef.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [isConfirmingDelete]);

  function startEdit() {
    setEditTitle(arc.title);
    setEditError(null);
    setIsEditing(true);
  }

  async function commitEdit() {
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    cancelledRef.current = true; // blocks unmount-blur immediately, before any await
    const title = editTitle.trim();
    if (!title) {
      commitInFlightRef.current = false;
      cancelledRef.current = false;
      setEditError("Title cannot be empty");
      return;
    }
    setEditError(null);
    setIsSaving(true);
    try {
      await onEdit(arc.id, title);
      setIsEditing(false);
    } catch {
      cancelledRef.current = false; // allow retry via blur after failure
      // error displayed by parent via mutationError
    } finally {
      setIsSaving(false);
      commitInFlightRef.current = false;
    }
  }

  function cancelDelete() {
    restoreDeleteFocusRef.current = true;
    setIsConfirmingDelete(false);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(arc.id);
    } catch {
      // error displayed by parent via mutationError; the disabled buttons dropped focus,
      // so hand it back to the trash button
      cancelDelete();
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCreateQuest() {
    if (createQuestInFlightRef.current) return;
    const title = newQuestTitle.trim();
    if (!title) return;
    createQuestInFlightRef.current = true;
    setIsCreatingQuest(true);
    try {
      await onCreateQuest(arc.id, title);
      setNewQuestTitle("");
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsCreatingQuest(false);
      createQuestInFlightRef.current = false;
    }
  }

  const questCount = arc.quests.length;

  return (
    <div className="arc-card" data-arc-id={arc.id}>
      <div className="arc-header">
        <button
          type="button"
          className="arc-expand-area"
          onClick={() => {
            onToggleExpand(arc.id);
          }}
          aria-expanded={isExpanded}
          disabled={isEditing || isSaving}
        >
          <span
            className={`arc-chevron${isExpanded ? " arc-chevron--expanded" : ""}`}
            aria-hidden="true"
          >
            ▶
          </span>
          {!isEditing && <span className="arc-title">{arc.title}</span>}
        </button>

        {isEditing && (
          <>
            <input
              ref={editInputRef}
              className={`arc-title-input${editError ? " arc-title-input--error" : ""}`}
              value={editTitle}
              disabled={isSaving}
              onChange={(e) => {
                setEditTitle(e.target.value);
                if (editError) setEditError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitEdit();
                if (e.key === "Escape") {
                  cancelledRef.current = true;
                  setEditError(null);
                  setIsEditing(false);
                }
              }}
              onBlur={() => {
                if (!cancelledRef.current) void commitEdit();
                // Reset so it's ready for the next edit session.
                // No double-blur risk: browsers don't fire blur on unmount when
                // the element is already unfocused (it lost focus on click-away).
                cancelledRef.current = false;
              }}
            />
            {editError && <span className="arc-title-error">{editError}</span>}
          </>
        )}

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
              {questCount === 0
                ? "Delete arc?"
                : `Delete arc and its ${questCount.toString()} ${questCount === 1 ? "quest" : "quests"}?`}
            </span>
            <button
              type="button"
              className="arc-delete-confirm-button arc-delete-confirm-button--danger"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              aria-label="Delete arc"
            >
              Delete
            </button>
            <button
              ref={cancelDeleteRef}
              type="button"
              className="arc-delete-confirm-button"
              onClick={cancelDelete}
              disabled={isDeleting}
              aria-label="Cancel deleting arc"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="icon-button"
              onClick={startEdit}
              disabled={isEditing || isDeleting}
              aria-label="Edit arc"
              title="Edit arc"
            >
              <PencilIcon />
            </button>
            <button
              ref={deleteButtonRef}
              type="button"
              className="icon-button"
              onClick={() => {
                setIsConfirmingDelete(true);
              }}
              disabled={isEditing || isSaving || isDeleting}
              aria-label="Delete arc"
              title="Delete arc"
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>

      {isExpanded && (
        <div className="quest-list">
          {(showCompleted ? arc.quests : arc.quests.filter((q) => !q.completed)).map((quest) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              isSelected={selectedQuestId === quest.id}
              onSelect={onSelectQuest}
              onDelete={onDeleteQuest}
              onToggleComplete={onToggleComplete}
            />
          ))}

          <div className="new-quest-row">
            <input
              className="new-quest-input"
              placeholder="New quest..."
              value={newQuestTitle}
              disabled={isCreatingQuest}
              onChange={(e) => {
                setNewQuestTitle(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateQuest();
              }}
            />
            <button
              type="button"
              aria-label="Add quest"
              className="small-add-button"
              onClick={() => void handleCreateQuest()}
              disabled={isCreatingQuest}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
