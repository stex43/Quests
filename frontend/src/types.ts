export interface Quest {
  id: string;
  title: string;
  description: string;
  arcId: string;
  completed: boolean;
}

export interface Arc {
  id: string;
  title: string;
  quests: Quest[];
}
