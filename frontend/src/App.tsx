import { useArcs } from "./hooks/useArcs";
import { ArcList } from "./components/ArcList";
import { QuestDetail } from "./components/QuestDetail";
import styles from "./App.module.css";

export default function App() {
  const state = useArcs();

  if (state.loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (state.error) return <p style={{ padding: 24 }}>Error: {state.error}</p>;

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <ArcList
          arcs={state.arcs}
          expandedArcIds={state.expandedArcIds}
          editingArcId={state.editingArcId}
          editingArcTitle={state.editingArcTitle}
          selectedQuestId={state.selectedQuest?.id ?? null}
          newArcTitle={state.newArcTitle}
          newQuestTitles={state.newQuestTitles}
          onNewArcTitleChange={state.setNewArcTitle}
          onCreateArc={() => void state.handleCreateArc()}
          onToggleExpand={state.toggleExpand}
          onStartEdit={state.startEditArc}
          onEditTitleChange={state.setEditingArcTitle}
          onCommitEdit={(arcId) => void state.commitEditArc(arcId)}
          onCancelEdit={state.cancelEditArc}
          onDeleteArc={(arcId, e) => void state.handleDeleteArc(arcId, e)}
          onSelectQuest={state.setSelectedQuest}
          onDeleteQuest={(questId, e) => void state.handleDeleteQuest(questId, e)}
          onNewQuestTitleChange={(arcId, value) => {
            state.setNewQuestTitles((prev) => ({ ...prev, [arcId]: value }));
          }}
          onCreateQuest={(arcId) => void state.handleCreateQuest(arcId)}
        />
      </div>
      <div className={styles.rightPanel}>
        <QuestDetail quest={state.selectedQuest} />
      </div>
    </div>
  );
}
