import { useState } from "react";
import { useArcs } from "./hooks/useArcs";
import { ArcList } from "./components/ArcList";
import { QuestDetail } from "./components/QuestDetail";
import type { Quest } from "./types";
import styles from "./App.module.css";

export default function App() {
  const { arcs, loading, error, addArc, renameArc, removeArc, addQuest, removeQuest } = useArcs();
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (error) return <p style={{ padding: 24 }}>Error: {error}</p>;

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <ArcList
          arcs={arcs}
          selectedQuestId={selectedQuest?.id ?? null}
          onSelectQuest={setSelectedQuest}
          addArc={addArc}
          renameArc={renameArc}
          removeArc={removeArc}
          addQuest={addQuest}
          removeQuest={removeQuest}
        />
      </div>
      <div className={styles.rightPanel}>
        <QuestDetail quest={selectedQuest} />
      </div>
    </div>
  );
}
