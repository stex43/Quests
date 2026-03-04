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
    <div
      className={[styles.questRow, isSelected ? styles.questRowSelected : ""].join(" ").trim()}
      onClick={() => {
        onSelect(quest);
      }}
    >
      <span
        className={[styles.questTitle, isSelected ? styles.questTitleSelected : ""]
          .join(" ")
          .trim()}
      >
        {quest.title}
      </span>
      <button
        className={styles.iconButton}
        onClick={(e) => {
          onDelete(quest.id, e);
        }}
        title="Delete quest"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
