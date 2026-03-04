import { useEffect, useState } from "react";
import { createArc, createQuest, deleteArc, deleteQuest, getArcs, updateArc } from "../api";
import type { Arc, Quest } from "../types";

export interface UseArcsReturn {
  arcs: Arc[];
  loading: boolean;
  error: string | null;
  selectedQuest: Quest | null;
  expandedArcIds: Set<string>;
  editingArcId: string | null;
  editingArcTitle: string;
  newArcTitle: string;
  newQuestTitles: Record<string, string>;
  setSelectedQuest: (quest: Quest | null) => void;
  setNewArcTitle: (value: string) => void;
  setEditingArcTitle: (value: string) => void;
  setNewQuestTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  toggleExpand: (arcId: string) => void;
  handleCreateArc: () => Promise<void>;
  startEditArc: (arc: Arc, e: React.MouseEvent) => void;
  commitEditArc: (arcId: string) => Promise<void>;
  cancelEditArc: () => void;
  handleDeleteArc: (arcId: string, e: React.MouseEvent) => Promise<void>;
  handleCreateQuest: (arcId: string) => Promise<void>;
  handleDeleteQuest: (questId: string, e: React.MouseEvent) => Promise<void>;
}

export function useArcs(): UseArcsReturn {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [expandedArcIds, setExpandedArcIds] = useState<Set<string>>(() => new Set());
  const [editingArcId, setEditingArcId] = useState<string | null>(null);
  const [editingArcTitle, setEditingArcTitle] = useState("");
  const [newArcTitle, setNewArcTitle] = useState("");
  const [newQuestTitles, setNewQuestTitles] = useState<Record<string, string>>({});

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

  function toggleExpand(arcId: string) {
    setExpandedArcIds((prev) => {
      const next = new Set(prev);
      if (next.has(arcId)) next.delete(arcId);
      else next.add(arcId);
      return next;
    });
  }

  async function handleCreateArc() {
    const title = newArcTitle.trim();
    if (!title) return;
    const arc = await createArc(title);
    setArcs((prev) => [{ ...arc, quests: [] }, ...prev]);
    setNewArcTitle("");
    setExpandedArcIds((prev) => new Set([...prev, arc.id]));
  }

  function startEditArc(arc: Arc, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingArcId(arc.id);
    setEditingArcTitle(arc.title);
  }

  async function commitEditArc(arcId: string) {
    const title = editingArcTitle.trim();
    if (title) {
      await updateArc(arcId, title);
      setArcs((prev) => prev.map((a) => (a.id === arcId ? { ...a, title } : a)));
    }
    setEditingArcId(null);
  }

  function cancelEditArc() {
    setEditingArcId(null);
  }

  async function handleDeleteArc(arcId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteArc(arcId);
    setArcs((prev) => prev.filter((a) => a.id !== arcId));
    if (
      selectedQuest &&
      arcs.find((a) => a.id === arcId)?.quests.some((q) => q.id === selectedQuest.id)
    ) {
      setSelectedQuest(null);
    }
  }

  async function handleCreateQuest(arcId: string) {
    const title = (newQuestTitles[arcId] ?? "").trim();
    if (!title) return;
    const quest = await createQuest(title, arcId);
    setArcs((prev) =>
      prev.map((a) => (a.id === arcId ? { ...a, quests: [...a.quests, quest] } : a)),
    );
    setNewQuestTitles((prev) => ({ ...prev, [arcId]: "" }));
  }

  async function handleDeleteQuest(questId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteQuest(questId);
    setArcs((prev) =>
      prev.map((a) => ({ ...a, quests: a.quests.filter((q) => q.id !== questId) })),
    );
    if (selectedQuest?.id === questId) setSelectedQuest(null);
  }

  return {
    arcs,
    loading,
    error,
    selectedQuest,
    expandedArcIds,
    editingArcId,
    editingArcTitle,
    newArcTitle,
    newQuestTitles,
    setSelectedQuest,
    setNewArcTitle,
    setEditingArcTitle,
    setNewQuestTitles,
    toggleExpand,
    handleCreateArc,
    startEditArc,
    commitEditArc,
    cancelEditArc,
    handleDeleteArc,
    handleCreateQuest,
    handleDeleteQuest,
  };
}
