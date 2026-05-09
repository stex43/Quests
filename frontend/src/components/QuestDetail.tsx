import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Quest } from "../types";
import { PencilIcon } from "./icons";
import "./QuestDetail.css";

interface Props {
  quest: Quest | null;
  onUpdate: (questId: string, title: string, description: string) => Promise<void>;
}

export const QuestDetail = memo(function QuestDetail({ quest, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const commitInFlightRef = useRef(false);
  const prevQuestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (quest?.id !== prevQuestIdRef.current) {
      setIsEditing(false);
      setEditTitle(quest?.title ?? "");
      setEditDescription(quest?.description ?? "");
      prevQuestIdRef.current = quest?.id ?? null;
    }
  }, [quest]);

  useEffect(() => {
    if (isEditing) titleInputRef.current?.focus();
  }, [isEditing]);

  const startEdit = useCallback(() => {
    if (!quest) return;
    setEditTitle(quest.title);
    setEditDescription(quest.description);
    setIsEditing(true);
  }, [quest]);

  const cancelEdit = useCallback(() => {
    if (!quest) return;
    setEditTitle(quest.title);
    setEditDescription(quest.description);
    setIsEditing(false);
  }, [quest]);

  const commitEdit = useCallback(async () => {
    if (!quest) return;
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    const title = editTitle.trim();
    const description = editDescription.trim();
    if (!title) {
      commitInFlightRef.current = false;
      return;
    }
    setIsSaving(true);
    try {
      await onUpdate(quest.id, title, description);
      setEditTitle(title);
      setEditDescription(description);
      setIsEditing(false);
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsSaving(false);
      commitInFlightRef.current = false;
    }
  }, [quest, editTitle, editDescription, onUpdate]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") void commitEdit();
      if (e.key === "Escape") cancelEdit();
    },
    [commitEdit, cancelEdit],
  );

  const handleDescriptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") cancelEdit();
    },
    [cancelEdit],
  );

  return (
    <div className="quest-detail-panel">
      {quest ? (
        <>
          {isEditing ? (
            <div className="quest-detail-edit-header">
              <input
                ref={titleInputRef}
                className="quest-detail-title-input"
                value={editTitle}
                disabled={isSaving}
                maxLength={100}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                }}
                onKeyDown={handleTitleKeyDown}
                aria-label="Quest title"
              />
            </div>
          ) : (
            <div className="quest-detail-title-row">
              <h2 className="quest-detail-title">{quest.title}</h2>
              <button
                type="button"
                className="icon-button"
                onClick={startEdit}
                aria-label="Edit quest"
                title="Edit quest"
              >
                <PencilIcon />
              </button>
            </div>
          )}
          {!isEditing && (
            <>
              <hr className="quest-detail-divider" />
              <button
                type="button"
                className="complete-button"
                onClick={() => {
                  console.log("Mark as complete", quest.id);
                }}
              >
                Mark as Complete
              </button>
            </>
          )}
          {isEditing ? (
            <>
              <textarea
                className="quest-detail-description-input"
                value={editDescription}
                disabled={isSaving}
                rows={6}
                placeholder="Description"
                maxLength={1000}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                }}
                onKeyDown={handleDescriptionKeyDown}
                aria-label="Quest description"
              />
              <div className="quest-detail-edit-actions">
                <button
                  type="button"
                  className="quest-detail-save-button"
                  onClick={() => void commitEdit()}
                  disabled={isSaving || editTitle.trim() === ""}
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="quest-detail-cancel-button"
                  onClick={cancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="description-label">Description</h3>
              <p className="description-text">
                {quest.description || <em className="empty-description">No description.</em>}
              </p>
            </>
          )}
        </>
      ) : (
        <p className="quest-detail-empty-state">Select a quest to see its details.</p>
      )}
    </div>
  );
});
