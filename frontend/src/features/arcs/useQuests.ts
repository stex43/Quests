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

// Patches a quest's fields wherever it currently lives -- `quests` or `recentCompleted`.
// A quest is only ever in one of the two at a time, so at most one of these two maps
// does anything. Used by update(), where a title/description edit must land correctly
// regardless of whether the quest is sitting in the open list or the completed-today
// footer/preview.
function patchQuest(arcs: Arc[], questId: string, changes: Partial<Quest>): Arc[] {
  return arcs.map((a) => ({
    ...a,
    quests: a.quests.map((q) => (q.id === questId ? { ...q, ...changes } : q)),
    recentCompleted: a.recentCompleted.map((q) => (q.id === questId ? { ...q, ...changes } : q)),
  }));
}

type Bucket = "quests" | "recentCompleted";

interface QuestLocation {
  quest: Quest;
  arcId: string;
  bucket: Bucket;
}

// Finds a quest and which of an arc's two buckets currently holds it. Used to snapshot
// the pre-optimistic arrangement in toggleComplete: since completing/uncompleting now
// physically moves a quest between arrays instead of patching it in place, a rollback
// needs to know not just the quest's original field values but which array to put it
// back into.
function locateQuest(arcs: Arc[], questId: string): QuestLocation | null {
  for (const arc of arcs) {
    const inQuests = arc.quests.find((q) => q.id === questId);
    if (inQuests) return { quest: inQuests, arcId: arc.id, bucket: "quests" };
    const inRecent = arc.recentCompleted.find((q) => q.id === questId);
    if (inRecent) return { quest: inRecent, arcId: arc.id, bucket: "recentCompleted" };
  }
  return null;
}

// Moves a quest from `quests` into the front of `recentCompleted`, applying `changes`
// (the optimistic guess or the server's authoritative fields) and bumping the arc's
// completedCount. If the quest is *already* in `recentCompleted` -- true the second
// time this runs, once for the optimistic flip and again for the success reconciliation
// -- it just patches the fields in place instead of moving (and re-incrementing) again.
// That double duty is what lets both call sites share one function: the reconciliation
// call doesn't need to know whether the optimistic move already happened.
function moveToRecentCompleted(arcs: Arc[], questId: string, changes: Partial<Quest>): Arc[] {
  return arcs.map((a) => {
    const fromQuests = a.quests.find((q) => q.id === questId);
    if (fromQuests) {
      return {
        ...a,
        quests: a.quests.filter((q) => q.id !== questId),
        recentCompleted: [{ ...fromQuests, ...changes }, ...a.recentCompleted],
        completedCount: a.completedCount + 1,
      };
    }
    if (!a.recentCompleted.some((q) => q.id === questId)) return a;
    return {
      ...a,
      recentCompleted: a.recentCompleted.map((q) => (q.id === questId ? { ...q, ...changes } : q)),
    };
  });
}

// The inverse of moveToRecentCompleted: moves a quest from `recentCompleted` into the
// front of `quests`, decrementing completedCount, or patches it in place if it's
// already in `quests` (the second-call case described above). Used for the active-view
// uncomplete direction and to roll back a failed complete.
function moveToQuests(arcs: Arc[], questId: string, changes: Partial<Quest>): Arc[] {
  return arcs.map((a) => {
    const fromRecent = a.recentCompleted.find((q) => q.id === questId);
    if (fromRecent) {
      return {
        ...a,
        recentCompleted: a.recentCompleted.filter((q) => q.id !== questId),
        quests: [{ ...fromRecent, ...changes }, ...a.quests],
        completedCount: a.completedCount - 1,
      };
    }
    if (!a.quests.some((q) => q.id === questId)) return a;
    return { ...a, quests: a.quests.map((q) => (q.id === questId ? { ...q, ...changes } : q)) };
  });
}

// Archive-shaped uncomplete: `quests` there holds the full completed history and there
// is no separate open bucket to move an uncompleted quest into, so it's just dropped.
function removeFromQuests(arcs: Arc[], questId: string): Arc[] {
  return arcs.map((a) => ({ ...a, quests: a.quests.filter((q) => q.id !== questId) }));
}

// Rollback for the archive-shaped uncomplete case: the optimistic phase removed the
// quest with nowhere to put it, so undoing that means reinserting the exact snapshot
// object (nothing else could have raced with it while it existed nowhere).
function insertIntoQuests(arcs: Arc[], arcId: string, quest: Quest): Arc[] {
  return arcs.map((a) => (a.id === arcId ? { ...a, quests: [quest, ...a.quests] } : a));
}

function patchArc(arcs: Arc[], arcId: string, changes: Partial<Arc>): Arc[] {
  return arcs.map((a) => (a.id === arcId ? { ...a, ...changes } : a));
}

export function useQuests(
  setArcs: React.Dispatch<React.SetStateAction<Arc[]>>,
  runMutation: RunMutation,
  onArcOpenStateChange?: (arcId: string, fullyCompleted: boolean) => void,
) {
  const toggleInFlightRef = useRef<Set<string>>(new Set());

  const create = useCallback(
    (arcId: string, title: string) =>
      runMutation(async () => {
        const quest = await createQuest(title, arcId);
        setArcs((prev) =>
          prev.map((a) =>
            a.id === arcId ? { ...a, quests: [...a.quests, quest], sealedAt: null } : a,
          ),
        );
        onArcOpenStateChange?.(arcId, false);
      }),
    [runMutation, setArcs, onArcOpenStateChange],
  );

  const update = useCallback(
    (questId: string, title: string, description: string) =>
      runMutation(async () => {
        await updateQuest(questId, title, description);
        setArcs((prev) => patchQuest(prev, questId, { title, description }));
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
          // Snapshot of where the quest was, and which bucket held it, before the
          // optimistic move -- a failure needs to move it back to exactly that spot, not
          // just restore field values, since the optimistic phase relocates it between
          // arrays rather than editing it in place. Held in an object for the same
          // ??= reason as before: React may invoke the state updater more than once,
          // and a plain `let` narrows to `null` for the type checker.
          const snapshot: { location: QuestLocation | null } = { location: null };
          // Optimistic move so the row reacts instantly. The local guess only fills the
          // gap until the response lands; the backend resolves the authoritative day.
          setArcs((prev) => {
            const location = locateQuest(prev, questId);
            snapshot.location ??= location;
            const optimisticChanges: Partial<Quest> = {
              completed: !completed,
              completedOn: completed ? null : localCalendarDay(new Date()),
            };
            if (!completed) {
              // Completing: only ever reachable from the active/Tasks view (there's no
              // complete affordance in Archive), so the quest is always in `quests`.
              return moveToRecentCompleted(prev, questId, optimisticChanges);
            }
            // Uncompleting: active-view shape holds it in `recentCompleted`; archive
            // shape holds the full completed history in `quests` with no separate open
            // bucket to move it into, so it's just dropped there instead.
            return location?.bucket === "recentCompleted"
              ? moveToQuests(prev, questId, optimisticChanges)
              : removeFromQuests(prev, questId);
          });
          try {
            if (completed) {
              const updated = await uncompleteQuest(questId);
              // Only the completion fields are taken from the response, so a concurrent
              // title/description edit is not clobbered by this toggle. moveToQuests is
              // a no-op here in the archive-shaped case (the quest is already gone) and
              // an in-place patch in the active-view case (the optimistic move already
              // relocated it) -- either way this call needs no bucket-awareness itself.
              setArcs((prev) => {
                const next = moveToQuests(prev, questId, {
                  completed: updated.completed,
                  completedOn: updated.completedOn,
                });
                // Mirrors the server's auto-unseal on uncomplete, so a stale sealed
                // badge doesn't linger until the next refetch.
                return patchArc(next, updated.arcId, { sealedAt: null });
              });
              onArcOpenStateChange?.(updated.arcId, false);
            } else {
              const { quest: updated, arcFullyCompleted } = await completeQuest(questId);
              setArcs((prev) =>
                moveToRecentCompleted(prev, questId, {
                  completed: updated.completed,
                  completedOn: updated.completedOn,
                }),
              );
              onArcOpenStateChange?.(updated.arcId, arcFullyCompleted);
            }
          } catch (e) {
            // The request failed, so the server never moved: undo whichever move the
            // optimistic phase made, restoring the quest to the bucket the snapshot
            // found it in with its original completion fields. Scoped to those two
            // fields for the same reason the success path is -- restoring the whole
            // snapshot object would revert a title/description edit that landed while
            // this toggle was in flight.
            const loc = snapshot.location;
            if (loc) {
              const restoreChanges: Partial<Quest> = {
                completed: loc.quest.completed,
                completedOn: loc.quest.completedOn,
              };
              setArcs((prev) => {
                if (!completed) {
                  // Completing failed: undo the quests -> recentCompleted move.
                  return moveToQuests(prev, questId, restoreChanges);
                }
                // Uncompleting failed: undo whichever shape-specific move the optimistic
                // phase made -- back into recentCompleted if it came from there, or
                // reinserted into quests if it had been dropped with nowhere to go.
                return loc.bucket === "recentCompleted"
                  ? moveToRecentCompleted(prev, questId, restoreChanges)
                  : insertIntoQuests(prev, loc.arcId, loc.quest);
              });
            }
            throw e;
          }
        } finally {
          toggleInFlightRef.current.delete(questId);
        }
      });
    },
    [runMutation, setArcs, onArcOpenStateChange],
  );

  return { create, update, remove, toggleComplete };
}
