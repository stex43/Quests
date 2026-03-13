import { memo, useEffect, useRef, useState } from "react";
import { PencilIcon, TrashIcon } from "./icons";
import type { Arc, Quest } from "../types";
import { QuestRow } from "./QuestRow";
import "./ArcCard.css";

interface Props {
  arc: Arc;
  isExpanded: boolean;
  selectedQuestId: string | null;
  onToggleExpand: (arcId: string) => void;
  onEdit: (arcId: string, title: string) => Promise<void>;
  onDelete: (arcId: string) => Promise<void>;
  onSelectQuest: (quest: Quest) => void;
  onDeleteQuest: (questId: string) => Promise<void>;
  onCreateQuest: (arcId: string, title: string) => Promise<void>;
}

export const ArcCard = memo(function ArcCard({
  arc,
  isExpanded,
  selectedQuestId,
  onToggleExpand,
  onEdit,
  onDelete,
  onSelectQuest,
  onDeleteQuest,
  onCreateQuest,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingQuest, setIsCreatingQuest] = useState(false);
  const [newQuestTitle, setNewQuestTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const commitInFlightRef = useRef(false);

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);

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

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(arc.id);
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCreateQuest() {
    const title = newQuestTitle.trim();
    if (!title) return;
    setIsCreatingQuest(true);
    try {
      await onCreateQuest(arc.id, title);
      setNewQuestTitle("");
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsCreatingQuest(false);
    }
  }

  return (
    <div className="arc-card">
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
          <span className="arc-chevron" aria-hidden="true">
            {isExpanded ? "▼" : "▶"}
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
                cancelledRef.current = false;
              }}
            />
            {editError && <span className="arc-title-error">{editError}</span>}
          </>
        )}

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
          type="button"
          className="icon-button"
          onClick={() => void handleDelete()}
          disabled={isEditing || isSaving || isDeleting}
          aria-label="Delete arc"
          title="Delete arc"
        >
          <TrashIcon />
        </button>
      </div>

      {isExpanded && (
        <div className="quest-list">
          {arc.quests.map((quest) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              isSelected={selectedQuestId === quest.id}
              onSelect={onSelectQuest}
              onDelete={onDeleteQuest}
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
