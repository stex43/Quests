# CLAUDE.md
Guidance for Claude Code when working in this repository.

## Project Overview
Quests: FastAPI + SQLAlchemy + PostgreSQL backend (`backend/`), React 19 + TypeScript + Vite frontend (`frontend/`). Docker Compose manages all three; `docker-compose.yml` is the production stack (nginx-served frontend), `docker-compose.override.yml` (auto-loaded by a bare `docker compose up`) swaps in dev conveniences (Vite dev server, source mounts).

## Backend Commands
Run from `backend/` with a `.env` file present (see Environment).
```bash
pip install -r requirements.txt   # install deps
uvicorn src.main:app --reload     # run dev server (requires DB running)
alembic upgrade head              # run migrations
alembic revision --autogenerate -m "description"   # generate migration after model changes
pytest                            # run tests (needs Docker running for testcontainers; deps in requirements-dev.txt)
ruff check src/ tests/ && ruff format src/ tests/   # lint (pinned in requirements-dev.txt, matches CI)
```

## Frontend Commands
Run from `frontend/`.
```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc + vite build
npm run lint      # eslint
npm run preview   # preview production build
```

## Docker (Full Stack)
```bash
docker compose up --build                            # dev stack: db + backend + frontend
docker compose -f docker-compose.yml up -d --build   # production stack
```
Bare `docker compose` = dev stack (Vite dev server + source mounts, Postgres on `127.0.0.1:5432` for a local DB GUI). `-f docker-compose.yml` = production stack (nginx-served frontend, no source mounts, Postgres not published). The frontend resolves its API base URL at runtime (`window.location` host + `VITE_BACKEND_PORT`, or `VITE_BACKEND_ORIGIN` override) so it works on any LAN IP with no rebuild; `BACKEND_PORT` (default 8000) moves the backend for both services.

## Environment
Backend reads env vars from `.env` (or `.env.docker` for Docker; copy from `backend/.env.example`, using `POSTGRES_HOST=db` for the Docker one). Required: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`. Optional: `DEBUG` (SQL logging), `CORS_ORIGINS` (JSON list), `CORS_ORIGIN_REGEX`/`ALLOWED_HOST_REGEX` (LAN-only default, read as-is not JSON, empty disables each — wrap in single quotes). `APP_ENV` selects `.env.{APP_ENV}` over plain `.env`.

## Architecture
### Backend (`backend/src/`)
- `main.py` — app wiring: middleware, exception handlers, `/health`, routers; order (outermost first) `CORSMiddleware` > `LanRequestGuard` > `UnhandledErrorMiddleware` > app
- `middleware.py` — `LanRequestGuard` (DNS-rebinding/CORS-origin guard on `Host`/`Origin`); `UnhandledErrorMiddleware` (unhandled exception → 500 `ErrorResponse`, logged once)
- `routers/` — `arcs.py`, `quests.py` route handlers (`PUT`/`DELETE /quests/{id}/recurrence` set/stop a repeat)
- `dependencies.py` — `DbSession`/`ArcRepo`/`QuestRepo` deps; FastAPI caches `get_db` per request so handler + both repos share one session
- `schemas.py` / `repositories.py` — Pydantic schemas; repos stage work on the session only (never commit/refresh — route handlers own that)
- `models.py` / `database.py` — `Arc`/`Quest` ORM models (`Quest.arc` is `lazy="raise"`); engine, `SessionLocal`, `get_db` (rolls back on exception)
- `recurrence.py` — pure date engine for repeating quests: `local_today(utc_offset)` (the one place "today" is resolved; tests monkeypatch it), `first_on_or_after`/`next_after`, and the stored rule form (weekly rules carry a server-set `anchor_on`, never exposed to clients)
- `response_building.py` — `build_arc_response`: active view splits open quests into `quests` (due today/overdue/undated) and `upcoming` (`due_on > today`)
- `settings.py` — `pydantic-settings` config, incl. CORS/host regex validation at startup
- `exceptions.py` / `exception_handlers.py` — `DomainError` base (`status_code`/`error` attrs) with `NotFoundError`/`ConflictError`/`DomainValidationError` subclasses (routers raise these, never `HTTPException`); one handler maps any `DomainError` to `ErrorResponse`, another turns `RequestValidationError` into 400 — no generic `Exception` handler (`UnhandledErrorMiddleware` covers 500s)
- `backend/tests/`: real ephemeral Postgres via testcontainers, started at `conftest.py` module level before any `src` import (env vars must be set before that first import); per-test isolation via a SQLAlchemy savepoint/external-transaction pattern (`db_session` fixture) so handler-level `db.commit()` calls don't leak between tests; `client` fixture builds `TestClient(app, base_url="http://localhost")` (the guard 400s the default `testserver` host) with `get_db` overridden to the test's `db_session`

### Data Model
**Arc**: title; has many Quests (cascade delete). **Quest**: belongs to an Arc; title, description, `completed` flag, nullable `completed_on` date (completer's local calendar day, resolved server-side from a client UTC offset). Repeating quests: nullable `recurrence` (JSONB rule: `daily` or `weekly` with `interval` + `weekdays`, Mon=0), `series_id` grouping a series' instances, `due_on`. Completing an instance spawns the next (fixed calendar: next date after `max(today, due_on)`); un-completing deletes the spawned one; partial unique index `uq_quests_open_series` allows one open instance per series (flush ordering in `QuestRepository.complete`/`uncomplete` depends on it). An active series keeps `count_open > 0`, so its arc never gets the seal prompt. Both have server-set `created_at` fixing list order: arcs newest first, quests oldest first, `id` tiebreaker.
### Migrations
Alembic in `backend/alembic/`; `env.py` imports `models.Base.metadata` and pulls the DB URL from `settings`. Run from `backend/`.
### Frontend (`frontend/src/`)
Split-screen Tasks view (left nav panel + right detail panel) plus a separate Archive view for sealed arcs/completed quests.
- `App.tsx` — composes the feature hooks, wires handlers into the two panels; one shared `useMutationError()` so any success clears either domain's error
- `features/arcs/` — `useArcs.ts` (arc CRUD + loading/error), `useQuests.ts` (quest CRUD + optimistic `toggleComplete` across the `quests`/`upcoming`/`recentCompleted` buckets + per-quest serialized `setRecurrence`), `useSelectedQuest.ts` (stores only the selected id, derives `Quest` from `arcs` each render), `useMutationError.ts` (`runMutation` sets/re-throws `mutationError`), `useSealPrompt.ts` (transient client-only "Seal this arc?" state), `useViewNavigation.ts` (Tasks/Archive tab + one-shot `focusArcId` to scroll to an arc)
- `components/` — `ArcList.tsx` (Tasks left panel: expansion, arc creation, error dismissal); `ArcCard.tsx` (one arc: unsealed gets rename/delete/add-quest/seal-confirm, sealed renders `SealedArcHeader` instead with none of that); `SealedArcHeader.tsx` (collapsed sealed-arc header, expands to a completed preview in Tasks or the full quest list in Archive); `CompletedFooter.tsx` + `CompletedPreviewList.tsx` (collapsible "N completed" footer, default collapsed, expanding to a capped completions list with a "View all in Archive" link); `ArchiveList.tsx` (Archive left panel, filters every arc down to its completed quests); `UpcomingFooter.tsx` (collapsible "N upcoming" footer listing not-yet-due series instances); `RecurrencePicker.tsx` (Off / Every day / Weekly picker, used in the add-quest form and `QuestDetail`); `QuestRow.tsx` (one quest row: selection highlight, delete, repeat icon, overdue marker); `QuestDetail.tsx` (right panel: title/description editor, completion toggle, `dd.MM.yyyy` completion date, due date + Repeat picker); `icons.tsx` (shared SVG icons)
- `api.ts` — `BASE_URL` resolved per load; snake_case→camelCase mapping; `completeQuest`/`uncompleteQuest` send the UTC offset and return the updated quest (plus the spawned `nextInstance` / `removedInstanceId`)
- `dateFormat.ts` — `formatDay` (textual `dd.MM.yyyy`, never `new Date()` on a `YYYY-MM-DD`), `localCalendarDay`, `weekdayIndex` (JS `getDay` → Mon=0), `describeRecurrence`
- `types.ts` — camelCase throughout (`arcId`, not `arc_id`)

Patterns: `--qj-*` custom properties in `index.css` for colors/fonts/radii/layout, referenced via `var()`; `.arc-list-panel` clips overflow so its rows must wrap, not overflow; `React.memo` on all components, `useCallback` on hook-returned handlers; `mutationError` kept separate from fetch `error`, child catches and re-throws to parent; accessible `<button>`s with ARIA labels and `focus-visible` outlines (except editable text fields, caret-only).

## Workflow
- For any coding, editing, or fixing tasks → delegate to the `coder` subagent
- When asked to review code → delegate to the `reviewer` subagent
- Run the reviewer automatically when it is obvious the user would want it (e.g. after completing a feature or a set of changes); otherwise ask first
- After a review: if all issues are clear-cut and the fix is unambiguous, apply fixes automatically; if any issue requires a judgment call or the right approach is unclear, present the findings and ask before proceeding

## Code Style
- Python: ruff with `E`, `W`, `F`, `I`, `UP` rules, line length 120, Python 3.12 target, double quotes
- TypeScript: typescript-eslint with react-hooks and react-refresh plugins
