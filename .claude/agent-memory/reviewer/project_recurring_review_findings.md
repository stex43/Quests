---
name: Recurring frontend review findings
description: Cross-cutting frontend issues that came up in reviews and should be rechecked whenever layout/navigation changes (mobile layout review 2026-11-09)
type: project
---

Issues that are easy to reintroduce whenever screens or navigation change:

- Mutation errors from QuestDetail, toggles, and recurrence changes only show in ArcList's error banner. Any screen that hides or replaces ArcList, such as the mobile detail screen or the Archive view, makes those failures silent.
  **Why:** child components catch the error with the comment "displayed by parent via mutationError". That comment assumes the banner is on screen.
  **How to apply:** whenever a change hides the list or adds a screen, ask where `mutationError` is rendered.

- `useArcs` keeps the previous view's arcs until the new fetch resolves. Effects that run on a view switch, such as ArchiveList's one-shot `focusArcId`, therefore see stale data. In that case the effect clears the focus id without ever scrolling.
  **How to apply:** be skeptical of one-shot effects that consume state on the first render after `goToArchive`.

- Rendering different JSX tree shapes per breakpoint (`isMobile ? wrapper : bare`) remounts the panels when the viewport crosses the breakpoint, for example when a phone is rotated. That loses drafts and collapse state.

Tooling note: in the 2026-11-09 review the reviewer had no shell, so it could not run `git diff`. When desktop must stay unchanged, ask the caller to paste the diff.
