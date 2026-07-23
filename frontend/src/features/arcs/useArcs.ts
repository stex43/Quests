import { useCallback, useEffect, useState } from "react";
import { createArc, deleteArc, getArcs, updateArc } from "../../api";
import type { Arc } from "../../types";
import type { RunMutation } from "./useMutationError";

export function useArcs(runMutation: RunMutation) {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getArcs()
      .then(setArcs)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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

  return { arcs, setArcs, loading, error, create, update, remove };
}
