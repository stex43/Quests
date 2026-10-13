import { useCallback, useState } from "react";

// Arc ids currently showing the inline "Seal this arc?" strip. Pure client-transient
// state -- never persisted, never sent to the server.
export function useSealPrompt() {
  const [promptedArcIds, setPromptedArcIds] = useState<Set<string>>(() => new Set());

  const isPrompted = useCallback((arcId: string) => promptedArcIds.has(arcId), [promptedArcIds]);

  const trigger = useCallback((arcId: string) => {
    setPromptedArcIds((prev) => {
      if (prev.has(arcId)) return prev;
      const next = new Set(prev);
      next.add(arcId);
      return next;
    });
  }, []);

  const dismiss = useCallback((arcId: string) => {
    setPromptedArcIds((prev) => {
      if (!prev.has(arcId)) return prev;
      const next = new Set(prev);
      next.delete(arcId);
      return next;
    });
  }, []);

  // Arc gained a new open quest -- clear any stale dismissal/trigger so the prompt
  // can fire again the next time this arc becomes fully completed.
  const reset = useCallback((arcId: string) => {
    setPromptedArcIds((prev) => {
      if (!prev.has(arcId)) return prev;
      const next = new Set(prev);
      next.delete(arcId);
      return next;
    });
  }, []);

  return { isPrompted, trigger, dismiss, reset };
}
