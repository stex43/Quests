import { memo, useState } from "react";
import { TrashIcon } from "./icons";
import type { Quest } from "../types";
import "./QuestRow.css";

interface Props {
  quest: Quest;
  isSelected: boolean;
  onSelect: (quest: Quest) => void;
  onDelete: (questId: string) => Promise<void>;
}

export const QuestRow = memo(function QuestRow({ quest, isSelected, onSelect, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(quest.id);
    } catch {
      // error displayed by parent via mutationError
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="quest-row" data-selected={isSelected}>
      <button
        type="button"
        className="quest-select-area"
        onClick={() => {
          onSelect(quest);
        }}
      >
        <span className="quest-title">{quest.title}</span>
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        aria-label="Delete quest"
        title="Delete quest"
      >
        <TrashIcon />
      </button>
    </div>
  );
});
