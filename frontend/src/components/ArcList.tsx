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
  onSelectQuest,
}: Props) {
  const [expandedArcIds, setExpandedArcIds] = useState<Set<string>>(() => new Set());
  const [newArcTitle, setNewArcTitle] = useState("");
  const [isCreatingArc, setIsCreatingArc] = useState(false);
  const createArcInFlightRef = useRef(false);

  const toggleExpand = useCallback((arcId: string) => {
    setExpandedArcIds((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }, []);

  const handleDeleteArc = useCallback(
    async (arcId: string) => {
      await onDeleteArc(arcId);
      setExpandedArcIds((prev) => {
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

  return (
    <div className="arc-list-panel">
      <h1 className="arc-list-heading">Arcs</h1>

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

      {arcs.map((arc) => {
        const isArcSelected = arc.quests.some((q) => q.id === selectedQuestId);
        return (
          <ArcCard
            key={arc.id}
            arc={arc}
            isExpanded={expandedArcIds.has(arc.id)}
            selectedQuestId={isArcSelected ? selectedQuestId : null}
            onToggleExpand={toggleExpand}
            onEdit={onUpdateArc}
            onDelete={handleDeleteArc}
            onSelectQuest={onSelectQuest}
            onDeleteQuest={onDeleteQuest}
            onCreateQuest={onCreateQuest}
          />
        );
      })}
    </div>
  );
});
