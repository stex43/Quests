import { useEffect, useRef, useState } from "react";
import { createArc, createQuest, deleteArc, deleteQuest, getArcs, updateArc } from "./api";
import type { Arc, Quest } from "./types";

const PANEL_WIDTH = 560;

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    margin: 0,
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 14,
    color: "#111827",
  },
  leftPanel: {
    width: PANEL_WIDTH,
    minWidth: PANEL_WIDTH,
    borderRight: "1px solid #e5e7eb",
    padding: "24px 20px",
    overflowY: "auto" as const,
    backgroundColor: "#ffffff",
  },
  rightPanel: {
    flex: 1,
    padding: "32px 40px",
    overflowY: "auto" as const,
    backgroundColor: "#ffffff",
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  newArcRow: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    background: "#f3f4f6",
    border: "none",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "#111827",
    outline: "none",
  },
  addButton: {
    background: "#111827",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    width: 40,
    height: 40,
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  arcCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  arcHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 14px",
    gap: 8,
    cursor: "pointer",
    userSelect: "none" as const,
    backgroundColor: "#ffffff",
  },
  arcChevron: {
    fontSize: 12,
    color: "#6b7280",
    width: 16,
    flexShrink: 0,
  },
  arcTitle: {
    flex: 1,
    fontWeight: 600,
    fontSize: 15,
  },
  arcTitleInput: {
    flex: 1,
    background: "#f3f4f6",
    border: "none",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
    outline: "none",
  },
  iconButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    color: "#9ca3af",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    fontSize: 14,
    lineHeight: 1,
  },
  questList: {
    borderTop: "1px solid #e5e7eb",
    padding: "4px 0",
  },
  questRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 14px",
    gap: 8,
    cursor: "pointer",
  },
  questTitle: {
    flex: 1,
    fontSize: 14,
  },
  newQuestRow: {
    display: "flex",
    gap: 8,
    padding: "8px 14px",
    borderTop: "1px solid #e5e7eb",
  },
  newQuestInput: {
    flex: 1,
    background: "#f3f4f6",
    border: "none",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 14,
    color: "#111827",
    outline: "none",
  },
  smallAddButton: {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    width: 34,
    height: 34,
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  questDetailTitle: {
    fontSize: 26,
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  divider: {
    border: "none",
    borderTop: "1px solid #e5e7eb",
    margin: "0 0 20px 0",
  },
  completeButton: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: 28,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "#4f46e5",
    margin: "0 0 12px 0",
  },
  descriptionText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 1.6,
    margin: 0,
  },
  emptyState: {
    color: "#9ca3af",
    marginTop: 40,
  },
} as const;

// Icons as simple SVG strings rendered via dangerouslySetInnerHTML would be fragile;
// use text/unicode glyphs instead for simplicity.
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export default function App() {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [expandedArcIds, setExpandedArcIds] = useState<Set<string>>(new Set());
  const [editingArcId, setEditingArcId] = useState<string | null>(null);
  const [editingArcTitle, setEditingArcTitle] = useState("");
  const [newArcTitle, setNewArcTitle] = useState("");
  const [newQuestTitles, setNewQuestTitles] = useState<Record<string, string>>({});
  const [hoveredQuestId, setHoveredQuestId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getArcs()
      .then(setArcs)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editingArcId) editInputRef.current?.focus();
  }, [editingArcId]);

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

  async function handleDeleteArc(arcId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteArc(arcId);
    setArcs((prev) => prev.filter((a) => a.id !== arcId));
    if (selectedQuest && arcs.find((a) => a.id === arcId)?.quests.some((q) => q.id === selectedQuest.id)) {
      setSelectedQuest(null);
    }
  }

  async function handleCreateQuest(arcId: string) {
    const title = (newQuestTitles[arcId] ?? "").trim();
    if (!title) return;
    const quest = await createQuest(title, arcId);
    setArcs((prev) =>
      prev.map((a) => (a.id === arcId ? { ...a, quests: [...a.quests, quest] } : a))
    );
    setNewQuestTitles((prev) => ({ ...prev, [arcId]: "" }));
  }

  async function handleDeleteQuest(questId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteQuest(questId);
    setArcs((prev) =>
      prev.map((a) => ({ ...a, quests: a.quests.filter((q) => q.id !== questId) }))
    );
    if (selectedQuest?.id === questId) setSelectedQuest(null);
  }

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (error) return <p style={{ padding: 24 }}>Error: {error}</p>;

  return (
    <div style={styles.container}>
      {/* Left panel */}
      <div style={styles.leftPanel}>
        <h1 style={styles.heading}>Arcs</h1>

        {/* New arc input */}
        <div style={styles.newArcRow}>
          <input
            style={styles.input}
            placeholder="New arc name..."
            value={newArcTitle}
            onChange={(e) => setNewArcTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateArc(); }}
          />
          <button style={styles.addButton} onClick={() => void handleCreateArc()}>+</button>
        </div>

        {/* Arc list */}
        {arcs.map((arc) => {
          const expanded = expandedArcIds.has(arc.id);
          return (
            <div key={arc.id} style={styles.arcCard}>
              {/* Arc header */}
              <div style={styles.arcHeader} onClick={() => toggleExpand(arc.id)}>
                <span style={styles.arcChevron}>{expanded ? "▼" : "▶"}</span>

                {editingArcId === arc.id ? (
                  <input
                    ref={editInputRef}
                    style={styles.arcTitleInput}
                    value={editingArcTitle}
                    onChange={(e) => setEditingArcTitle(e.target.value)}
                    onBlur={() => void commitEditArc(arc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitEditArc(arc.id);
                      if (e.key === "Escape") setEditingArcId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span style={styles.arcTitle}>{arc.title}</span>
                )}

                <button style={styles.iconButton} onClick={(e) => startEditArc(arc, e)} title="Edit arc">
                  <PencilIcon />
                </button>
                <button style={styles.iconButton} onClick={(e) => void handleDeleteArc(arc.id, e)} title="Delete arc">
                  <TrashIcon />
                </button>
              </div>

              {/* Quest list (when expanded) */}
              {expanded && (
                <div style={styles.questList}>
                  {arc.quests.map((quest) => {
                    const isSelected = selectedQuest?.id === quest.id;
                    const isHovered = hoveredQuestId === quest.id;
                    return (
                      <div
                        key={quest.id}
                        style={{
                          ...styles.questRow,
                          background: isSelected ? "#eff6ff" : isHovered ? "#f9fafb" : "transparent",
                        }}
                        onClick={() => setSelectedQuest(quest)}
                        onMouseEnter={() => setHoveredQuestId(quest.id)}
                        onMouseLeave={() => setHoveredQuestId(null)}
                      >
                        <span style={{ ...styles.questTitle, color: isSelected ? "#1d4ed8" : "#111827" }}>
                          {quest.title}
                        </span>
                        <button
                          style={styles.iconButton}
                          onClick={(e) => void handleDeleteQuest(quest.id, e)}
                          title="Delete quest"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })}

                  {/* New quest input */}
                  <div style={styles.newQuestRow}>
                    <input
                      style={styles.newQuestInput}
                      placeholder="New quest..."
                      value={newQuestTitles[arc.id] ?? ""}
                      onChange={(e) =>
                        setNewQuestTitles((prev) => ({ ...prev, [arc.id]: e.target.value }))
                      }
                      onKeyDown={(e) => { if (e.key === "Enter") void handleCreateQuest(arc.id); }}
                    />
                    <button style={styles.smallAddButton} onClick={() => void handleCreateQuest(arc.id)}>+</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Right panel */}
      <div style={styles.rightPanel}>
        {selectedQuest ? (
          <>
            <h2 style={styles.questDetailTitle}>{selectedQuest.title}</h2>
            <hr style={styles.divider} />
            <button
              style={styles.completeButton}
              onClick={() => console.log("Mark as complete", selectedQuest.id)}
            >
              Mark as Complete
            </button>
            <p style={styles.descriptionLabel}>Description</p>
            <p style={styles.descriptionText}>{selectedQuest.description || <em style={{ color: "#9ca3af" }}>No description.</em>}</p>
          </>
        ) : (
          <p style={styles.emptyState}>Select a quest to see its details.</p>
        )}
      </div>
    </div>
  );
}
