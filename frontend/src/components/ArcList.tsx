import type { Arc, Quest } from "../types";
import { ArcCard } from "./ArcCard";
import styles from "./ArcList.module.css";

interface ArcListProps {
  arcs: Arc[];
  expandedArcIds: Set<string>;
  editingArcId: string | null;
  editingArcTitle: string;
  selectedQuestId: string | null;
  newArcTitle: string;
  newQuestTitles: Record<string, string>;
  onNewArcTitleChange: (value: string) => void;
  onCreateArc: () => void;
  onToggleExpand: (arcId: string) => void;
  onStartEdit: (arc: Arc, e: React.MouseEvent) => void;
  onEditTitleChange: (title: string) => void;
  onCommitEdit: (arcId: string) => void;
  onCancelEdit: () => void;
  onDeleteArc: (arcId: string, e: React.MouseEvent) => void;
  onSelectQuest: (quest: Quest) => void;
  onDeleteQuest: (questId: string, e: React.MouseEvent) => void;
  onNewQuestTitleChange: (arcId: string, value: string) => void;
  onCreateQuest: (arcId: string) => void;
}

export function ArcList({
  arcs,
  expandedArcIds,
  editingArcId,
  editingArcTitle,
  selectedQuestId,
  newArcTitle,
  newQuestTitles,
  onNewArcTitleChange,
  onCreateArc,
  onToggleExpand,
  onStartEdit,
  onEditTitleChange,
  onCommitEdit,
  onCancelEdit,
  onDeleteArc,
  onSelectQuest,
  onDeleteQuest,
  onNewQuestTitleChange,
  onCreateQuest,
}: ArcListProps) {
  return (
    <>
      <h1 className={styles.heading}>Arcs</h1>

      <div className={styles.newArcRow}>
        <input
          className={styles.input}
          placeholder="New arc name..."
          value={newArcTitle}
          onChange={(e) => {
            onNewArcTitleChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCreateArc();
          }}
        />
        <button className={styles.addButton} onClick={onCreateArc}>
          +
        </button>
      </div>

      {arcs.map((arc) => (
        <ArcCard
          key={arc.id}
          arc={arc}
          isExpanded={expandedArcIds.has(arc.id)}
          isEditing={editingArcId === arc.id}
          editingArcTitle={editingArcTitle}
          selectedQuestId={selectedQuestId}
          newQuestTitle={newQuestTitles[arc.id] ?? ""}
          onToggleExpand={() => {
            onToggleExpand(arc.id);
          }}
          onStartEdit={(e) => {
            onStartEdit(arc, e);
          }}
          onEditTitleChange={onEditTitleChange}
          onCommitEdit={() => {
            onCommitEdit(arc.id);
          }}
          onCancelEdit={onCancelEdit}
          onDelete={(e) => {
            onDeleteArc(arc.id, e);
          }}
          onSelectQuest={onSelectQuest}
          onDeleteQuest={onDeleteQuest}
          onNewQuestTitleChange={(value) => {
            onNewQuestTitleChange(arc.id, value);
          }}
          onCreateQuest={() => {
            onCreateQuest(arc.id);
          }}
        />
      ))}
    </>
  );
}
