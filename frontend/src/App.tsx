import { ArcList } from "./components/ArcList";
import { QuestDetail } from "./components/QuestDetail";
import "./App.css";
import { useArcs } from "./features/arcs/useArcs";
import { useMutationError } from "./features/arcs/useMutationError";
import { useQuests } from "./features/arcs/useQuests";
import { useSelectedQuest } from "./features/arcs/useSelectedQuest";

export default function App() {
  // A single shared mutation-error state is used for both arc and quest
  // mutations, so any successful mutation clears a pending error from either.
  const { mutationError, runMutation, dismissError } = useMutationError();
  const {
    arcs,
    setArcs,
    loading,
    error,
    create: createArc,
    update: updateArc,
    remove: removeArc,
  } = useArcs(runMutation);
  const {
    create: createQuest,
    update: updateQuest,
    remove: removeQuest,
    toggleComplete,
  } = useQuests(setArcs, runMutation);
  const { selectedQuest, select } = useSelectedQuest(arcs);

  if (loading) return <p className="app-status-text">Loading...</p>;
  if (error) return <p className="app-status-text">Error: {error}</p>;

  return (
    <div className="app-container">
      <ArcList
        arcs={arcs}
        selectedQuestId={selectedQuest?.id ?? null}
        mutationError={mutationError}
        onDismissError={dismissError}
        onCreateArc={createArc}
        onUpdateArc={updateArc}
        onDeleteArc={removeArc}
        onCreateQuest={createQuest}
        onDeleteQuest={removeQuest}
        onToggleComplete={toggleComplete}
        onSelectQuest={select}
      />
      <QuestDetail quest={selectedQuest} onUpdate={updateQuest} onToggleComplete={toggleComplete} />
    </div>
  );
}
