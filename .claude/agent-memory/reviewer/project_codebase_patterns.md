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
- `QuestUpdate` requires all fields including `arc_id` — no partial update (PATCH) support.
- IDs are generated in Python (`uuid.uuid4()`) rather than at the DB level.
- `db.refresh()` added after `commit()` in `ArcRepository.create` and `QuestRepository.create` — fixed (2026-03-14). Placement is correct: post-commit, pre-return, on the just-created instance.
- `GET /` root endpoint returns `{"Hello": "World"}` — dead scaffolding code.
