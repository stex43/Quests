import { useEffect, useState } from "react";
import { createArc, createQuest, deleteArc, deleteQuest, getArcs, updateArc } from "../api";
import type { Arc, Quest } from "../types";

export interface UseArcsReturn {
  arcs: Arc[];
  loading: boolean;
  error: string | null;
  addArc: (title: string) => Promise<Arc>;
  renameArc: (id: string, title: string) => Promise<void>;
  removeArc: (id: string) => Promise<void>;
  addQuest: (title: string, arcId: string) => Promise<Quest>;
  removeQuest: (id: string) => Promise<void>;
}

export function useArcs(): UseArcsReturn {
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

  async function addArc(title: string): Promise<Arc> {
    try {
      const arc = await createArc(title);
      const arcWithQuests: Arc = { ...arc, quests: [] };
      setArcs((prev) => [arcWithQuests, ...prev]);
      return arcWithQuests;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  async function renameArc(id: string, title: string): Promise<void> {
    try {
      await updateArc(id, title);
      setArcs((prev) => prev.map((a) => (a.id === id ? { ...a, title } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeArc(id: string): Promise<void> {
    try {
      await deleteArc(id);
      setArcs((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  async function addQuest(title: string, arcId: string): Promise<Quest> {
    try {
      const quest = await createQuest(title, arcId);
      setArcs((prev) =>
        prev.map((a) => (a.id === arcId ? { ...a, quests: [...a.quests, quest] } : a)),
      );
      return quest;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeQuest(id: string): Promise<void> {
    try {
      await deleteQuest(id);
      setArcs((prev) => prev.map((a) => ({ ...a, quests: a.quests.filter((q) => q.id !== id) })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  return { arcs, loading, error, addArc, renameArc, removeArc, addQuest, removeQuest };
}
