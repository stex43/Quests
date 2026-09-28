---
name: project_codebase_patterns
description: Key architectural patterns, conventions, and known gaps in the Quests backend and frontend codebase
type: project
---

Backend uses synchronous SQLAlchemy (not async) throughout — `database.py` has a `# todo: async?` comment indicating this is a known open question, not an oversight. Engine `echo` is gated on `settings.debug` (default `False`), so SQL logging is opt-in.

**Why:** The codebase is exploratory/early-stage; several `# todo` comments reveal the author is learning SQLAlchemy and FastAPI patterns.

**How to apply:** When reviewing, note that async migration is a known future concern. Don't treat the sync session as a critical bug, but flag it as context-appropriate medium priority.

## Transaction management
- Repos only stage changes (add/delete/mutate ORM objects); they never commit or refresh
- Handlers call `db.commit()` explicitly after every mutating operation, and `db.refresh()` post-commit where they return the object (`create_arc`, `create_quest`, `complete_quest`, `uncomplete_quest`)
- `update_arc`/`update_quest` (and `create_quest`) wrap `db.commit()` in `try/except IntegrityError` → `db.rollback()` + `raise ConflictError(...)` (409 via the exception handlers)
- `QuestUpdate` is all-optional (partial PATCH); the handler 400s an explicit `null` for `title`/`description`/`arc_id`, and `QuestRepository.update` skips `None` fields

## Quest completion
- `POST /quests/{id}/complete` and `/uncomplete` return **200 + full `schemas.Quest`** (not 204) so the client learns the server-resolved `completed_on`; both are idempotent
- `completed` is excluded from `QuestCreate`/`QuestUpdate` by design; only the action endpoints change it
- Route ordering: literal `/{quest_id}/complete` segments are safe from UUID path-param collision
- `QuestRow`'s completion checkbox is deliberately *not* disabled while a toggle is in flight (see the comment in `QuestRow.tsx`); the central `toggleInFlightRef` guard in `useQuests` drops the second click. Do not re-raise as a gap
- `role="checkbox"` on a `<button>` in `QuestRow` — technically invalid per ARIA in HTML, but `aria-checked`/`aria-label` are correct and widely supported in practice

## Remaining known gaps
- Three learning-note `# todo` comments in `database.py` (`wtf is engine`, `autocommit`, `yield`) — should not be in production source. Low priority.
- No pagination on `GET /arcs` (`# todo: paging` in `routers/arcs.py`).
- IDs are generated in Python (`uuid.uuid4()`) rather than at the DB level.
- `GET /` root endpoint returns `{"Hello": "World"}` — dead scaffolding code.
