import { useCallback, useEffect, useRef, useState } from "react";
import { createArc, createQuest, deleteArc, deleteQuest, getArcs, updateArc } from "./api";
import { ArcList } from "./components/ArcList";
import { QuestDetail } from "./components/QuestDetail";
import "./App.css";
import type { Arc, Quest } from "./types";

export default function App() {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const arcsRef = useRef(arcs);
  useEffect(() => {
    arcsRef.current = arcs;
  }, [arcs]);

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

  const catchMutationError = useCallback((err: unknown) => {
    setMutationError(err instanceof Error ? err.message : String(err));
  }, []);

  const handleDismissError = useCallback(() => {
    setMutationError(null);
  }, []);

  const handleCreateArc = useCallback(
    async (title: string) => {
      try {
        const arc = await createArc(title);
        setArcs((prev) => [arc, ...prev]);
        setMutationError(null);
      } catch (err) {
        catchMutationError(err);
        throw err;
      }
    },
    [catchMutationError],
  );

  const handleUpdateArc = useCallback(
    async (arcId: string, title: string) => {
      try {
        await updateArc(arcId, title);
        setArcs((prev) => prev.map((a) => (a.id === arcId ? { ...a, title } : a)));
        setMutationError(null);
      } catch (err) {
        catchMutationError(err);
        throw err;
      }
    },
    [catchMutationError],
  );

  const handleDeleteArc = useCallback(
    async (arcId: string) => {
      try {
        const arc = arcsRef.current.find((a) => a.id === arcId);
        await deleteArc(arcId);
        setArcs((prev) => prev.filter((a) => a.id !== arcId));
        setSelectedQuest((sq) => (arc?.quests.some((q) => q.id === sq?.id) ? null : sq));
        setMutationError(null);
      } catch (err) {
        catchMutationError(err);
        throw err;
      }
    },
    [catchMutationError],
  );

  const handleCreateQuest = useCallback(
    async (arcId: string, title: string) => {
      try {
        const quest = await createQuest(title, arcId);
        setArcs((prev) =>
          prev.map((a) => (a.id === arcId ? { ...a, quests: [...a.quests, quest] } : a)),
        );
        setMutationError(null);
      } catch (err) {
        catchMutationError(err);
        throw err;
      }
    },
    [catchMutationError],
  );

  const handleDeleteQuest = useCallback(
    async (questId: string) => {
      try {
        await deleteQuest(questId);
        setArcs((prev) =>
          prev.map((a) => ({ ...a, quests: a.quests.filter((q) => q.id !== questId) })),
        );
        setSelectedQuest((sq) => (sq?.id === questId ? null : sq));
        setMutationError(null);
      } catch (err) {
        catchMutationError(err);
        throw err;
      }
    },
    [catchMutationError],
  );

  const handleSelectQuest = useCallback((quest: Quest) => {
    setSelectedQuest(quest);
  }, []);

  if (loading) return <p className="app-status-text">Loading...</p>;
  if (error) return <p className="app-status-text">Error: {error}</p>;

  return (
    <div className="app-container">
      <ArcList
        arcs={arcs}
        selectedQuestId={selectedQuest?.id ?? null}
        mutationError={mutationError}
        onDismissError={handleDismissError}
        onCreateArc={handleCreateArc}
        onUpdateArc={handleUpdateArc}
        onDeleteArc={handleDeleteArc}
        onCreateQuest={handleCreateQuest}
        onDeleteQuest={handleDeleteQuest}
        onSelectQuest={handleSelectQuest}
      />
      <QuestDetail quest={selectedQuest} />
    </div>
  );
}
