import { useCallback, useState } from "react";
import type { Arc, Quest } from "../../types";

function findQuestById(arcs: Arc[], id: string): Quest | null {
  for (const arc of arcs) {
    const match = arc.quests.find((q) => q.id === id);
    if (match) return match;
  }
  return null;
}

export function useSelectedQuest(arcs: Arc[]) {
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  const select = useCallback((quest: Quest) => {
    setSelectedQuest(quest);
  }, []);

  // Reconcile the selected quest with the latest arcs during render. This keeps
  // selection in sync when the selected quest is updated (fresh object), or
  // cleared when its quest or containing arc is deleted, without a setState-in-
  // effect cascade.
  let reconciled = selectedQuest;
  if (selectedQuest !== null) {
    const found = findQuestById(arcs, selectedQuest.id);
    if (found === null) {
      reconciled = null;
    } else if (
      // This must compare every user-visible field of Quest; add a clause here
      // if Quest gains a new field, otherwise selection can go stale.
      found.title !== selectedQuest.title ||
      found.description !== selectedQuest.description ||
      found.arcId !== selectedQuest.arcId
    ) {
      reconciled = found;
    }
  }

  if (reconciled !== selectedQuest) {
    setSelectedQuest(reconciled);
  }

  return { selectedQuest: reconciled, select };
}
