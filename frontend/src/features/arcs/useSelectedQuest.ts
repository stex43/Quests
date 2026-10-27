import { useCallback, useState } from "react";
import type { Arc, Quest } from "../../types";

// Searches every bucket a quest can live in for the active view -- `quests` (open),
// `recentCompleted` (completed today) and `upcoming` (repeating instances due later).
// Without the second, completing the selected quest would make it unfindable the
// instant it moves out of `quests`, clearing the selection and blanking the detail panel
// right when the user just acted on it; without the third, an upcoming instance could
// not be opened at all, and changing a quest's repeat so its next day is ahead would
// blank the panel the same way.
function findQuestById(arcs: Arc[], id: string): Quest | null {
  for (const arc of arcs) {
    const match =
      arc.quests.find((q) => q.id === id) ??
      arc.recentCompleted.find((q) => q.id === id) ??
      arc.upcoming.find((q) => q.id === id);
    if (match) return match;
  }
  return null;
}

export function useSelectedQuest(arcs: Arc[]) {
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  const select = useCallback((quest: Quest) => {
    setSelectedQuestId(quest.id);
  }, []);

  // Derived fresh on every render, so there is nothing to keep in sync with `Quest`'s
  // fields -- an id whose quest was deleted (or whose containing arc was deleted)
  // naturally resolves to null here instead of needing a separate clear-on-delete path.
  const selectedQuest = selectedQuestId !== null ? findQuestById(arcs, selectedQuestId) : null;

  return { selectedQuest, select };
}
