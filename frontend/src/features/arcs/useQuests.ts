import { useCallback, useRef } from "react";
import type React from "react";
import { completeQuest, createQuest, deleteQuest, uncompleteQuest, updateQuest } from "../../api";
import type { Arc } from "../../types";
import type { RunMutation } from "./useMutationError";

export function useQuests(
  setArcs: React.Dispatch<React.SetStateAction<Arc[]>>,
  runMutation: RunMutation,
) {
  const toggleInFlightRef = useRef<Set<string>>(new Set());

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

  const toggleComplete = useCallback(
    (questId: string, completed: boolean) => {
      if (toggleInFlightRef.current.has(questId)) return Promise.resolve();
      return runMutation(async () => {
        toggleInFlightRef.current.add(questId);
        setArcs((prev) =>
          prev.map((a) => ({
            ...a,
            quests: a.quests.map((q) => (q.id === questId ? { ...q, completed: !completed } : q)),
          })),
        );
        try {
          if (completed) await uncompleteQuest(questId);
          else await completeQuest(questId);
        } catch (e) {
          setArcs((prev) =>
            prev.map((a) => ({
              ...a,
              quests: a.quests.map((q) => (q.id === questId ? { ...q, completed } : q)),
            })),
          );
          throw e;
        } finally {
          toggleInFlightRef.current.delete(questId);
        }
      });
    },
    [runMutation, setArcs],
  );

  return { create, update, remove, toggleComplete };
}
