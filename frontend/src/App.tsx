import { useCallback } from "react";
import { ArcList } from "./components/ArcList";
import { ArchiveList } from "./components/ArchiveList";
import { QuestDetail } from "./components/QuestDetail";
import "./App.css";
import { useArcs } from "./features/arcs/useArcs";
import { useMutationError } from "./features/arcs/useMutationError";
import { useQuests } from "./features/arcs/useQuests";
import { useSealPrompt } from "./features/arcs/useSealPrompt";
import { useSelectedQuest } from "./features/arcs/useSelectedQuest";
import { useViewNavigation } from "./features/arcs/useViewNavigation";

export default function App() {
  // A single shared mutation-error state is used for both arc and quest
  // mutations, so any successful mutation clears a pending error from either.
  const { mutationError, runMutation, dismissError } = useMutationError();
  const { view, focusArcId, goToTasks, goToArchive, clearFocus } = useViewNavigation();
  const {
    isPrompted: isSealPrompted,
    trigger: triggerSealPrompt,
    dismiss: dismissSealPrompt,
    reset: resetSealPrompt,
  } = useSealPrompt();
  const onArcOpenStateChange = useCallback(
    (arcId: string, fullyCompleted: boolean) => {
      if (fullyCompleted) triggerSealPrompt(arcId);
      else resetSealPrompt(arcId);
    },
    [triggerSealPrompt, resetSealPrompt],
  );
  const {
    arcs,
    setArcs,
    loading,
    error,
    create: createArc,
    update: updateArc,
    remove: removeArc,
    seal: sealArc,
    unseal: unsealArc,
  } = useArcs(view, runMutation);
  const {
    create: createQuest,
    update: updateQuest,
    remove: removeQuest,
    toggleComplete,
  } = useQuests(setArcs, runMutation, onArcOpenStateChange);
  const { selectedQuest, select } = useSelectedQuest(arcs);

  // "View all N in the Archive": jump tabs and land the detail panel on one of the
  // arc's quests (mirrors the mock's own viewAll handler) instead of leaving it
  // empty/stale after the switch. Read from the current (active-view) arcs before
  // the switch, since a quest belonging to this arc is guaranteed to exist there
  // (either in `quests` or `recentCompleted`).
  const handleViewInArchive = useCallback(
    (arcId: string) => {
      const arc = arcs.find((a) => a.id === arcId);
      const quest = arc?.quests[0] ?? arc?.recentCompleted[0];
      if (quest) select(quest);
      goToArchive(arcId);
    },
    [arcs, select, goToArchive],
  );

  const handleSealArc = useCallback(
    (arcId: string) =>
      sealArc(arcId).then(() => {
        dismissSealPrompt(arcId);
      }),
    [sealArc, dismissSealPrompt],
  );

  const handleGoToArchiveTab = useCallback(() => {
    goToArchive();
  }, [goToArchive]);

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
          <button
            type="button"
            className={`app-nav-tab${view === "active" ? " app-nav-tab--active" : ""}`}
            aria-current={view === "active" ? "page" : undefined}
            onClick={goToTasks}
          >
            Tasks
          </button>
          <button
            type="button"
            className={`app-nav-tab${view === "archive" ? " app-nav-tab--active" : ""}`}
            aria-current={view === "archive" ? "page" : undefined}
            onClick={handleGoToArchiveTab}
          >
            Archive
          </button>
        </nav>
      </header>

      <div className="app-body">
        {view === "active" ? (
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
            isSealPrompted={isSealPrompted}
            onSealArc={handleSealArc}
            onUnsealArc={unsealArc}
            onDismissSealPrompt={dismissSealPrompt}
            onViewInArchive={handleViewInArchive}
          />
        ) : (
          <ArchiveList
            arcs={arcs}
            selectedQuestId={selectedQuest?.id ?? null}
            focusArcId={focusArcId}
            onFocusHandled={clearFocus}
            onSelectQuest={select}
            onDeleteQuest={removeQuest}
            onToggleComplete={toggleComplete}
            onUpdateArc={updateArc}
            onDeleteArc={removeArc}
            onUnsealArc={unsealArc}
          />
        )}
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
