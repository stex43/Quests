import type { Quest } from "../types";
import { TrashIcon } from "./icons";
import styles from "./QuestRow.module.css";

interface QuestRowProps {
  quest: Quest;
  isSelected: boolean;
  onSelect: (quest: Quest) => void;
  onDelete: (questId: string, e: React.MouseEvent) => void;
}

export function QuestRow({ quest, isSelected, onSelect, onDelete }: QuestRowProps) {
  return (
    <li className={styles.questItem}>
      <button
        type="button"
        className={[styles.questButton, isSelected ? styles.questButtonSelected : ""]
          .join(" ")
          .trim()}
        onClick={() => {
          onSelect(quest);
        }}
      >
        {quest.title}
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={(e) => {
          onDelete(quest.id, e);
        }}
        title="Delete quest"
      >
        <TrashIcon />
      </button>
    </li>
  );
}
