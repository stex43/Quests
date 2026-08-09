import { useCallback, useRef } from "react";
import type React from "react";
import { completeQuest, createQuest, deleteQuest, uncompleteQuest, updateQuest } from "../../api";
import type { Arc, Quest } from "../../types";
import type { RunMutation } from "./useMutationError";

// The viewer's own calendar day as YYYY-MM-DD. Built from the local getters rather than
// toISOString(), which is UTC and would show the wrong day around midnight for the moment
// between the optimistic flip and the server's answer.
function localCalendarDay(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function patchQuest(arcs: Arc[], questId: string, changes: Partial<Quest>): Arc[] {
  return arcs.map((a) => ({
    ...a,
    quests: a.quests.map((q) => (q.id === questId ? { ...q, ...changes } : q)),
  }));
}

function findQuest(arcs: Arc[], questId: string): Quest | null {
  for (const arc of arcs) {
    const match = arc.quests.find((q) => q.id === questId);
    if (match) return match;
  }
  return null;
}

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
      // A second click while the first is still in flight is a legitimate no-op, but it
      // still goes through runMutation so a stale error from an earlier failure is
      // cleared exactly as it would be on the normal path.
      if (toggleInFlightRef.current.has(questId)) return runMutation(() => Promise.resolve());
      return runMutation(async () => {
        toggleInFlightRef.current.add(questId);
        try {
          // Snapshot of the quest as it was before the optimistic flip, so a failure can
          // restore it exactly instead of reconstructing an approximation. Held in an
          // object because a plain `let` assigned inside the updater below narrows to
          // `null` for the type checker. Assigned with ??= because React may invoke a
          // state updater more than once.
          const snapshot: { quest: Quest | null } = { quest: null };
          // Optimistic flip so the row reacts instantly. The local guess only fills the
          // gap until the response lands; the backend resolves the authoritative day.
          setArcs((prev) => {
            snapshot.quest ??= findQuest(prev, questId);
            return patchQuest(prev, questId, {
              completed: !completed,
              completedOn: completed ? null : localCalendarDay(new Date()),
            });
          });
          try {
            const updated = completed
              ? await uncompleteQuest(questId)
              : await completeQuest(questId);
            // Only the completion fields are taken from the response, so a concurrent
            // title/description edit is not clobbered by this toggle.
            setArcs((prev) =>
              patchQuest(prev, questId, {
                completed: updated.completed,
                completedOn: updated.completedOn,
              }),
            );
          } catch (e) {
            // The request failed, so the server never moved: restore the completion
            // fields from the snapshot, which recovers the original completedOn instead
            // of forcing it to null. Scoped to those two fields for the same reason the
            // success path is — writing the whole snapshot back would revert a title or
            // description edit that landed while this toggle was in flight.
            const original = snapshot.quest;
            if (original)
              setArcs((prev) =>
                patchQuest(prev, questId, {
                  completed: original.completed,
                  completedOn: original.completedOn,
                }),
              );
            throw e;
          }
        } finally {
          toggleInFlightRef.current.delete(questId);
        }
      });
    },
    [runMutation, setArcs],
  );

  return { create, update, remove, toggleComplete };
}
