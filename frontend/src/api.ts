import type { Arc, Quest } from "./types";

const DEFAULT_BACKEND_PORT = "8000";

// Resolved per page load so the bundle holds no host: the API is reached on whatever
// host the page was opened on, at VITE_BACKEND_PORT (empty or unset means 8000).
// VITE_BACKEND_ORIGIN overrides both.
function resolveBaseUrl(): string {
  const override = import.meta.env.VITE_BACKEND_ORIGIN;
  if (override) return override.replace(/\/+$/, "");

  const envPort = import.meta.env.VITE_BACKEND_PORT;
  const port = envPort !== undefined && envPort !== "" ? envPort : DEFAULT_BACKEND_PORT;
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

const BASE_URL = resolveBaseUrl();

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
type RawArc = Omit<Arc, "quests" | "sealedAt" | "recentCompleted" | "completedCount"> & {
  quests: RawQuest[];
  sealed_at: string | null;
  recent_completed: RawQuest[];
  completed_count: number;
};

function mapQuest(q: RawQuest): Quest {
  const { arc_id, completed_on, ...rest } = q;
  return { ...rest, arcId: arc_id, completedOn: completed_on };
}

function mapArc(a: RawArc): Arc {
  const { quests, sealed_at, recent_completed, completed_count, ...rest } = a;
  return {
    ...rest,
    quests: quests.map(mapQuest),
    sealedAt: sealed_at,
    recentCompleted: recent_completed.map(mapQuest),
    completedCount: completed_count,
  };
}

export async function getArcs(view: "active" | "archive" = "active"): Promise<Arc[]> {
  // Same offset-sign convention as completeQuest: getTimezoneOffset counts minutes
  // *west* of UTC, the opposite of what the API wants.
  const utcOffsetMinutes = -new Date().getTimezoneOffset();
  const raw = await request(
    `/arcs?view=${view}&utc_offset_minutes=${utcOffsetMinutes.toString()}`,
  ).then((r) => r.json() as Promise<RawArc[]>);
  return raw.map(mapArc);
}

export async function createArc(title: string): Promise<Arc> {
  const raw = await request("/arcs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  }).then(
    (r) =>
      r.json() as Promise<Omit<Arc, "quests" | "sealedAt" | "recentCompleted" | "completedCount">>,
  );
  return { ...raw, quests: [], sealedAt: null, recentCompleted: [], completedCount: 0 };
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
export async function completeQuest(
  id: string,
): Promise<{ quest: Quest; arcFullyCompleted: boolean }> {
  // getTimezoneOffset counts minutes *west* of UTC, the opposite of what the API wants,
  // hence the negation: Berlin in summer reports -120 here and is sent as +120.
  const utcOffsetMinutes = -new Date().getTimezoneOffset();
  const raw = await request(`/quests/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utc_offset_minutes: utcOffsetMinutes }),
  }).then((r) => r.json() as Promise<RawQuest & { arc_fully_completed: boolean }>);
  const { arc_fully_completed, ...rest } = raw;
  return { quest: mapQuest(rest), arcFullyCompleted: arc_fully_completed };
}

export async function uncompleteQuest(id: string): Promise<Quest> {
  const raw = await request(`/quests/${id}/uncomplete`, { method: "POST" }).then(
    (r) => r.json() as Promise<RawQuest>,
  );
  return mapQuest(raw);
}

export async function sealArc(id: string): Promise<string> {
  const raw = await request(`/arcs/${id}/seal`, { method: "POST" }).then(
    (r) => r.json() as Promise<{ id: string; sealed_at: string }>,
  );
  return raw.sealed_at;
}

export async function unsealArc(id: string): Promise<void> {
  await request(`/arcs/${id}/unseal`, { method: "POST" });
}
