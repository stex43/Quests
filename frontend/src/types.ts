export type Quest = { id: string; title: string; description: string; arc_id: string };
export type Arc = { id: string; title: string; description: string; quests: Quest[] };
