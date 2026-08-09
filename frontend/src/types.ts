export interface Quest {
  id: string;
  title: string;
  description: string;
  arcId: string;
  completed: boolean;
  // The completer's local calendar day as a raw YYYY-MM-DD string, resolved by the
  // server. Deliberately not a Date: it is a fixed day, not an instant, and parsing
  // it would drag time zones back into something that has none. Null while the quest
  // is incomplete, and for quests completed before this field existed.
  completedOn: string | null;
}

export interface Arc {
  id: string;
  title: string;
  quests: Quest[];
}
