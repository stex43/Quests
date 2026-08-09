import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Quest } from "../types";
import { PencilIcon } from "./icons";
import "./QuestDetail.css";

interface Props {
  quest: Quest | null;
  arcTitle: string | null;
  onUpdate: (questId: string, title: string, description: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
}

// The data model has no reminder field, so this always returns null and the
// reminder callout stays hidden. The code path is kept so a future reminder
// field can light it up without markup changes.
function getReminder(): string | null {
  return null;
}

// Reshapes the server's YYYY-MM-DD into dd.MM.yyyy. Purely textual on purpose: the value
// is a calendar day with no time zone, and `new Date("2026-01-01")` would read it as UTC
// midnight and render the previous day for anyone west of UTC. Returns null for a missing
// or malformed value so the caller can fall back to prose.
function formatCompletedOn(completedOn: string | null): string | null {
  if (!completedOn) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completedOn);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

export const QuestDetail = memo(function QuestDetail({
  quest,
  arcTitle,
  onUpdate,
  onToggleComplete,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const commitInFlightRef = useRef(false);
  const prevQuestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (quest?.id !== prevQuestIdRef.current) {
      setIsEditing(false);
      setIsToggling(false);
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

  const handleToggle = useCallback(async () => {
    if (!quest) return;
    setIsToggling(true);
    try {
      await onToggleComplete(quest.id, quest.completed);
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsToggling(false);
    }
  }, [quest, onToggleComplete]);

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

  // Hidden-when-empty reminder callout (no data exists, so it never renders).
  const reminder = quest ? getReminder() : null;

  const completedOnLabel = quest ? formatCompletedOn(quest.completedOn) : null;

  // Split on code points (not UTF-16 units) so an astral first character
  // (e.g. an emoji) isn't torn into broken surrogate halves.
  const titleChars = quest ? Array.from(quest.title) : [];
  const dropCap = titleChars[0] ?? "";
  const titleRest = titleChars.slice(1).join("");

  return (
    <div className="quest-detail-panel">
      <div className="quest-detail-frame" aria-hidden="true" />
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
            <>
              <div className="quest-detail-title-row">
                <h2 className="quest-detail-title">
                  <span className="quest-detail-dropcap">{dropCap}</span>
                  <span className="quest-detail-title-rest">{titleRest}</span>
                </h2>
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
              <div className="quest-detail-meta">
                Arc: {arcTitle ?? "Unassigned"} · {quest.completed ? "Completed" : "Active"}
              </div>
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
              <div className="quest-detail-status">
                <button
                  type="button"
                  aria-pressed={quest.completed}
                  className={`complete-button${quest.completed ? " complete-button--done" : ""}`}
                  disabled={isToggling}
                  onClick={() => void handleToggle()}
                >
                  {quest.completed ? "Mark as Incomplete" : "Mark as Complete"}
                </button>
                {quest.completed && (
                  <span className="quest-detail-completed-at">
                    {completedOnLabel
                      ? `Completed on ${completedOnLabel}`
                      : "Completion date unrecorded"}
                  </span>
                )}
              </div>

              {reminder && <div className="quest-detail-reminder">{reminder}</div>}

              <p className="description-text">
                {quest.description || <em className="empty-description">No description.</em>}
              </p>

              <div className="quest-detail-subtasks-label">SUBTASKS</div>
              <div className="quest-detail-subtask-card">
                <span className="quest-detail-subtask-empty">No subtasks yet.</span>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="quest-detail-empty-state">Select a quest to see its details.</p>
      )}
    </div>
  );
});
