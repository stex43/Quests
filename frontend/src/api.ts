import type { Arc, Quest } from "./types";

const BASE_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8000";

async function request(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) throw new Error(`Request failed: ${res.status.toString()}`);
  return res;
}

export async function getArcs(): Promise<Arc[]> {
  return request("/arcs").then((r) => r.json() as Promise<Arc[]>);
}

export async function createArc(title: string): Promise<Arc> {
  return request("/arcs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  }).then((r) => r.json() as Promise<Arc>);
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

export async function createQuest(title: string, arc_id: string): Promise<Quest> {
  return request("/quests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description: "", arc_id }),
  }).then((r) => r.json() as Promise<Quest>);
}

export async function deleteQuest(id: string): Promise<void> {
  await request(`/quests/${id}`, { method: "DELETE" });
}
