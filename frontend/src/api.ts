import type { Arc, Quest } from "./types";

const BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8000";

async function request(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request failed: ${res.status.toString()} — ${body}`);
  }
  return res;
}

type RawQuest = Omit<Quest, "arcId" | "completedOn"> & {
  arc_id: string;
  completed_on: string | null;
};
type RawArc = Omit<Arc, "quests"> & { quests: RawQuest[] };

function mapQuest(q: RawQuest): Quest {
  const { arc_id, completed_on, ...rest } = q;
  return { ...rest, arcId: arc_id, completedOn: completed_on };
}

export async function getArcs(): Promise<Arc[]> {
  const raw = await request("/arcs").then((r) => r.json() as Promise<RawArc[]>);
  return raw.map((a) => ({ ...a, quests: a.quests.map(mapQuest) }));
}

export async function createArc(title: string): Promise<Arc> {
  const raw = await request("/arcs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  }).then((r) => r.json() as Promise<Omit<Arc, "quests">>);
  return { ...raw, quests: [] };
}

export async function updateArc(id: string, title: string): Promise<void> {
  await request(`/arcs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export async function deleteArc(id: string): Promise<void> {
  await request(`/arcs/${id}`, { method: "DELETE" });
}

export async function createQuest(title: string, arcId: string, description = ""): Promise<Quest> {
  const raw = await request(`/arcs/${arcId}/quests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  }).then((r) => r.json() as Promise<RawQuest>);
  return mapQuest(raw);
}

export async function updateQuest(id: string, title: string, description: string): Promise<void> {
  await request(`/quests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
}

export async function deleteQuest(id: string): Promise<void> {
  await request(`/quests/${id}`, { method: "DELETE" });
}

// Both toggle endpoints return the updated quest, so the server-resolved
// completedOn comes back with the same request that sets it.
export async function completeQuest(id: string): Promise<Quest> {
  // getTimezoneOffset counts minutes *west* of UTC, the opposite of what the API wants,
  // hence the negation: Berlin in summer reports -120 here and is sent as +120.
  const utcOffsetMinutes = -new Date().getTimezoneOffset();
  const raw = await request(`/quests/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utc_offset_minutes: utcOffsetMinutes }),
  }).then((r) => r.json() as Promise<RawQuest>);
  return mapQuest(raw);
}

export async function uncompleteQuest(id: string): Promise<Quest> {
  const raw = await request(`/quests/${id}/uncomplete`, { method: "POST" }).then(
    (r) => r.json() as Promise<RawQuest>,
  );
  return mapQuest(raw);
}
