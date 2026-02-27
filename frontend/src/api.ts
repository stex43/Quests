import type { Arc } from "./types";

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

export async function getArcs(): Promise<Arc[]> {
  const res = await fetch(`${BASE_URL}/arcs`);
  if (!res.ok) throw new Error(`Failed to fetch arcs: ${res.status}`);
  return res.json();
}
