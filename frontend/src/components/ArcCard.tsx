import { useEffect, useRef } from "react";
import type { Arc, Quest } from "../types";
import { PencilIcon, TrashIcon } from "./icons";
import { QuestRow } from "./QuestRow";
import styles from "./ArcCard.module.css";

interface ArcCardProps {
  arc: Arc;
  isExpanded: boolean;
  isEditing: boolean;
  editingArcTitle: string;
  selectedQuestId: string | null;
  newQuestTitle: string;
  onToggleExpand: () => void;
  onStartEdit: (e: React.MouseEvent) => void;
  onEditTitleChange: (title: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onSelectQuest: (quest: Quest) => void;
  onDeleteQuest: (questId: string, e: React.MouseEvent) => void;
  onNewQuestTitleChange: (value: string) => void;
  onCreateQuest: () => void;
}

export function ArcCard({
  arc,
  isExpanded,
  isEditing,
  editingArcTitle,
  selectedQuestId,
  newQuestTitle,
  onToggleExpand,
  onStartEdit,
  onEditTitleChange,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onSelectQuest,
  onDeleteQuest,
  onNewQuestTitleChange,
  onCreateQuest,
}: ArcCardProps) {
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);

  return (
    <div className={styles.arcCard}>
      <div className={styles.arcHeader} onClick={onToggleExpand}>
        <span className={styles.arcChevron}>{isExpanded ? "▼" : "▶"}</span>

        {isEditing ? (
          <input
            ref={editInputRef}
            className={styles.arcTitleInput}
            value={editingArcTitle}
            onChange={(e) => {
              onEditTitleChange(e.target.value);
            }}
            onBlur={onCommitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        ) : (
          <span className={styles.arcTitle}>{arc.title}</span>
        )}

        <button className={styles.iconButton} onClick={onStartEdit} title="Edit arc">
          <PencilIcon />
        </button>
        <button className={styles.iconButton} onClick={onDelete} title="Delete arc">
          <TrashIcon />
        </button>
      </div>

      {isExpanded && (
        <div className={styles.questList}>
          {arc.quests.map((quest) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              isSelected={selectedQuestId === quest.id}
              onSelect={onSelectQuest}
              onDelete={onDeleteQuest}
            />
          ))}

          <div className={styles.newQuestRow}>
            <input
              className={styles.newQuestInput}
              placeholder="New quest..."
              value={newQuestTitle}
              onChange={(e) => {
                onNewQuestTitleChange(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateQuest();
              }}
            />
            <button className={styles.smallAddButton} onClick={onCreateQuest}>
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
