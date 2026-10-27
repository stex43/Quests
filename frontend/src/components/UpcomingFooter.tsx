import { memo, useState } from "react";
import { formatDay } from "../dateFormat";
import type { Quest } from "../types";
import "./UpcomingFooter.css";
// Same reason as CompletedFooter: the toggle line borrows .arc-chevron from ArcCard.css.
import "./ArcCard.css";

interface Props {
  quests: Quest[];
  selectedQuestId: string | null;
  onSelectQuest: (quest: Quest) => void;
}

// The arc's repeating-quest instances whose due day is still ahead, kept out of the main
// list until then. Unlike CompletedPreviewList's inert rows these select the quest, since
// the detail panel is the only place to edit one, stop its repeat or complete it early.
// Only meaningful when there is at least one -- callers (ArcCard) guard on that before
// rendering this at all, the same contract as CompletedFooter.
export const UpcomingFooter = memo(function UpcomingFooter({
  quests,
  selectedQuestId,
  onSelectQuest,
}: Props) {
  // Defaults to collapsed, like CompletedFooter: the whole point of hiding these until
  // their day is a short main list.
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="upcoming-footer">
      <button
        type="button"
        className="upcoming-footer-toggle"
        aria-expanded={isExpanded}
        onClick={() => {
          setIsExpanded((prev) => !prev);
        }}
      >
        <span
          className={`arc-chevron${isExpanded ? " arc-chevron--expanded" : ""}`}
          aria-hidden="true"
        >
          ▶
        </span>
        {quests.length.toString()} upcoming
      </button>
      {isExpanded && (
        <div className="upcoming-list">
          {quests.map((quest) => {
            const dueLabel = formatDay(quest.dueOn);
            return (
              <div
                className="upcoming-row"
                key={quest.id}
                data-selected={selectedQuestId === quest.id}
              >
                <span className="upcoming-accent" aria-hidden="true" />
                <button
                  type="button"
                  className="upcoming-select-area"
                  onClick={() => {
                    onSelectQuest(quest);
                  }}
                >
                  <span className="upcoming-title">{quest.title}</span>
                  {dueLabel && <span className="upcoming-date">due {dueLabel}</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
