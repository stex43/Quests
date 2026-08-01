import { memo, useCallback, useRef, useState } from "react";
import type { Arc, Quest } from "../types";
import { ArcCard } from "./ArcCard";
import "./ArcList.css";

interface Props {
  arcs: Arc[];
  selectedQuestId: string | null;
  mutationError: string | null;
  onDismissError: () => void;
  onCreateArc: (title: string) => Promise<void>;
  onUpdateArc: (arcId: string, title: string) => Promise<void>;
  onDeleteArc: (arcId: string) => Promise<void>;
  onCreateQuest: (arcId: string, title: string) => Promise<void>;
  onDeleteQuest: (questId: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
  onSelectQuest: (quest: Quest) => void;
}

export const ArcList = memo(function ArcList({
  arcs,
  selectedQuestId,
  mutationError,
  onDismissError,
  onCreateArc,
  onUpdateArc,
  onDeleteArc,
  onCreateQuest,
  onDeleteQuest,
  onToggleComplete,
  onSelectQuest,
}: Props) {
  // Groups default to expanded (mock opens all), so we track the *collapsed*
  // set instead of the expanded one.
  const [collapsedArcIds, setCollapsedArcIds] = useState<Set<string>>(() => new Set());
  const [showCompleted, setShowCompleted] = useState(true);
  const [newArcTitle, setNewArcTitle] = useState("");
  const [isCreatingArc, setIsCreatingArc] = useState(false);
  const createArcInFlightRef = useRef(false);

  const toggleExpand = useCallback((arcId: string) => {
    setCollapsedArcIds((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }, []);

  const handleDeleteArc = useCallback(
    async (arcId: string) => {
      await onDeleteArc(arcId);
      setCollapsedArcIds((prev) => {
        const next = new Set(prev);
        next.delete(arcId);
        return next;
      });
    },
    [onDeleteArc],
  );

  async function handleCreateArc() {
    if (createArcInFlightRef.current) return;
    const title = newArcTitle.trim();
    if (!title) return;
    createArcInFlightRef.current = true;
    setIsCreatingArc(true);
    try {
      await onCreateArc(title);
      setNewArcTitle("");
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsCreatingArc(false);
      createArcInFlightRef.current = false;
    }
  }

  // When "show completed" is off, hide groups whose only quests are completed
  // (they would render empty), mirroring the mock's visibleGroups filter. Arcs
  // with no quests at all are kept so newly created / empty arcs stay reachable.
  const visibleArcs = showCompleted
    ? arcs
    : arcs.filter((arc) => arc.quests.length === 0 || arc.quests.some((quest) => !quest.completed));

  return (
    <div className="arc-list-panel">
      <div className="arc-list-header">
        <span className="arc-list-title">ONGOING DEEDS</span>
        <label className="show-completed-toggle">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => {
              setShowCompleted(e.target.checked);
            }}
          />
          show completed
        </label>
      </div>

      <div className="arc-list-body">
        {mutationError && (
          <div className="error-banner">
            <span>{mutationError}</span>
            <button
              type="button"
              className="error-banner-close"
              onClick={onDismissError}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="new-arc-row">
          <input
            className="arc-list-input"
            placeholder="New arc name..."
            value={newArcTitle}
            disabled={isCreatingArc}
            onChange={(e) => {
              setNewArcTitle(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateArc();
            }}
          />
          <button
            type="button"
            aria-label="Add arc"
            className="add-button"
            onClick={() => void handleCreateArc()}
            disabled={isCreatingArc}
          >
            +
          </button>
        </div>

        {visibleArcs.map((arc) => {
          const isArcSelected = arc.quests.some((q) => q.id === selectedQuestId);
          return (
            <ArcCard
              key={arc.id}
              arc={arc}
              isExpanded={!collapsedArcIds.has(arc.id)}
              showCompleted={showCompleted}
              selectedQuestId={isArcSelected ? selectedQuestId : null}
              onToggleExpand={toggleExpand}
              onEdit={onUpdateArc}
              onDelete={handleDeleteArc}
              onSelectQuest={onSelectQuest}
              onDeleteQuest={onDeleteQuest}
              onToggleComplete={onToggleComplete}
              onCreateQuest={onCreateQuest}
            />
          );
        })}
      </div>
    </div>
  );
});
