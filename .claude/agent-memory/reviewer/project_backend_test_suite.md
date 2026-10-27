---
name: project_backend_test_suite
description: Backend pytest suite architecture (testcontainers + savepoint isolation), added as a first PR around 2026-10-13 — established conventions plus open issues from the first review, check status on re-review
type: project
---

`backend/tests/` (new, first backend test suite — CLAUDE.md's "No backend tests yet" line predates this and needs updating once merged):

**Established architecture — don't re-flag as a bug:**
- `conftest.py` starts a `testcontainers` Postgres container as module-level code (not a fixture) and sets `POSTGRES_*` env vars before importing anything from `src`, because pytest imports `conftest.py` before collecting test modules and `src.settings`/`src.database` build `Settings()`/the engine at import time.
- Per-test isolation: `db_session` fixture opens a connection + real transaction, binds a `Session(..., join_transaction_mode="create_savepoint")` to it, and the `client` fixture overrides `get_db` to yield that same session. A route handler's `db.commit()` only releases a SAVEPOINT; the outer transaction is rolled back in fixture teardown. Schema is `drop_all`/`create_all` once per session (not Alembic).
- `created_at` ordering tests pass an explicit, distinct `created_at` to `make_arc`/`make_quest` because the whole test runs inside one outer Postgres transaction, so `server_default=func.now()` resolves to the same instant for every row otherwise.
- The two 409/`IntegrityError` paths (`create_quest`, `update_quest` arc move) are tested by monkeypatching the test's own `db_session.commit` to delete the referenced arc row immediately before calling the real `commit`, forcing a genuine FK violation at flush time. This is deliberate and works because `db_session` has `autoflush=False`.

**Re-review 2026-10-27: the flaky-test (active-view now uses UTC "today"), `client` try/finally, CI/ruff `tests/` scope, and the 404/length-validation coverage gaps are all FIXED. Only `response_building.py`'s `date.min` fallback remains unexercised. Items below are historical.**

**Open issues from the first review (2026-10-13) — now resolved, kept for context:**
- **Flaky test (real bug, not just theoretical):** `test_active_view_recent_completed_only_today_newest_first_capped` (`test_arcs_views.py`) builds its expected "today" via Python's local `date.today()`, but the endpoint under test computes "today" from `datetime.now(UTC)` (no offset passed). On any machine whose local timezone isn't UTC this mismatches for a chunk of every day, not just a midnight edge case — it will fail deterministically at certain hours on a non-UTC dev box even though CI (ubuntu-latest, UTC) won't reproduce it. Fix: derive the expected "today" from UTC the same way the endpoint does, or freeze time like the neighboring `test_utc_offset_shifts_today_boundary_near_utc_midnight` does.
- `client` fixture in `conftest.py` sets `app.dependency_overrides[get_db]` *before* entering `with TestClient(app, ...) as c:`. If that `__enter__` ever raised (app startup failure), the override would never be cleared (the generator never reaches the teardown line), leaking into later tests. Low probability today (no lifespan hooks), but fragile — recommend a `try/finally` around the override.
- CI's backend job runs `ruff check src/` / `ruff format --check src/` only — the new `tests/` directory is never linted or format-checked, in CI or per CLAUDE.md's documented local command. Recommend widening both to include `tests/`.
- Minor coverage gaps worth adding if touching this area again: no test for `POST /arcs/{nonexistent_arc_id}/quests` (the `NotFoundError` branch of `create_quest`), no happy-path assertion of `create_quest`'s response shape under a normal (non-sealed) arc, no `QuestCreate` title/description length-validation tests (only `Arc`'s equivalent is tested), and `response_building.py`'s `completed_on or date.min` defensive fallback is never exercised.

**How to apply:** On the next review touching `backend/tests/`, check whether the flaky-test and fixture-hygiene items above were addressed before treating them as still-open; don't re-derive them from scratch.
