export interface Quest {
  id: string;
  title: string;
  description: string;
  arcId: string;
}

export interface Arc {
  id: string;
  title: string;
  quests: Quest[];
}
