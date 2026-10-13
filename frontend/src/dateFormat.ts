const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Regex-based parse of the server's YYYY-MM-DD, same rationale as QuestDetail's
// formatCompletedOn: the value is a calendar day with no time zone, and
// `new Date("2026-01-01")` would read it as UTC midnight and render the previous
// day for anyone west of UTC. Returns the raw string for a malformed value rather
// than throwing, so a bad value degrades instead of crashing a preview row.
export function formatShortDate(completedOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completedOn);
  if (!match) return completedOn;
  const [, , month, day] = match;
  const abbreviation = MONTH_ABBREVIATIONS[Number(month) - 1];
  if (!abbreviation) return completedOn;
  return `${abbreviation} ${Number(day).toString()}`;
}

// For real ISO timestamps (e.g. sealedAt) that carry full timezone info, unlike
// completedOn -- safe to hand to Date directly.
export function formatShortDateFromTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
