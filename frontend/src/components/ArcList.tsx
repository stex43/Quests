import { useState } from "react";
import type { Arc, Quest } from "../types";
import { ArcCard } from "./ArcCard";
import styles from "./ArcList.module.css";

interface ArcListProps {
  arcs: Arc[];
  selectedQuestId: string | null;
  onSelectQuest: (quest: Quest | null) => void;
  addArc: (title: string) => Promise<Arc>;
  renameArc: (id: string, title: string) => Promise<void>;
  removeArc: (id: string) => Promise<void>;
  addQuest: (title: string, arcId: string) => Promise<Quest>;
  removeQuest: (id: string) => Promise<void>;
}

export function ArcList({
  arcs,
  selectedQuestId,
  onSelectQuest,
  addArc,
  renameArc,
  removeArc,
  addQuest,
  removeQuest,
}: ArcListProps) {
  const [expandedArcIds, setExpandedArcIds] = useState<Set<string>>(() => new Set());
  const [newArcTitle, setNewArcTitle] = useState("");

  function toggleExpand(arcId: string) {
    setExpandedArcIds((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }

  async function handleCreateArc() {
    const title = newArcTitle.trim();
    if (!title) return;
    try {
      const arc = await addArc(title);
      setNewArcTitle("");
      setExpandedArcIds((prev) => new Set([...prev, arc.id]));
    } catch {
      // error surfaced via useArcs
    }
  }

  return (
    <>
      <h1 className={styles.heading}>Arcs</h1>

      <div className={styles.newArcRow}>
        <input
          className={styles.input}
          placeholder="New arc name..."
          value={newArcTitle}
          onChange={(e) => {
            setNewArcTitle(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreateArc();
          }}
        />
        <button className={styles.addButton} onClick={() => void handleCreateArc()}>
          +
        </button>
      </div>

      {arcs.map((arc) => (
        <ArcCard
          key={arc.id}
          arc={arc}
          isExpanded={expandedArcIds.has(arc.id)}
          selectedQuestId={selectedQuestId}
          onToggleExpand={() => {
            toggleExpand(arc.id);
          }}
          onSelectQuest={onSelectQuest}
          renameArc={renameArc}
          removeArc={removeArc}
          addQuest={addQuest}
          removeQuest={removeQuest}
        />
      ))}
    </>
  );
}
