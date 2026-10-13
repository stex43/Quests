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

## List ordering (added 2026-09-28)
- `Arc` and `Quest` have a server-set `created_at` (`DateTime(timezone=True)`, `server_default=func.now()`), not exposed in the API
- Arcs: `created_at DESC, id DESC` in `ArcRepository.get_all`; quests: `created_at ASC, id ASC` via `Arc.quests` `relationship(order_by=...)`
- The directions mirror the frontend (`useArcs.create` prepends, `useQuests.create` appends) — if either insertion side changes, the other must follow or a reload reorders the list
- Rows that existed before migration `d2ccfda40961` share one timestamp, so their order is by UUID — arbitrary but stable; the user was told

## Remaining known gaps
- No pagination on `GET /arcs` (`# todo: paging` in `routers/arcs.py`).
- IDs are generated in Python (`uuid.uuid4()`) rather than at the DB level.

## Findings from the 2026-09-28 full review
Fixed the same day (check for regressions, don't re-derive):
- `dependencies.py`'s comment and CLAUDE.md now correctly say FastAPI caches `get_db` per request (the old "two sessions if inlined" warning was wrong).
- 500s: the `Exception` handler (which Starlette runs in `ServerErrorMiddleware`, outside CORS, and which re-raised → double traceback) was replaced by the pure-ASGI `UnhandledErrorMiddleware` in `middleware.py`, innermost (CORS > LanRequestGuard > UnhandledErrorMiddleware > app). It logs once via `uvicorn.error` and returns the `internal_error` ErrorResponse only if the response hasn't started; otherwise it re-raises. Do not re-add an `add_exception_handler(Exception, ...)`.
- Dead code removed: `update_arc`'s `try/except IntegrityError` (no constraint on an arc title can fire), `GET /`, `GET /quests/{id}`, `GET /arcs/{id}/quests`, `QuestRepository.get_by_arc`. `TODO.md`'s stale "[Critical] IntegrityError" item removed.

Still open:
- `ArcCard` `cancelledRef` is not reset in `startEdit` (unconfirmed across browsers): a stale `true` could swallow the next edit's first blur-commit.
- The compose backend healthcheck hits `GET /arcs` (loads everything every 10s); `/health` is cheaper but doesn't touch the DB — a judgment call, not raised to the user yet.
- Simplification idea offered, user has not decided: `key={selectedQuest?.id}` on `QuestDetail` to drop most of its mid-save focus machinery. Don't push this again unless asked.

## 2026-10-13 simplification pass (six parts, done in parallel by separate coder agents)
All verified correct, no regressions:
- `useSelectedQuest` now stores only `selectedQuestId` and derives `Quest` via a lookup across `arc.quests`/`arc.recentCompleted` on every render (returns the actual object reference from `arcs`, so no extra re-renders, and a deleted quest/arc naturally resolves to `null`). `QuestDetail` was deliberately left unchanged — its `prevQuestIdRef`/`pendingFocusRef` mid-save-identity-guard machinery still works unmodified because it only reacts to `quest?.id` changes, which behave the same under the new derivation.
- Backend `DomainError` hierarchy collapsed to one handler — see `project_exception_handling.md`.
- `database.py`'s three learning-note `# todo` comments replaced with one factual `autoflush=False` comment — the known gap from this file's earlier "Remaining known gaps" entry is resolved, don't re-flag.
- CLAUDE.md shrunk 165→71 lines; spot-checked every one-line component description (incl. the archive/seal components `SealedArcHeader`/`CompletedFooter`/`CompletedPreviewList`/`ArchiveList`/`useSealPrompt`/`useViewNavigation`) against source — all accurate.
- `deploy/` package (cli.py/core.py/config.py) replaced by a single root `deploy.py`, intentionally dropping log files, secret redaction, health-check retries, and status/logs subcommands (accepted scope reduction, don't re-flag). SSH→HTTPS regex still covers both scp-style and `ssh://` forms; `.env.docker` check still precedes `docker compose up`; subprocess calls use `check=True`.
  - **Regression reintroduced:** the new `deploy.py` only checks `(clone_path / ".git").exists()` to decide clone-vs-fetch, which is exactly the naive check round-1 review (see `project_deploy_console.md` finding #4) replaced with `_is_valid_clone` because a Ctrl+C during the first clone leaves a half-cloned `.git` dir that looks "already cloned" forever after. Worth flagging again if seen; low/medium severity since it's manually operated and self-diagnosable (user can just delete the clone), but it is a real regression, not a fresh nit.
- `.claude/agents/coder.md`: the two changed lines (sync-`Session`/no-`async def` guidance, and "no backend test suite yet") are accurate. Note: the untouched line "Do not mark done if tests are failing" is stale now that neither backend nor frontend has any test suite/script — pre-existing, not introduced by this pass, low priority to eventually clean up.
