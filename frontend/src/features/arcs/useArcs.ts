import { useCallback, useEffect, useState } from "react";
import { createArc, deleteArc, getArcs, sealArc, unsealArc, updateArc } from "../../api";
import type { Arc } from "../../types";
import type { RunMutation } from "./useMutationError";

export function useArcs(view: "active" | "archive", runMutation: RunMutation) {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Not gated on `loading`: view switches keep showing the previous view's arcs
    // (and the header/nav) until the new fetch resolves, rather than blanking the
    // whole app back to the full-page "Loading..." state on every tab click.
    // `cancelled` guards against the classic stale-response race: if this effect
    // re-runs (the user switched views again) before this fetch resolves, its
    // result must never overwrite whatever the newer fetch already set.
    getArcs(view)
      .then((data) => {
        if (!cancelled) setArcs(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
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
