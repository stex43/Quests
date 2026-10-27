import { useCallback, useRef } from "react";
import type React from "react";
import {
  clearQuestRecurrence,
  completeQuest,
  createQuest,
  deleteQuest,
  setQuestRecurrence,
  uncompleteQuest,
  updateQuest,
} from "../../api";
import { localCalendarDay } from "../../dateFormat";
import type { Arc, Quest, Recurrence } from "../../types";
import type { RunMutation } from "./useMutationError";

type Bucket = "quests" | "recentCompleted" | "upcoming";
// The two buckets an open quest can live in: `upcoming` for a repeating instance whose
// due day is still ahead, `quests` for everything else.
type OpenBucket = "quests" | "upcoming";

type RecurrenceFields = Pick<Quest, "recurrence" | "seriesId" | "dueOn">;

// Mirrors the server's split: an open quest is upcoming exactly when it has a due day
// after the viewer's today. Both sides are YYYY-MM-DD, so string order is date order.
function openBucketFor(dueOn: string | null, today: string): OpenBucket {
  return dueOn !== null && dueOn > today ? "upcoming" : "quests";
}

function withBucket(arc: Arc, bucket: Bucket, quests: Quest[]): Arc {
  switch (bucket) {
    case "quests":
      return { ...arc, quests };
    case "recentCompleted":
      return { ...arc, recentCompleted: quests };
    case "upcoming":
      return { ...arc, upcoming: quests };
  }
}

// `upcoming` is kept soonest-first like the server sends it: the quest goes after every
// entry due on or before its own day, so same-day entries keep their arrival order.
function insertByDueOn(upcoming: Quest[], quest: Quest): Quest[] {
  const index = upcoming.findIndex((q) => (q.dueOn ?? "") > (quest.dueOn ?? ""));
  return index === -1
    ? [...upcoming, quest]
    : [...upcoming.slice(0, index), quest, ...upcoming.slice(index)];
}

// Adds a quest the server just created (a new quest, or a series' next instance) to
// whichever open bucket its due day puts it in. Appended to `quests` to match the
// server's oldest-first order; slotted into `upcoming` by due day.
function insertOpenQuest(arcs: Arc[], quest: Quest, today: string): Arc[] {
  return arcs.map((a) => {
    if (a.id !== quest.arcId) return a;
    return openBucketFor(quest.dueOn, today) === "upcoming"
      ? { ...a, upcoming: insertByDueOn(a.upcoming, quest) }
      : { ...a, quests: [...a.quests, quest] };
  });
}

// Patches a quest's fields wherever it currently lives -- `quests`, `recentCompleted` or
// `upcoming`. A quest is only ever in one of them at a time, so at most one of these maps
// does anything. Used by update(), where a title/description edit must land correctly
// regardless of whether the quest is sitting in the open list, the completed-today
// footer/preview or the upcoming footer.
function patchQuest(arcs: Arc[], questId: string, changes: Partial<Quest>): Arc[] {
  const patch = (q: Quest) => (q.id === questId ? { ...q, ...changes } : q);
  return arcs.map((a) => ({
    ...a,
    quests: a.quests.map(patch),
    recentCompleted: a.recentCompleted.map(patch),
    upcoming: a.upcoming.map(patch),
  }));
}

// Drops a quest from both open buckets: used by remove() and to discard the instance an
// un-complete made the server delete.
function removeOpenQuest(arcs: Arc[], questId: string): Arc[] {
  return arcs.map((a) => ({
    ...a,
    quests: a.quests.filter((q) => q.id !== questId),
    upcoming: a.upcoming.filter((q) => q.id !== questId),
  }));
}

interface QuestLocation {
  quest: Quest;
  arcId: string;
  bucket: Bucket;
}

const BUCKETS: readonly Bucket[] = ["quests", "recentCompleted", "upcoming"];

function locateInArc(arc: Arc, questId: string): QuestLocation | null {
  for (const bucket of BUCKETS) {
    const quest = arc[bucket].find((q) => q.id === questId);
    if (quest) return { quest, arcId: arc.id, bucket };
  }
  return null;
}

// Finds a quest and which of an arc's three buckets currently holds it. Used to snapshot
// the pre-optimistic arrangement in toggleComplete: since completing/uncompleting
// physically moves a quest between arrays instead of patching it in place, a rollback
// needs to know not just the quest's original field values but which array to put it
// back into.
function locateQuest(arcs: Arc[], questId: string): QuestLocation | null {
  for (const arc of arcs) {
    const location = locateInArc(arc, questId);
    if (location) return location;
  }
  return null;
}

// Moves a quest from an open bucket (`quests`, or `upcoming` when an instance is completed
// early) into the front of `recentCompleted`, applying `changes` (the optimistic guess or
// the server's authoritative fields) and bumping the arc's completedCount. If the quest is
// *already* in `recentCompleted` -- true the second time this runs, once for the
// optimistic flip and again for the success reconciliation -- it just patches the fields
// in place instead of moving (and re-incrementing) again. That double duty is what lets
// both call sites share one function: the reconciliation call doesn't need to know
// whether the optimistic move already happened.
function moveToRecentCompleted(arcs: Arc[], questId: string, changes: Partial<Quest>): Arc[] {
  return arcs.map((a) => {
    const location = locateInArc(a, questId);
    if (!location) return a;
    const quest = { ...location.quest, ...changes };
    if (location.bucket === "recentCompleted") {
      return withBucket(
        a,
        "recentCompleted",
        a.recentCompleted.map((q) => (q.id === questId ? quest : q)),
      );
    }
    return {
      ...withBucket(
        a,
        location.bucket,
        a[location.bucket].filter((q) => q.id !== questId),
      ),
      recentCompleted: [quest, ...a.recentCompleted],
      completedCount: a.completedCount + 1,
    };
  });
}

// The inverse of moveToRecentCompleted: moves a quest into the open bucket `target`,
// decrementing completedCount if it came out of `recentCompleted`, or patches it in place
// if it's already in `target` (the second-call case described above). Lands at the end
// of `quests`, matching the server's oldest-first order for the instances that usually
// move there (a series' latest, so newest, row), or at its due-day slot in `upcoming`.
// Used for the active-view uncomplete direction, to roll back a failed complete, and by
// setRecurrence, whose new due day can carry an open quest from one open bucket to the
// other.
function moveToOpen(
  arcs: Arc[],
  questId: string,
  changes: Partial<Quest>,
  target: OpenBucket,
): Arc[] {
  return arcs.map((a) => {
    const location = locateInArc(a, questId);
    if (!location) return a;
    const quest = { ...location.quest, ...changes };
    if (location.bucket === target) {
      return withBucket(
        a,
        target,
        a[target].map((q) => (q.id === questId ? quest : q)),
      );
    }
    const without = withBucket(
      a,
      location.bucket,
      a[location.bucket].filter((q) => q.id !== questId),
    );
    const placed =
      target === "upcoming"
        ? { ...without, upcoming: insertByDueOn(without.upcoming, quest) }
        : { ...without, quests: [...without.quests, quest] };
    return location.bucket === "recentCompleted"
      ? { ...placed, completedCount: a.completedCount - 1 }
      : placed;
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

// Lands a quest's recurrence fields and, for an open quest, re-files it by its (possibly
// new) due day. A quest completed while the change was in flight stays where completion
// put it: only its fields are patched, since pulling it out of `recentCompleted` would
// undo a completion the server has also recorded.
function applyRecurrenceFields(arcs: Arc[], questId: string, fields: RecurrenceFields): Arc[] {
  const location = locateQuest(arcs, questId);
  if (!location) return arcs;
  if (location.bucket === "recentCompleted") return patchQuest(arcs, questId, fields);
  return moveToOpen(
    arcs,
    questId,
    fields,
    openBucketFor(fields.dueOn, localCalendarDay(new Date())),
  );
}

function recurrenceFieldsOf(quest: Quest): RecurrenceFields {
  return { recurrence: quest.recurrence, seriesId: quest.seriesId, dueOn: quest.dueOn };
}

export function useQuests(
  setArcs: React.Dispatch<React.SetStateAction<Arc[]>>,
  runMutation: RunMutation,
  onArcOpenStateChange?: (arcId: string, fullyCompleted: boolean) => void,
) {
  const toggleInFlightRef = useRef<Set<string>>(new Set());
  // Per-quest latest-wins queue for setRecurrence. The picker fires on every click, and
  // two overlapping requests for one quest could land at the server in either order, so
  // only one is ever in flight per quest; a change made meanwhile waits here (replacing
  // any older waiting one) and is sent when the current request settles.
  const recurrenceInFlightRef = useRef<Set<string>>(new Set());
  const recurrenceQueuedRef = useRef<Map<string, Recurrence | null>>(new Map());
  // Quests remove() is deleting or has deleted. A setRecurrence request racing the delete
  // can only 404, and that failure is about a quest the user has already got rid of, so
  // it is swallowed rather than surfaced as a banner. Entries stay after a successful
  // delete (the id is never reused, so this holds at most one per quest deleted this
  // session) because the racing response can land after the delete's own.
  const removedQuestIdsRef = useRef<Set<string>>(new Set());

  const create = useCallback(
    (arcId: string, title: string, recurrence: Recurrence | null = null) =>
      runMutation(async () => {
        const quest = await createQuest(title, arcId, "", recurrence);
        // A repeating quest's first occurrence can be a later day, in which case it
        // belongs in `upcoming` rather than the open list.
        setArcs((prev) =>
          patchArc(insertOpenQuest(prev, quest, localCalendarDay(new Date())), arcId, {
            sealedAt: null,
          }),
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
        // Marked before the request, since a racing setRecurrence can fail before this
        // delete's response arrives. A rule change still queued behind an in-flight one
        // is dropped too: sent after the delete it could only 404.
        removedQuestIdsRef.current.add(questId);
        recurrenceQueuedRef.current.delete(questId);
        try {
          await deleteQuest(questId);
        } catch (e) {
          removedQuestIdsRef.current.delete(questId);
          throw e;
        }
        setArcs((prev) => removeOpenQuest(prev, questId));
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
            const today = localCalendarDay(new Date());
            const optimisticChanges: Partial<Quest> = {
              completed: !completed,
              completedOn: completed ? null : today,
            };
            if (!completed) {
              // Completing: only ever reachable from the active/Tasks view (there's no
              // complete affordance in Archive), so the quest is in `quests`, or in
              // `upcoming` when a repeating instance is completed ahead of its day.
              return moveToRecentCompleted(prev, questId, optimisticChanges);
            }
            // Uncompleting: active-view shape holds it in `recentCompleted`, and it goes
            // back to whichever open bucket its due day puts it in (an instance completed
            // early returns to `upcoming`). Archive shape holds the full completed history
            // in `quests` with no separate open bucket to move it into, so it's just
            // dropped there instead.
            return location?.bucket === "recentCompleted"
              ? moveToOpen(
                  prev,
                  questId,
                  optimisticChanges,
                  openBucketFor(location.quest.dueOn, today),
                )
              : removeFromQuests(prev, questId);
          });
          try {
            if (completed) {
              const { quest: updated, removedInstanceId } = await uncompleteQuest(questId);
              // Only the completion and recurrence fields are taken from the response, so
              // a concurrent title/description edit is not clobbered by this toggle. The
              // recurrence fields matter because only a series' latest completed instance
              // gets the undo; an older one, or one whose series was stopped, comes back
              // as a plain quest (no rule, no due day). moveToOpen is a no-op here in the
              // archive-shaped case (the quest is already gone); in the active-view case
              // it patches in place, or carries the quest across from `upcoming` when the
              // server cleared the due day the optimistic move filed it by.
              setArcs((prev) => {
                let next = moveToOpen(
                  prev,
                  questId,
                  {
                    completed: updated.completed,
                    completedOn: updated.completedOn,
                    ...recurrenceFieldsOf(updated),
                  },
                  openBucketFor(updated.dueOn, localCalendarDay(new Date())),
                );
                // The latest-instance undo: the server deleted the instance this one's
                // completion had spawned, so this one is the series' open instance again.
                // Null in the plain case, where nothing was deleted.
                if (removedInstanceId !== null) next = removeOpenQuest(next, removedInstanceId);
                // Mirrors the server's auto-unseal on uncomplete, so a stale sealed
                // badge doesn't linger until the next refetch.
                return patchArc(next, updated.arcId, { sealedAt: null });
              });
              onArcOpenStateChange?.(updated.arcId, false);
            } else {
              const {
                quest: updated,
                arcFullyCompleted,
                nextInstance,
              } = await completeQuest(questId);
              setArcs((prev) => {
                const next = moveToRecentCompleted(prev, questId, {
                  completed: updated.completed,
                  completedOn: updated.completedOn,
                });
                // A repeating quest's completion spawned its next occurrence, which is
                // always a later day and so normally lands in `upcoming`.
                return nextInstance
                  ? insertOpenQuest(next, nextInstance, localCalendarDay(new Date()))
                  : next;
              });
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
                  // Completing failed: undo the move into recentCompleted, back into
                  // whichever open bucket it came from.
                  return moveToOpen(
                    prev,
                    questId,
                    restoreChanges,
                    loc.bucket === "upcoming" ? "upcoming" : "quests",
                  );
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

  // Sets (rule) or stops (null) a quest's repeat. The rule is applied optimistically:
  // the picker is controlled by quest.recurrence, so without it a second click before the
  // response would be computed from the stale rule and drop the first. The due day, the
  // series id and so the bucket only change once the server has answered.
  const setRecurrence = useCallback(
    (questId: string, rule: Recurrence | null) => {
      const isQueued = recurrenceInFlightRef.current.has(questId);
      // Same ??= / object-holder reasoning as toggleComplete's snapshot. Taken only by
      // the call that starts the chain: a queued call's "before" is already optimistic.
      const snapshot: { fields: RecurrenceFields | null } = { fields: null };
      setArcs((prev) => {
        if (!isQueued) {
          const location = locateQuest(prev, questId);
          snapshot.fields ??= location ? recurrenceFieldsOf(location.quest) : null;
        }
        return patchQuest(prev, questId, { recurrence: rule });
      });
      if (isQueued) {
        recurrenceQueuedRef.current.set(questId, rule);
        // Mirrors toggleComplete's in-flight no-op: still clears a stale error.
        return runMutation(() => Promise.resolve());
      }
      return runMutation(async () => {
        recurrenceInFlightRef.current.add(questId);
        // The last state the server confirmed, which is what a failure restores: the
        // pre-change snapshot until a request in this chain succeeds.
        let confirmed: RecurrenceFields | null = null;
        try {
          let next: Recurrence | null = rule;
          for (;;) {
            const updated =
              next === null
                ? await clearQuestRecurrence(questId)
                : await setQuestRecurrence(questId, next);
            confirmed = recurrenceFieldsOf(updated);
            const queued = recurrenceQueuedRef.current;
            if (!queued.has(questId)) break;
            next = queued.get(questId) ?? null;
            queued.delete(questId);
          }
          // Only the final answer is applied, so the quest doesn't hop between buckets
          // for intermediate rules. Only the recurrence fields are taken from it, for the
          // same don't-clobber-a-concurrent-edit reason as toggleComplete.
          const fields = confirmed;
          setArcs((prev) => applyRecurrenceFields(prev, questId, fields));
        } catch (e) {
          // Read here rather than up front: the optimistic updater may not have run yet
          // when this function starts, but it has by the time a request has failed.
          const restore = confirmed ?? snapshot.fields;
          // A no-op once the quest is gone: applyRecurrenceFields skips a missing quest.
          if (restore) setArcs((prev) => applyRecurrenceFields(prev, questId, restore));
          // The quest was deleted under this request (see removedQuestIdsRef), so the
          // failure is expected and there's nothing left for the user to retry.
          if (removedQuestIdsRef.current.has(questId)) return;
          throw e;
        } finally {
          recurrenceInFlightRef.current.delete(questId);
          // A change queued behind a failed request is dropped with it: the picker
          // already shows the restored rule, so the user can simply choose again.
          recurrenceQueuedRef.current.delete(questId);
        }
      });
    },
    [runMutation, setArcs],
  );

  return { create, update, remove, toggleComplete, setRecurrence };
}
