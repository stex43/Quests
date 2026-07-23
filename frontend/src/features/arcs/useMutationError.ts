import { useCallback, useState } from "react";

export type RunMutation = <T>(fn: () => Promise<T>) => Promise<T>;

export function useMutationError() {
  const [mutationError, setMutationError] = useState<string | null>(null);

  const runMutation = useCallback<RunMutation>(async (fn) => {
    try {
      const result = await fn();
      setMutationError(null);
      return result;
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const dismissError = useCallback(() => {
    setMutationError(null);
  }, []);

  return { mutationError, runMutation, dismissError };
}
