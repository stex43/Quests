import { useEffect, useState } from "react";
import { getArcs } from "./api";
import type { Arc } from "./types";

export default function App() {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getArcs()
      .then(setArcs)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <ul>
      {arcs.map((arc) => (
        <li key={arc.id}>
          <strong>{arc.title}</strong> — {arc.description}
          <ul>
            {arc.quests.map((quest) => (
              <li key={quest.id}>
                {quest.title} — {quest.description}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
