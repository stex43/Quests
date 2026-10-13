import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Arc, Quest } from "../types";
import { ArcCard } from "./ArcCard";
import "./ArcList.css";

// Mirrors ArcList's own technique for finding the rendered arc cards (each ArcCard
// tags its root with data-arc-id).
function arcCardElements(panel: HTMLElement | null): HTMLElement[] {
  return panel ? Array.from(panel.querySelectorAll<HTMLElement>("[data-arc-id]")) : [];
}

interface Props {
  arcs: Arc[];
  selectedQuestId: string | null;
  focusArcId: string | null;
  onFocusHandled: () => void;
  onSelectQuest: (quest: Quest) => void;
  onDeleteQuest: (questId: string) => Promise<void>;
  onToggleComplete: (questId: string, completed: boolean) => Promise<void>;
  onUpdateArc: (arcId: string, title: string) => Promise<void>;
  onDeleteArc: (arcId: string) => Promise<void>;
  onUnsealArc: (arcId: string) => Promise<void>;
}

// A no-op for the ArcCard props "tasks" mode owns (create-quest, seal, dismiss-seal-
// prompt) -- archive mode never renders the controls that would call them, but the
// props are required since ArcCard is shared between both modes. Module-scoped so
// its identity never changes across renders.
async function noopCreateQuest() {
  /* unreachable in archive mode */
}
function noopVoid() {
  /* unreachable in archive mode */
}

// Sibling to ArcList, not a mode-threaded variant of it: Tasks-only chrome (the
// new-arc form, delete-focus-recovery) doesn't apply here, so a focused sibling
// avoids dead branches. Reuses ArcList.css's arc-list-panel/-header/-title/-body
// classes, which carry no Tasks-specific behaviour.
export const ArchiveList = memo(function ArchiveList({
  arcs,
  selectedQuestId,
  focusArcId,
  onFocusHandled,
  onSelectQuest,
  onDeleteQuest,
  onToggleComplete,
  onUpdateArc,
  onDeleteArc,
  onUnsealArc,
}: Props) {
  // Archive arcs default to expanded too, mirroring ArcList's own default; only the
  // arc being force-opened via focusArcId needs explicit tracking here.
  const [collapsedArcIds, setCollapsedArcIds] = useState<Set<string>>(() => new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Scrolls to the focused arc and hands focus-handling back to the parent. The
  // force-expand itself is a derived value below rather than a setState here, so
  // this effect only reaches out to the DOM and notifies the parent -- neither of
  // which is this component's own state.
  useEffect(() => {
    if (!focusArcId) return;
    const card = arcCardElements(panelRef.current).find((el) => el.dataset.arcId === focusArcId);
    card?.scrollIntoView({ block: "nearest" });
    onFocusHandled();
  }, [focusArcId, onFocusHandled]);

  const toggleExpand = useCallback((arcId: string) => {
    setCollapsedArcIds((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }, []);

  // Render-time derivation, not a state mutation: toggling a quest back to open
  // patches it in place within the shared `arcs` array (see useQuests' toggleComplete)
  // rather than removing it, so this view must re-filter on every render to keep
  // "only completed quests, arcs with none hidden" true without waiting for a refetch.
  const visibleArcs = arcs
    .map((arc) => ({ ...arc, quests: arc.quests.filter((q) => q.completed) }))
    .filter((arc) => arc.quests.length > 0);

  return (
    <div className="arc-list-panel" ref={panelRef}>
      <div className="arc-list-header">
        <span className="arc-list-title">ARCHIVED DEEDS</span>
      </div>

      <div className="arc-list-body">
        {visibleArcs.map((arc) => {
          const isArcSelected = arc.quests.some((q) => q.id === selectedQuestId);
          return (
            <ArcCard
              key={arc.id}
              arc={arc}
              mode="archive"
              isExpanded={arc.id === focusArcId || !collapsedArcIds.has(arc.id)}
              selectedQuestId={isArcSelected ? selectedQuestId : null}
              isSealPrompted={false}
              onToggleExpand={toggleExpand}
              onEdit={onUpdateArc}
              onDelete={onDeleteArc}
              onSelectQuest={onSelectQuest}
              onDeleteQuest={onDeleteQuest}
              onToggleComplete={onToggleComplete}
              onCreateQuest={noopCreateQuest}
              onSeal={noopVoid}
              onUnseal={() => void onUnsealArc(arc.id)}
              onDismissSealPrompt={noopVoid}
            />
          );
        })}
      </div>
    </div>
  );
});
