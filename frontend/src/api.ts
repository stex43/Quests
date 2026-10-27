import type { Arc, Quest, Recurrence } from "./types";

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

// Recurrence needs no mapping: its keys (frequency, interval, weekdays) are already the
// same in both casings.
type RawQuest = Omit<Quest, "arcId" | "completedOn" | "dueOn" | "seriesId"> & {
  arc_id: string;
  completed_on: string | null;
  due_on: string | null;
  series_id: string | null;
};
type RawArc = Omit<
  Arc,
  "quests" | "sealedAt" | "recentCompleted" | "completedCount" | "upcoming"
> & {
  quests: RawQuest[];
  sealed_at: string | null;
  recent_completed: RawQuest[];
  completed_count: number;
  upcoming: RawQuest[];
};

function mapQuest(q: RawQuest): Quest {
  const { arc_id, completed_on, due_on, series_id, ...rest } = q;
  return { ...rest, arcId: arc_id, completedOn: completed_on, dueOn: due_on, seriesId: series_id };
}

function mapArc(a: RawArc): Arc {
  const { quests, sealed_at, recent_completed, completed_count, upcoming, ...rest } = a;
  return {
    ...rest,
    quests: quests.map(mapQuest),
    sealedAt: sealed_at,
    recentCompleted: recent_completed.map(mapQuest),
    completedCount: completed_count,
    upcoming: upcoming.map(mapQuest),
  };
}

// The viewer's UTC offset in the API's convention. getTimezoneOffset counts minutes
// *west* of UTC, the opposite of what the API wants, hence the negation: Berlin in
// summer reports -120 here and is sent as +120. The server resolves the viewer's
// calendar day from it (completion day, which instances are upcoming, a rule's first
// occurrence).
function currentUtcOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export async function getArcs(view: "active" | "archive" = "active"): Promise<Arc[]> {
  const raw = await request(
    `/arcs?view=${view}&utc_offset_minutes=${currentUtcOffsetMinutes().toString()}`,
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
      r.json() as Promise<
        Omit<Arc, "quests" | "sealedAt" | "recentCompleted" | "completedCount" | "upcoming">
      >,
  );
  return {
    ...raw,
    quests: [],
    sealedAt: null,
    recentCompleted: [],
    completedCount: 0,
    upcoming: [],
  };
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

// A rule makes the new quest the first instance of a repeating series; the offset lets
// the server compute its first occurrence from the creator's today (it is ignored
// without a rule).
export async function createQuest(
  title: string,
  arcId: string,
  description = "",
  recurrence: Recurrence | null = null,
): Promise<Quest> {
  const raw = await request(`/arcs/${arcId}/quests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description,
      recurrence,
      utc_offset_minutes: currentUtcOffsetMinutes(),
    }),
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
// completedOn comes back with the same request that sets it. Completing a repeating
// quest also spawns the series' next instance, returned as nextInstance (null for
// plain quests and for an idempotent re-completion).
export async function completeQuest(
  id: string,
): Promise<{ quest: Quest; arcFullyCompleted: boolean; nextInstance: Quest | null }> {
  const raw = await request(`/quests/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utc_offset_minutes: currentUtcOffsetMinutes() }),
  }).then(
    (r) =>
      r.json() as Promise<
        RawQuest & { arc_fully_completed: boolean; next_instance: RawQuest | null }
      >,
  );
  const { arc_fully_completed, next_instance, ...rest } = raw;
  return {
    quest: mapQuest(rest),
    arcFullyCompleted: arc_fully_completed,
    nextInstance: next_instance ? mapQuest(next_instance) : null,
  };
}

// Un-completing a repeating quest is an undo: the server deletes the instance its
// completion spawned, so this one is the series' open instance again. removedInstanceId
// names the deleted one (null when there was none) so it can be dropped client-side.
export async function uncompleteQuest(
  id: string,
): Promise<{ quest: Quest; removedInstanceId: string | null }> {
  const raw = await request(`/quests/${id}/uncomplete`, { method: "POST" }).then(
    (r) => r.json() as Promise<RawQuest & { removed_instance_id: string | null }>,
  );
  const { removed_instance_id, ...rest } = raw;
  return { quest: mapQuest(rest), removedInstanceId: removed_instance_id };
}

// Sets or replaces an open quest's rule (starting a series if it had none). The server
// recomputes dueOn as the rule's first day on or after the caller's today, so the quest
// may move between `quests` and `upcoming`. Rejected (400) for a completed quest.
export async function setQuestRecurrence(id: string, recurrence: Recurrence): Promise<Quest> {
  const raw = await request(`/quests/${id}/recurrence`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recurrence, utc_offset_minutes: currentUtcOffsetMinutes() }),
  }).then((r) => r.json() as Promise<RawQuest>);
  return mapQuest(raw);
}

// Stops repeating: the quest comes back with recurrence, seriesId and dueOn all null,
// a plain visible quest. Rejected (400) for a completed quest.
export async function clearQuestRecurrence(id: string): Promise<Quest> {
  const raw = await request(`/quests/${id}/recurrence`, { method: "DELETE" }).then(
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
