import type { Quest } from "../types";
import styles from "./QuestDetail.module.css";

interface QuestDetailProps {
  quest: Quest | null;
}

export function QuestDetail({ quest }: QuestDetailProps) {
  if (!quest) {
    return <p className={styles.emptyState}>Select a quest to see its details.</p>;
  }

  return (
    <>
      <h2 className={styles.questDetailTitle}>{quest.title}</h2>
      <hr className={styles.divider} />
      <button
        className={styles.completeButton}
        onClick={() => {
          console.log("Mark as complete", quest.id);
        }}
      >
        Mark as Complete
      </button>
      <p className={styles.descriptionLabel}>Description</p>
      <p className={styles.descriptionText}>
        {quest.description || <em style={{ color: "#9ca3af" }}>No description.</em>}
      </p>
    </>
  );
}
