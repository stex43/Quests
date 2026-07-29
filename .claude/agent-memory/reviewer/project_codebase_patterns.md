---
name: project_codebase_patterns
description: Key architectural patterns, conventions, and known gaps in the Quests backend and frontend codebase
type: project
---

Backend uses synchronous SQLAlchemy (not async) throughout — `database.py` has a `# todo: async?` comment indicating this is a known open question, not an oversight. Engine uses `echo=True` (logs all SQL), which is fine for dev but will be noisy in prod.

**Why:** The codebase is exploratory/early-stage; several `# todo` comments reveal the author is learning SQLAlchemy and FastAPI patterns.

**How to apply:** When reviewing, note that async migration is a known future concern. Don't treat the sync session as a critical bug, but flag it as context-appropriate medium priority.

## Resolved issues (as of 2026-03-14 refactor)
- `Quest.arc_id` now correctly typed `Mapped[uuid.UUID]` — fixed
- `model_config = ConfigDict(from_attributes=True)` added to all three response schemas (`Quest`, `Arc`, `ArcExtended`) — fixed
- `get_all` now uses `selectinload` to eagerly load quests — fixed
- `list()` wrapping added around `.all()` return — fixed
- Session sharing via `DbSession = Annotated[Session, Depends(get_db)]` — fixed, with explanatory comment
- `create_quest` now validates arc existence — fixed
- `update_quest` now handles `arc_id` reassignment with arc existence check — fixed
- Redundant `id=uuid.uuid4()` in repo `create` methods — removed
- `ConstrainedStr` with `min_length=1, max_length=100` added to all input schema fields — fixed
- `RequestValidationError` handler returning 400 — added
- `lazy="raise"` on `Quest.arc` — added

## Remaining known gaps (as of 2026-03-14 review)
- Three learning-note `# todo` comments in `database.py` (`wtf is engine`, `autocommit`, `yield`) — should not be in production source. Low priority.
- No pagination on `GET /arcs` (noted with `# todo` comment in main.py).
- `allow_credentials` not set in CORS middleware.
- `Arc` model has no `description` field — appears intentional.
- IDs are generated in Python (`uuid.uuid4()`) rather than at the DB level.
- `GET /` root endpoint returns `{"Hello": "World"}` — dead scaffolding code.

## Transaction management refactor (2026-03-29)
- commit/refresh removed from all repo methods — repos only stage changes (add/delete/mutate ORM objects)
- Handlers call `db.commit()` explicitly after every mutating operation
- `db.refresh()` called only in `create_arc` and `create_quest` handlers, post-commit, before return
- `update_quest` wraps `db.commit()` in `try/except IntegrityError` → `db.rollback()` + HTTPException 409
- `DbSession = Annotated[Session, Depends(get_db)]` shared alias confirmed correct — both repo factories and handler `db:` param share one session per request
- `QuestUpdate` now has all-optional fields with `| None = None` — partial PATCH support is live
- `update_quest` null guards added for `title` and `description` (2026-03-29): explicit `{"title": null}` / `{"description": null}` now return 400, mirroring the existing `arc_id` null guard
- `QuestRepository.update` uses `if field is not None` guards — so unset fields (default `None`) are silently skipped, which is the correct partial-PATCH behavior; the handler null guards intercept the case where a caller explicitly sends `null`

## Frontend quest completion feature (reviewed 2026-07-26, round 5)
- Round 4 issues confirmed fixed: `setIsToggling(false)` added to the quest-change `useEffect` in `QuestDetail`; combined selector `.quest-row[data-selected="true"] .quest-title[data-completed="true"]` added to `QuestRow.css`.
- No new correctness issues found in the completion feature.
- Pre-existing UX gap (carried forward): empty-title Enter keydown in `QuestDetail` silently does nothing — no visual feedback to the user. Pre-exists the completion feature; not introduced by it.
- Pre-existing UX gap (carried forward): `quest-complete-checkbox` button in `QuestRow` is never set `disabled` during an in-flight toggle — second click is silently dropped by the ref guard. Dead CSS rule `.quest-complete-checkbox:disabled` remains.

## Frontend quest completion feature (reviewed 2026-07-26, round 4)
- `QuestDetail.isToggling` is not reset when the selected quest changes — the `useEffect` on `quest.id` resets edit state but not `isToggling`. If a toggle is in-flight for quest A and the user selects quest B, quest B's complete button renders as `disabled` until quest A's request resolves. Fix: add `setIsToggling(false)` inside the `useEffect` that guards on `quest?.id !== prevQuestIdRef.current`.
- CSS specificity in `QuestRow.css`: `.quest-title[data-completed="true"]` (gray, line-through) comes after `.quest-row[data-selected="true"] .quest-title` (blue), so a quest that is both selected and completed renders gray+strikethrough, losing the blue selected-text cue. The row background highlight still shows selection. Whether this is intentional is unclear.

## Frontend quest completion feature (reviewed 2026-07-26, round 3)
- `RawQuest` type correctly derives `completed` via `Omit<Quest, "arcId">` — no explicit addition needed; `mapQuest` spreads it through
- `useSelectedQuest` reconciliation comment on line 29 is a maintenance marker — reviewers must verify all Quest fields are covered when Quest type changes
- Central `toggleInFlightRef` guard (a `Set<string>` in `useQuests`) is in place — correctly gates both QuestRow and QuestDetail from double-firing the same quest toggle simultaneously
- Naming is consistent: `onToggleComplete` everywhere in the tree
- `role="checkbox"` on `<button>` in `QuestRow` — still technically invalid per ARIA in HTML spec, but the `aria-checked` attribute is correctly set and the `aria-label` updates on state change; CSS styles off `[aria-checked="true"]`; this combination is widely supported in practice
- `useSelectedQuest` reconciliation covers all four Quest fields including `completed` — correct
- `QuestDetail` complete button has no `disabled` attribute during in-flight toggle — the in-flight guard is in `useQuests` (ref-based, not a state flag), so there is no feedback to QuestDetail that a toggle is pending; the button stays clickable but the second click is silently dropped. This is a UX gap but not a correctness bug.
- `runMutation` in `useMutationError` clears `mutationError` on success — means a failed toggle error banner is cleared by a subsequent successful toggle or any other mutation; this is the intended shared-error design
- `quest-complete-checkbox` has no `disabled` CSS rule triggered during toggle — `.quest-complete-checkbox:disabled` exists but the button is never set `disabled`; matches the silent-drop pattern above

## `completed` bool field added to Quest (2026-07-26)
- `models.Quest` has `completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)` — Python-side default only; no `server_default` in model, BUT migration uses `server_default=sa.false()` then strips it via `alter_column` — existing rows handled safely
- `schemas.Quest` response schema includes `completed: bool` — correct; flows through `ArcExtended` via `list[Quest]`
- `schemas.QuestCreate` and `schemas.QuestUpdate` deliberately do NOT include `completed` — by design
- `QuestRepository.complete()` / `uncomplete()` set `quest.completed = True/False`; called only by action endpoints
- `POST /quests/{id}/complete` and `POST /quests/{id}/uncomplete` exist — no idempotency guard; both always write to DB and return 204 even if state is unchanged. Reviewed 2026-07-26, flagged as medium.
- Route ordering: `/{quest_id}/complete` and `/{quest_id}/uncomplete` are safe from UUID collision because FastAPI matches literal path segments before UUID path params on the same prefix
- Naming: `uncomplete` is a real English word (to undo completion) but non-standard in APIs; tradeoff documented
- `completed` is correctly excluded from PATCH entirely; IntegrityError guard absent from `/complete` and `/uncomplete` — intentional, no FK/unique constraint can fire on a boolean mutation
- PATCH null-guard coverage is complete and consistent for all three `QuestUpdate` fields
