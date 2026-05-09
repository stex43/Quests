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

type RawQuest = Omit<Quest, "arcId"> & { arc_id: string };
type RawArc = Omit<Arc, "quests"> & { quests: RawQuest[] };

function mapQuest(q: RawQuest): Quest {
  const { arc_id, ...rest } = q;
  return { ...rest, arcId: arc_id };
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
  const raw = await request("/quests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, arc_id: arcId }),
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
