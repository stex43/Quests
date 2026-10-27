import type { Recurrence } from "./types";

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

// Indexed Mon=0..Sun=6, the server's weekday numbering (see Recurrence in types.ts).
export const WEEKDAY_ABBREVIATIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Regex-based parse of the server's YYYY-MM-DD, same rationale as formatDay below: the
// value is a calendar day with no time zone, and `new Date("2026-01-01")` would read it
// as UTC midnight and render the previous day for anyone west of UTC. Returns the raw
// string for a malformed value rather than throwing, so a bad value degrades instead of
// crashing a preview row.
export function formatShortDate(completedOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(completedOn);
  if (!match) return completedOn;
  const [, , month, day] = match;
  const abbreviation = MONTH_ABBREVIATIONS[Number(month) - 1];
  if (!abbreviation) return completedOn;
  return `${abbreviation} ${Number(day).toString()}`;
}

// Reshapes the server's YYYY-MM-DD (completedOn, dueOn) into dd.MM.yyyy. Purely textual
// on purpose: the value is a calendar day with no time zone, and `new Date("2026-01-01")`
// would read it as UTC midnight and render the previous day for anyone west of UTC.
// Returns null for a missing or malformed value so the caller can fall back to prose.
export function formatDay(day: string | null): string | null {
  if (!day) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [, year, month, dayOfMonth] = match;
  return `${dayOfMonth}.${month}.${year}`;
}

// For real ISO timestamps (e.g. sealedAt) that carry full timezone info, unlike
// completedOn -- safe to hand to Date directly.
export function formatShortDateFromTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The viewer's own calendar day as YYYY-MM-DD. Built from the local getters rather than
// toISOString(), which is UTC and would show the wrong day around midnight. Being the
// same shape as the server's day strings, it compares against them as plain strings
// (YYYY-MM-DD sorts chronologically), which is how dueOn is classed as overdue/upcoming.
export function localCalendarDay(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// A local date's weekday in the server's Mon=0..Sun=6 numbering. getDay() counts from
// Sunday=0, so shift it back by one with wrap-around.
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// One-line prose for a rule: "Every day", "Every week on Mon, Fri", "Every 2 weeks on Tue".
export function describeRecurrence(rule: Recurrence): string {
  if (rule.frequency === "daily") return "Every day";
  // Driven off the name list rather than rule.weekdays, so the days read Mon-first and an
  // out-of-range index is skipped instead of rendering "undefined".
  const days = WEEKDAY_ABBREVIATIONS.filter((_, index) => rule.weekdays.includes(index)).join(", ");
  const every = rule.interval === 1 ? "Every week" : `Every ${rule.interval.toString()} weeks`;
  return days ? `${every} on ${days}` : every;
}
