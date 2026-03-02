export interface Quest { id: string; title: string; description: string; arc_id: string }
export interface Arc { id: string; title: string; description: string; quests: Quest[] }
