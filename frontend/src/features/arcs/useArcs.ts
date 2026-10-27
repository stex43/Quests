import { useCallback, useEffect, useState } from "react";
import { createArc, deleteArc, getArcs, sealArc, unsealArc, updateArc } from "../../api";
import { localCalendarDay } from "../../dateFormat";
import type { Arc } from "../../types";
import type { RunMutation } from "./useMutationError";

export function useArcs(view: "active" | "archive", runMutation: RunMutation) {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The local day each piece of state was fetched for, taken when the request starts
    // (data fetched at 23:59:59 describes the old day even if it lands after midnight).
    // `fetchedDay` is set only once a fetch succeeds; `inFlightDay` dedupes the focus and
    // visibilitychange events, which usually fire together.
    let fetchedDay: string | null = null;
    let inFlightDay: string | null = null;
    // Latest-wins between this effect's own fetches: an older background refetch
    // resolving late must not overwrite a newer one.
    let latestRequest = 0;
    let midnightTimer: number | undefined;

    function load(background: boolean) {
      const requestId = ++latestRequest;
      const day = localCalendarDay(new Date());
      inFlightDay = day;
      // Not gated on `loading`: view switches keep showing the previous view's arcs
      // (and the header/nav) until the new fetch resolves, rather than blanking the
      // whole app back to the full-page "Loading..." state on every tab click.
      // `cancelled` guards against the classic stale-response race: if this effect
      // re-runs (the user switched views again) before this fetch resolves, its
      // result must never overwrite whatever the newer fetch already set.
      getArcs(view)
        .then((data) => {
          if (cancelled || requestId !== latestRequest) return;
          fetchedDay = day;
          setArcs(data);
        })
        .catch((err: unknown) => {
          // A failed background refetch keeps the arcs already on screen rather than
          // replacing the whole app with the full-page error; the next focus or
          // midnight tick retries, since fetchedDay still holds the old day.
          if (!cancelled && !background) {
            setError(err instanceof Error ? err.message : String(err));
          }
        })
        .finally(() => {
          if (requestId === latestRequest) inFlightDay = null;
          if (!cancelled && !background) setLoading(false);
        });
    }

    // Which quests are due, upcoming or completed today all hang on the local day, so a
    // tab left open across midnight would otherwise keep showing yesterday's split.
    // Skipped until a first fetch has succeeded: before that there's nothing stale.
    function refetchIfDayChanged() {
      const today = localCalendarDay(new Date());
      if (fetchedDay === null || today === fetchedDay || today === inFlightDay) return;
      load(true);
    }

    // A few seconds past local midnight, so the server's own "today" (resolved from the
    // same offset) has certainly rolled over too. Built from local date parts so DST
    // days of 23 or 25 hours still land on midnight. Timers can be throttled or paused
    // in a background tab or a sleeping machine, which the focus/visibility checks cover.
    function armMidnightTimer() {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      midnightTimer = window.setTimeout(() => {
        refetchIfDayChanged();
        armMidnightTimer();
      }, nextMidnight.getTime() - now.getTime());
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") refetchIfDayChanged();
    }

    load(false);
    armMidnightTimer();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refetchIfDayChanged);
    return () => {
      cancelled = true;
      window.clearTimeout(midnightTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refetchIfDayChanged);
    };
  }, [view]);

  const create = useCallback(
    (title: string) =>
      runMutation(async () => {
        const arc = await createArc(title);
        setArcs((prev) => [arc, ...prev]);
      }),
    [runMutation],
  );

  const update = useCallback(
    (arcId: string, title: string) =>
      runMutation(async () => {
        await updateArc(arcId, title);
        setArcs((prev) => prev.map((a) => (a.id === arcId ? { ...a, title } : a)));
      }),
    [runMutation],
  );

  const remove = useCallback(
    (arcId: string) =>
      runMutation(async () => {
        await deleteArc(arcId);
        setArcs((prev) => prev.filter((a) => a.id !== arcId));
      }),
    [runMutation],
  );

  const seal = useCallback(
    (arcId: string) =>
      runMutation(async () => {
        const sealedAt = await sealArc(arcId);
        setArcs((prev) => prev.map((a) => (a.id === arcId ? { ...a, sealedAt } : a)));
      }),
    [runMutation],
  );

  const unseal = useCallback(
    (arcId: string) =>
      runMutation(async () => {
        await unsealArc(arcId);
        setArcs((prev) => prev.map((a) => (a.id === arcId ? { ...a, sealedAt: null } : a)));
      }),
    [runMutation],
  );

  return { arcs, setArcs, loading, error, create, update, remove, seal, unseal };
}
