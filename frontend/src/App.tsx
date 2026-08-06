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

  const selectedArcTitle = selectedQuest
    ? (arcs.find((arc) => arc.id === selectedQuest.arcId)?.title ?? null)
    : null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-title">The Daily Chronicle</span>
          <span className="app-header-subtitle">a record of tasks &amp; deeds</span>
        </div>
        <nav className="app-header-nav" aria-label="Views">
          <span className="app-nav-tab app-nav-tab--active" aria-current="page">
            Tasks
          </span>
          <span className="app-nav-tab" aria-disabled="true">
            Archive
          </span>
        </nav>
      </header>

      <div className="app-body">
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
        <QuestDetail
          quest={selectedQuest}
          arcTitle={selectedArcTitle}
          onUpdate={updateQuest}
          onToggleComplete={toggleComplete}
        />
      </div>
    </div>
  );
}
