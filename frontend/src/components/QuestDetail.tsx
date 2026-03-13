import { memo } from "react";
import type { Quest } from "../types";
import "./QuestDetail.css";

interface Props {
  quest: Quest | null;
}

export const QuestDetail = memo(function QuestDetail({ quest }: Props) {
  return (
    <div className="quest-detail-panel">
      {quest ? (
        <>
          <h2 className="quest-detail-title">{quest.title}</h2>
          <hr className="quest-detail-divider" />
          <button
            type="button"
            className="complete-button"
            onClick={() => {
              console.log("Mark as complete", quest.id);
            }}
          >
            Mark as Complete
          </button>
          <h3 className="description-label">Description</h3>
          <p className="description-text">
            {quest.description || <em className="empty-description">No description.</em>}
          </p>
        </>
      ) : (
        <p className="quest-detail-empty-state">Select a quest to see its details.</p>
      )}
    </div>
  );
});
