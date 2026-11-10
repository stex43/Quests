import { useCallback, useEffect, useRef } from "react";
import { ArcList } from "./components/ArcList";
import { ArchiveList } from "./components/ArchiveList";
import { ErrorBanner } from "./components/ErrorBanner";
import { QuestDetail } from "./components/QuestDetail";
import { ViewTabs } from "./components/ViewTabs";
import { ArrowLeftIcon } from "./components/icons";
import "./App.css";
import { useArcs } from "./features/arcs/useArcs";
import { useIsMobile } from "./features/arcs/useIsMobile";
import { useMobileDetailHistory } from "./features/arcs/useMobileDetailHistory";
import { useMutationError } from "./features/arcs/useMutationError";
import { useQuests } from "./features/arcs/useQuests";
import { useSealPrompt } from "./features/arcs/useSealPrompt";
import { useSelectedQuest } from "./features/arcs/useSelectedQuest";
import { useViewNavigation } from "./features/arcs/useViewNavigation";

export default function App() {
  const isMobile = useIsMobile();
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
    setRecurrence: setQuestRecurrence,
  } = useQuests(setArcs, runMutation, onArcOpenStateChange);
  const { selectedQuest, select, clearSelection } = useSelectedQuest(arcs);
  const selectedQuestId = selectedQuest?.id ?? null;

  // Mobile is a list/detail stack. The detail screen is derived, not stored, so deleting
  // the open quest (its id then resolves to null) falls back to the list by itself.
  const showMobileDetail = isMobile && selectedQuestId !== null;
  const handleMobileBack = useMobileDetailHistory(isMobile, showMobileDetail, clearSelection);

  // Mobile focus hand-off, back half (the detail focuses its own heading on open): when
  // the detail closes, return focus to the row of the quest that was open, so a keyboard
  // or screen-reader user resumes where they left the list. Nothing is focused if that
  // row is gone (quest deleted, or a tab switch to a list without it).
  const listScreenRef = useRef<HTMLDivElement>(null);
  const openedQuestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (showMobileDetail) {
      openedQuestIdRef.current = selectedQuestId;
      return;
    }
    const questId = openedQuestIdRef.current;
    if (questId === null) return;
    openedQuestIdRef.current = null;
    listScreenRef.current
      ?.querySelector<HTMLElement>(`[data-quest-id="${CSS.escape(questId)}"]`)
      ?.focus();
  }, [showMobileDetail, selectedQuestId]);

  // "View all N in the Archive": jump tabs and land the detail panel on one of the
  // arc's quests (mirrors the mock's own viewAll handler) instead of leaving it
  // empty/stale after the switch. Read from the current (active-view) arcs before
  // the switch, since a quest belonging to this arc is guaranteed to exist there
  // (either in `quests` or `recentCompleted`).
  // On mobile a selection *is* the detail screen, so this lands on the archive list
  // (scrolled to the arc via focusArcId) without selecting anything. The link only
  // renders in the list, where nothing is selected, so the clearSelection there is
  // defensive only.
  const handleViewInArchive = useCallback(
    (arcId: string) => {
      if (isMobile) {
        clearSelection();
      } else {
        const arc = arcs.find((a) => a.id === arcId);
        const quest = arc?.quests[0] ?? arc?.recentCompleted[0];
        if (quest) select(quest);
      }
      goToArchive(arcId);
    },
    [isMobile, arcs, select, clearSelection, goToArchive],
  );

  const handleSealArc = useCallback(
    (arcId: string) =>
      sealArc(arcId).then(() => {
        dismissSealPrompt(arcId);
      }),
    [sealArc, dismissSealPrompt],
  );

  // On mobile a tab always lands on its list, never on a detail screen left open.
  const handleGoToTasksTab = useCallback(() => {
    if (isMobile) clearSelection();
    goToTasks();
  }, [isMobile, clearSelection, goToTasks]);

  const handleGoToArchiveTab = useCallback(() => {
    if (isMobile) clearSelection();
    goToArchive();
  }, [isMobile, clearSelection, goToArchive]);

  if (loading) return <p className="app-status-text">Loading...</p>;
  if (error) return <p className="app-status-text">Error: {error}</p>;

  const selectedArcTitle = selectedQuest
    ? (arcs.find((arc) => arc.id === selectedQuest.arcId)?.title ?? null)
    : null;

  const listPanel =
    view === "active" ? (
      <ArcList
        arcs={arcs}
        selectedQuestId={selectedQuestId}
        // On mobile the banner renders at App level instead (below), so it never
        // shows twice and stays visible while a quest is open.
        mutationError={isMobile ? null : mutationError}
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
        selectedQuestId={selectedQuestId}
        focusArcId={focusArcId}
        onFocusHandled={clearFocus}
        onSelectQuest={select}
        onDeleteQuest={removeQuest}
        onToggleComplete={toggleComplete}
        onUpdateArc={updateArc}
        onDeleteArc={removeArc}
        onUnsealArc={unsealArc}
      />
    );

  const questDetail = (
    <QuestDetail
      quest={selectedQuest}
      arcTitle={selectedArcTitle}
      onUpdate={updateQuest}
      onToggleComplete={toggleComplete}
      onSetRecurrence={setQuestRecurrence}
      focusHeadingOnOpen={isMobile}
    />
  );

  // Same tabs in both layouts: in the header on desktop, a bottom tab bar on mobile.
  const renderViewTabs = (className: string) => (
    <ViewTabs
      view={view}
      onGoToTasks={handleGoToTasksTab}
      onGoToArchive={handleGoToArchiveTab}
      className={className}
    />
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          {showMobileDetail && (
            <button
              type="button"
              className="app-back-button"
              onClick={handleMobileBack}
              aria-label="Back to list"
              title="Back to list"
            >
              <ArrowLeftIcon />
            </button>
          )}
          <span className="app-header-title">The Daily Chronicle</span>
          <span className="app-header-subtitle">a record of tasks &amp; deeds</span>
        </div>
        {!isMobile && renderViewTabs("app-header-nav")}
      </header>

      {isMobile && mutationError && (
        <ErrorBanner message={mutationError} onDismiss={dismissError} />
      )}

      {isMobile ? (
        <div className="app-body">
          {/* The list stays mounted under an open detail screen, so its per-arc
              expand/collapse state and its scroll position survive the round trip.
              It is covered with visibility: hidden (see App.css), not display: none,
              which would reset the scroll; inert keeps it out of the tab order and the
              accessibility tree as well. */}
          <div
            ref={listScreenRef}
            className={`app-mobile-list-screen${showMobileDetail ? " app-mobile-list-screen--covered" : ""}`}
            inert={showMobileDetail}
          >
            {listPanel}
          </div>
          {showMobileDetail && questDetail}
        </div>
      ) : (
        <div className="app-body">
          {listPanel}
          {questDetail}
        </div>
      )}

      {isMobile && renderViewTabs("app-bottom-nav")}
    </div>
  );
}
