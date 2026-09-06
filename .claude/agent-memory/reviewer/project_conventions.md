---
name: project_conventions
description: Established backend conventions for the Quests FastAPI project — patterns to enforce during reviews
type: project
---

Key conventions confirmed from reading the codebase:

- `DbSession = Annotated[Session, Depends(get_db)]` must be shared across repo factory functions in the same request; never duplicate the `Annotated` inline.
- Repository `create` methods always call `db.refresh()` after `db.commit()`.
- `ConstrainedStr` (max 100) for titles, `ConstrainedText` (max 1000) for descriptions; minimum length 1 on both.
- Response schemas carry `model_config = ConfigDict(from_attributes=True)`.
- Validation errors return 400, not 422 (custom `RequestValidationError` handler in main.py).
- `Quest.arc` relationship has `lazy="raise"` — never access it without explicit eager loading.
- `ArcRepository.get_all()` uses `selectinload` for eager loading of quests.
- HTTP status codes: 201 for create, 204 for update/delete, 200 for reads, 404 for missing resources. Exception (deliberate, 2026-08): `POST /quests/{id}/complete` and `/uncomplete` return **200 + full `schemas.Quest`**, not 204, so the client learns the server-resolved `completed_on` in one round trip. Both are idempotent no-ops when already in the target state.
- Routes are in `src/routers/{arcs,quests}.py` with `src/dependencies.py` holding `DbSession`/`ArcRepo`/`QuestRepo` aliases. (CLAUDE.md's backend bullets were corrected to match on 2026-08-09.)
- `Quest.completed_on` is a nullable `Date` (a calendar day, never a datetime). The client sends an optional `{"utc_offset_minutes": N}` body (`ge=-840, le=840`); the server adds it to `datetime.now(UTC)` and stores `.date()`. The offset itself is never persisted. Only stamped on the incomplete→complete transition.
- `extra="forbid"` is set on `QuestComplete` ONLY (added 2026-08, deliberately local): a typo'd `utc_offset_minute` must 400 rather than silently fall back to the UTC day. Every other request schema keeps Pydantic's default ignore behaviour. Do not flag this asymmetry as an inconsistency — it is intentional; the rule is "forbid extras where an ignored field would silently change behaviour".
- `QuestUpdate` uses PATCH semantics — all fields optional.
- `QuestCreate` does NOT include `arc_id`; that comes from the path parameter.

**Why:** These were the conventions established in PR #9 ("Introduce repository layer and harden backend quality") and are the baseline this project should stay consistent with.

**How to apply:** Flag any deviation from these patterns as a consistency issue during reviews.
