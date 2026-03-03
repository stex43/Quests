import { useEffect, useState } from "react";
import { getArcs } from "./api";
import type { Arc, Quest } from "./types";

export default function App() {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

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

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div style={{ display: "flex", height: "100vh", margin: 0 }}>
      <div
        style={{ width: "300px", overflowY: "auto", borderRight: "1px solid #ccc", padding: "8px" }}
      >
        {arcs.map((arc) => (
          <div key={arc.id}>
            <h3 style={{ margin: "8px 0 4px 0" }}>{arc.title}</h3>
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {arc.quests.map((quest) => (
                <li
                  key={quest.id}
                  onClick={() => {
                    setSelectedQuest(quest);
                  }}
                  style={{
                    cursor: "pointer",
                    padding: "2px 4px",
                    listStyle: "none",
                    background: selectedQuest?.id === quest.id ? "#ddd" : "transparent",
                  }}
                >
                  {quest.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
        {selectedQuest ? (
          <>
            <h2>{selectedQuest.title}</h2>
            <p>{selectedQuest.description}</p>
          </>
        ) : (
          <p>Select a quest to see its description.</p>
        )}
      </div>
    </div>
  );
}
