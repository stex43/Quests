---
name: feedback_focus_review_scope
description: Settled focus-indicator decisions in the Quests frontend that must not be re-litigated, plus how the user wants focus/a11y reviews scoped
type: feedback
---

Do not re-raise these settled decisions about focus indicators:
- The five editable text fields (`.arc-title-input`, `.new-quest-input`, `.arc-list-input`, `.quest-detail-title-input`, `.quest-detail-description-input`) deliberately draw **no** focus ring (`outline: none` on `:focus-visible`). Buttons, icon buttons, the wax stamp and the quest-row controls keep theirs.
- The focus-ring recolour to `--qj-ink-heading` (plus `--qj-focus-ring-inverse` for dark grounds).

**Why:** The user saw the alternative (a darkened border) on screen and explicitly chose the caret-only option; the WCAG 2.4.7 Understanding document accepts the caret as the indicator for text fields. Re-proposing a ring reads as ignoring a decision they already made deliberately.

**How to apply:** In any review touching focus styling, treat the above as fixed premises. Still in scope: whether the `--error` outlines survive, whether specificity/source order actually delivers the intended result, and whether anything *else* accidentally loses its ring.

Related review-scoping preference: when the user says they have already verified something in the browser (colours, whether a ring appears on click, whether focus moves), do **not** spend the review confirming it. They want the findings that clicking cannot surface — race windows, unreachable states, guards that fire when the target is unmounted, comment claims that the code does not deliver.
