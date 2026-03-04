import { useEffect, useRef, useState } from "react";
import type { Arc, Quest } from "../types";
import { PencilIcon, TrashIcon } from "./icons";
import { QuestRow } from "./QuestRow";
import styles from "./ArcCard.module.css";

interface ArcCardProps {
  arc: Arc;
  isExpanded: boolean;
  selectedQuestId: string | null;
  onToggleExpand: () => void;
  onSelectQuest: (quest: Quest | null) => void;
  renameArc: (id: string, title: string) => Promise<void>;
  removeArc: (id: string) => Promise<void>;
  addQuest: (title: string, arcId: string) => Promise<Quest>;
  removeQuest: (id: string) => Promise<void>;
}

export function ArcCard({
  arc,
  isExpanded,
  selectedQuestId,
  onToggleExpand,
  onSelectQuest,
  renameArc,
  removeArc,
  addQuest,
  removeQuest,
}: ArcCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [newQuestTitle, setNewQuestTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditing(true);
    setEditingTitle(arc.title);
  }

  async function commitEdit() {
    const title = editingTitle.trim();
    if (title && title !== arc.title) {
      try {
        await renameArc(arc.id, title);
      } catch {
        // error surfaced via useArcs
      }
    }
    setIsEditing(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const hadSelectedQuest = arc.quests.some((q) => q.id === selectedQuestId);
    try {
      await removeArc(arc.id);
      if (hadSelectedQuest) onSelectQuest(null);
    } catch {
      // error surfaced via useArcs
    }
  }

  async function handleCreateQuest() {
    const title = newQuestTitle.trim();
    if (!title) return;
    try {
      await addQuest(title, arc.id);
      setNewQuestTitle("");
    } catch {
      // error surfaced via useArcs
    }
  }

  async function handleDeleteQuest(questId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await removeQuest(questId);
      if (questId === selectedQuestId) onSelectQuest(null);
    } catch {
      // error surfaced via useArcs
    }
  }

  return (
    <div className={styles.arcCard}>
      <div className={styles.arcHeader}>
        <button
          type="button"
          className={styles.arcToggleButton}
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <span className={styles.arcChevron} aria-hidden="true">
            {isExpanded ? "▼" : "▶"}
          </span>
          {!isEditing && <span className={styles.arcTitle}>{arc.title}</span>}
        </button>

        {isEditing && (
          <input
            ref={editInputRef}
            className={styles.arcTitleInput}
            value={editingTitle}
            onChange={(e) => {
              setEditingTitle(e.target.value);
            }}
            onBlur={() => void commitEdit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitEdit();
              if (e.key === "Escape") setIsEditing(false);
            }}
          />
        )}

        <button
          className={styles.iconButton}
          onClick={(e) => {
            startEdit(e);
          }}
          title="Edit arc"
        >
          <PencilIcon />
        </button>
        <button
          className={styles.iconButton}
          onClick={(e) => void handleDelete(e)}
          title="Delete arc"
        >
          <TrashIcon />
        </button>
      </div>

      {isExpanded && (
        <div className={styles.questList}>
          <ul className={styles.questItems}>
            {arc.quests.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                isSelected={selectedQuestId === quest.id}
                onSelect={onSelectQuest}
                onDelete={(questId, e) => {
                  void handleDeleteQuest(questId, e);
                }}
              />
            ))}
          </ul>

          <div className={styles.newQuestRow}>
            <input
              className={styles.newQuestInput}
              placeholder="New quest..."
              value={newQuestTitle}
              onChange={(e) => {
                setNewQuestTitle(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateQuest();
              }}
            />
            <button className={styles.smallAddButton} onClick={() => void handleCreateQuest()}>
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
