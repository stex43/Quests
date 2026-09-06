import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import type { Quest } from "../types";
import { PencilIcon } from "./icons";
import "./QuestDetail.css";

interface Props {
  quest: Quest | null;
  arcTitle: string | null;
  onUpdate: (questId: string, title: string, description: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
}

const NBSP = "\u00a0";

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
  const [editError, setEditError] = useState<string | null>(null);
  // The id of the quest whose save is in flight rather than a bare boolean: the left
  // panel stays interactive during a save, so the selection can move on before the
  // request settles and the two quests have to be told apart.
  const [savingQuestId, setSavingQuestId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const commitInFlightRef = useRef(false);
  const prevQuestIdRef = useRef<string | null>(null);
  // Where focus should land once the controls are interactive again. Disabling the
  // focused input or button during a save blurs it to <body>, so every transition that
  // does that records its destination here and the effect below restores it.
  const pendingFocusRef = useRef<"input" | "description" | "button" | null>(null);
  const errorId = useId();

  const isSaving = savingQuestId !== null;
  // The in-flight save belongs to one quest, so the fields key off this instead of the
  // component-wide flag: if the selection moves mid-flight, the newly selected quest's
  // editor must not inherit the old one's disabled fields -- that would freeze the new
  // draft and make the [isEditing] focus effect below a silent no-op. The button keeps
  // the component-wide gate, which is what commitInFlightRef also enforces.
  const isSavingThisQuest = savingQuestId !== null && savingQuestId === quest?.id;

  // Switching quests closes the editor but deliberately leaves pendingFocusRef null:
  // the user's focus is in the left-hand list, and yanking it into the detail panel
  // would fight them. Only the explicit save/cancel paths request focus.
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

  // Runs on the render that re-enables the controls -- isSaving is in the deps so this
  // fires after the save settles, not while the target is still disabled. It stays on
  // the component-wide flag rather than isSavingThisQuest because the button is
  // disabled on that same flag, and focusing a disabled button silently fails.
  useEffect(() => {
    if (isSaving) return;
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;
    if (target === "input") titleInputRef.current?.focus();
    else if (target === "description") descriptionInputRef.current?.focus();
    else editButtonRef.current?.focus();
  }, [isEditing, isSaving]);

  const startEdit = useCallback(() => {
    if (!quest) return;
    setEditTitle(quest.title);
    setEditDescription(quest.description);
    setEditError(null);
    setIsEditing(true);
  }, [quest]);

  const cancelEdit = useCallback(() => {
    if (!quest) return;
    setEditTitle(quest.title);
    setEditDescription(quest.description);
    setEditError(null);
    // The focused field unmounts with the editor, so send focus to the button it
    // collapses back into.
    pendingFocusRef.current = "button";
    setIsEditing(false);
  }, [quest]);

  const commitEdit = useCallback(async () => {
    if (!quest) return;
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    // Read once, up front: `quest` is the prop this callback closed over, and by the
    // time the await resolves the panel may be showing a different one.
    const questId = quest.id;
    const title = editTitle.trim();
    const description = editDescription.trim();
    if (!title) {
      commitInFlightRef.current = false;
      // The button stays focusable when the title is empty (aria-disabled, not
      // disabled), so a click or Enter lands here and this message is the answer to
      // "why did nothing happen?" -- matching ArcCard's inline editor. Both controls
      // that can trigger it point at the message via aria-describedby.
      setEditError("Title cannot be empty");
      return;
    }
    // Disabling the fields blurs whatever is focused to <body>, so record where the
    // user actually was before that happens. A failed save is a server error shown in
    // the parent's banner, not a title problem, so someone who saved from the
    // description belongs back in the description rather than moved to the title.
    const focusOnFailure: "input" | "description" | "button" =
      document.activeElement === descriptionInputRef.current
        ? "description"
        : document.activeElement === titleInputRef.current
          ? "input"
          : "button";
    setEditError(null);
    setSavingQuestId(questId);
    try {
      await onUpdate(questId, title, description);
      // The selection may have moved while this was in flight, and the new quest's
      // editor may already be open with its own draft. Writing this quest's state now
      // would discard that draft, force that editor closed and pull focus across the
      // panel -- exactly the steal the quest-switch effect above avoids, which it
      // cannot do by itself because it ran before pendingFocusRef was set here.
      if (prevQuestIdRef.current !== questId) return;
      setEditTitle(title);
      setEditDescription(description);
      pendingFocusRef.current = "button";
      setIsEditing(false);
    } catch {
      // error displayed by parent via mutationError. The editor stays open, so put
      // focus back where the user left it -- isEditing never changed, so the effect
      // above is the only thing that can restore it. Same identity guard: this failure
      // belongs to a quest that is no longer on screen.
      if (prevQuestIdRef.current !== questId) return;
      pendingFocusRef.current = focusOnFailure;
    } finally {
      // Unconditional, unlike the writes above: these are component-wide, so they have
      // to clear even when the guards bail out or the editor stays disabled and no
      // further save can ever start.
      setSavingQuestId(null);
      commitInFlightRef.current = false;
    }
  }, [quest, editTitle, editDescription, onUpdate]);

  // One button at the end of the title row serves both modes: it opens the editor as a
  // pencil, then becomes the save control. Its accessible name changes along with it,
  // because the action itself changes -- unlike the stamp, this is not a toggle with a
  // single static name.
  const handleEditButtonClick = useCallback(() => {
    if (isEditing) {
      void commitEdit();
    } else {
      startEdit();
    }
  }, [isEditing, commitEdit, startEdit]);

  // Stays enabled during the round trip for the reasons spelled out in QuestRow: the
  // optimistic flip is the feedback, and disabling a focused button blurs it to <body>.
  // useQuests.toggleComplete holds the double-submit guard.
  const handleToggle = useCallback(async () => {
    if (!quest) return;
    try {
      await onToggleComplete(quest.id, quest.completed);
    } catch {
      // error displayed by parent via mutationError
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

  // Drives aria-disabled rather than disabled: a control the user cannot currently
  // use still has to be reachable by keyboard to explain itself.
  const isTitleEmpty = isEditing && editTitle.trim() === "";

  const completedOnLabel = quest ? formatCompletedOn(quest.completedOn) : null;

  // Split on code points (not UTF-16 units) so an astral first character
  // (e.g. an emoji) isn't torn into broken surrogate halves.
  const titleChars = quest ? Array.from(quest.title) : [];
  const dropCap = titleChars[0] ?? "";
  const rest = titleChars.slice(1).join("");
  // This span starts at the title's second character and is its own flex item,
  // so it begins a line box -- where a leading space would be stripped and
  // "A New Hope" would lose its word space. A NBSP survives that.
  const titleRest = rest.startsWith(" ") ? NBSP + rest.slice(1) : rest;

  return (
    <div className="quest-detail-panel">
      <div className="quest-detail-frame" aria-hidden="true" />
      {quest ? (
        <>
          {/* The header renders in both modes: editing swaps the title for an input in
              place, so the stamp and the meta line stay where they were. */}
          <div className="quest-detail-header">
            <button
              type="button"
              className={`quest-stamp${quest.completed ? " quest-stamp--done" : ""}`}
              aria-pressed={quest.completed}
              aria-label="Toggle quest complete"
              title="Toggle quest complete"
              onClick={() => void handleToggle()}
            >
              {quest.completed && (
                <span className="quest-stamp-glyph" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
            <div className="quest-detail-headings">
              <div className="quest-detail-title-row">
                {isEditing ? (
                  <>
                    {/* The visible <h2> is swapped out for the input, so keep a heading in
                        the document outline. It tracks the draft: someone who jumps to the
                        heading mid-edit should hear what is on screen, not a saved title
                        that is visible nowhere. */}
                    <h2 className="visually-hidden">{editTitle || quest.title}</h2>
                    <input
                      ref={titleInputRef}
                      className={`quest-detail-title-input${editError ? " quest-detail-title-input--error" : ""}`}
                      value={editTitle}
                      disabled={isSavingThisQuest}
                      maxLength={100}
                      onChange={(e) => {
                        setEditTitle(e.target.value);
                        // Only a value that would actually pass the commit check clears
                        // the message: isTitleEmpty trims, so typing a space would
                        // otherwise drop the error and the red outline while the button
                        // stayed aria-disabled and tooltipped "Title required".
                        if (editError && e.target.value.trim() !== "") setEditError(null);
                      }}
                      onKeyDown={handleTitleKeyDown}
                      aria-label="Quest title"
                      aria-describedby={editError ? errorId : undefined}
                    />
                  </>
                ) : (
                  <h2 className="quest-detail-title">
                    <span className="quest-detail-dropcap">{dropCap}</span>
                    <span className="quest-detail-title-rest">{titleRest}</span>
                  </h2>
                )}
                {/* The accessible name is the action and stays the action; the reason the
                    action is currently blocked travels on aria-describedby instead, which
                    also stops the name mutating on every keystroke that crosses the empty
                    boundary. The tooltip still names the blocker for pointer users. */}
                <button
                  ref={editButtonRef}
                  type="button"
                  className={`quest-detail-edit-button${isEditing ? " quest-detail-edit-button--save" : ""}`}
                  onClick={handleEditButtonClick}
                  disabled={isSaving}
                  aria-disabled={isTitleEmpty}
                  aria-label={isEditing ? "Save changes" : "Edit quest"}
                  aria-describedby={editError ? errorId : undefined}
                  title={
                    isTitleEmpty ? "Title required" : isEditing ? "Save changes" : "Edit quest"
                  }
                >
                  {isEditing ? (
                    <span className="quest-detail-save-glyph" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <PencilIcon />
                  )}
                </button>
              </div>
              {/* Its own line under the title row: that row is a flex row, and an inline
                  span there would squeeze the input. role="alert" because nothing else
                  announces it -- when Enter triggers it focus is on the input, and an
                  aria-disabled flip on an unfocused button is announced by nothing. The
                  id backs the aria-describedby on both controls that can trigger it. */}
              {isEditing && editError && (
                <span className="quest-detail-title-error" id={errorId} role="alert">
                  {editError}
                </span>
              )}
              <div className="quest-detail-meta">
                Arc: {arcTitle ?? "Unassigned"} ·{" "}
                {quest.completed
                  ? completedOnLabel
                    ? `Completed ${completedOnLabel}`
                    : "Completed"
                  : "Active"}
              </div>
            </div>
          </div>

          {isEditing ? (
            <textarea
              ref={descriptionInputRef}
              className="quest-detail-description-input"
              value={editDescription}
              disabled={isSavingThisQuest}
              rows={4}
              placeholder="Description"
              maxLength={1000}
              onChange={(e) => {
                setEditDescription(e.target.value);
              }}
              onKeyDown={handleDescriptionKeyDown}
              aria-label="Quest description"
            />
          ) : (
            <p className="description-text">
              {quest.description || <em className="empty-description">No description.</em>}
            </p>
          )}

          <div className="quest-detail-subtasks-label">SUBTASKS</div>
          <div className="quest-detail-subtask-card">
            <span className="quest-detail-subtask-empty">No subtasks yet.</span>
          </div>
        </>
      ) : (
        <p className="quest-detail-empty-state">Select a quest to see its details.</p>
      )}
    </div>
  );
});
