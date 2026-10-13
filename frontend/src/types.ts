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
  // Set when the user confirms sealing a fully-completed arc; null while unsealed.
  // A real ISO timestamp (unlike completedOn), safe to parse with `new Date()`.
  sealedAt: string | null;
  // Up to 5 most-recently-completed quests completed today, newest-first. Only
  // meaningful for the active view; empty (and unused) in the archive view. A quest
  // completed before today drops off the active view entirely (footer included) and
  // lives only in the archive view's `quests`.
  recentCompleted: Quest[];
  // Total count backing recentCompleted's ">5" threshold -- not capped at 5 itself.
  // In the archive view this is the total number of completed quests (== quests.length).
  completedCount: number;
}
