import { useCallback } from "react";
import type React from "react";
import { createQuest, deleteQuest, updateQuest } from "../../api";
import type { Arc } from "../../types";
import type { RunMutation } from "./useMutationError";

export function useQuests(
  setArcs: React.Dispatch<React.SetStateAction<Arc[]>>,
  runMutation: RunMutation,
) {
  const create = useCallback(
    (arcId: string, title: string) =>
      runMutation(async () => {
        const quest = await createQuest(title, arcId);
        setArcs((prev) =>
          prev.map((a) => (a.id === arcId ? { ...a, quests: [...a.quests, quest] } : a)),
        );
      }),
    [runMutation, setArcs],
  );

  const update = useCallback(
    (questId: string, title: string, description: string) =>
      runMutation(async () => {
        await updateQuest(questId, title, description);
        setArcs((prev) =>
          prev.map((a) => ({
            ...a,
            quests: a.quests.map((q) => (q.id === questId ? { ...q, title, description } : q)),
          })),
        );
      }),
    [runMutation, setArcs],
  );

  const remove = useCallback(
    (questId: string) =>
      runMutation(async () => {
        await deleteQuest(questId);
        setArcs((prev) =>
          prev.map((a) => ({ ...a, quests: a.quests.filter((q) => q.id !== questId) })),
        );
      }),
    [runMutation, setArcs],
  );

  return { create, update, remove };
}
