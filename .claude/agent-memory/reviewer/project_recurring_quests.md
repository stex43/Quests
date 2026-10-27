---
name: project_recurring_quests
description: Repeating-quests feature (due_on/series_id/recurrence, upcoming bucket, uq_quests_open_series) — recurring checks and the open findings from the first review on 2026-10-27
type: project
---

Feature landed 2026-10-27: backend committed first, frontend reviewed while still uncommitted. Spec lives in the session plan file; it is not in the repo. A deliberate change after the spec: weekly rules are anchored on the first matching weekday on or after today.

Recurring checks for any change that touches this area:
- Active-view arcs now have THREE buckets (`quests`, `recentCompleted`, `upcoming`). Any new client helper that finds, patches or removes quests must cover all three, and `useSelectedQuest.findQuestById` too. `ArcList.isArcSelected` also has to know about `upcoming`.
- `uq_quests_open_series` is not deferrable. Any repo code that changes which instance is open must flush the "close" step (completed=True, or the DELETE) before the "open" step. `complete()` and `uncomplete()` do this with an explicit `db.flush()`.
- Dates on the frontend are YYYY-MM-DD strings compared as strings. Do not parse them with `new Date`. Weekdays are Mon=0 (`weekdayIndex()` converts from getDay).
- The client never sees `anchor_on`: `schemas.WeeklyRule` drops it because pydantic ignores extra fields by default.

Findings raised 2026-10-27 (check on re-review whether each was fixed or deliberately accepted):
1. Un-completing a completed instance that is NOT the latest one (reachable from Archive) still deletes the series' current open instance, and brings back an old overdue due date. After "stop repeating", or after a new rule was set, it brings the old series back, so the user ends up with duplicate repeating quests. This follows the spec's wording, but is it the intent?
2. `set_recurrence` recomputes `due_on` from today even when today's occurrence is already completed. Example: complete a daily quest, open tomorrow's instance, pick Weekly (the default is today's weekday). The quest jumps back into today's list.
3. A tab left open past midnight never moves upcoming instances into the main list until a refetch, which only happens on a tab switch or reload.
4. Low: moving a quest into `quests` puts it at the front, but the server orders by created_at. The UpcomingFooter.css comment says the date wraps under the title, but `flex: 1` on the title stops that. The CLAUDE.md update for this feature has not been done.

**Why:** These are the decisions the user may come back to, so a re-review should start from them and not work them out again.
**How to apply:** On a re-review, check each one first. Once the user has ruled one as intended, do not raise it again.
