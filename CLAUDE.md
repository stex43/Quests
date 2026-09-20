# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quests is a full-stack web app with:
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL, located in `backend/`
- **Frontend**: React 19 + TypeScript + Vite, located in `frontend/`
- **Infrastructure**: Docker Compose manages PostgreSQL, the backend and the frontend. `docker-compose.yml` is the production stack (frontend built and served by nginx); `docker-compose.override.yml`, auto-loaded by a bare `docker compose up`, swaps in the dev conveniences (Vite dev server, source mounts)

## Backend Commands

All backend commands run from the `backend/` directory with a `.env` file present (see Environment below).

```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server (requires DB running)
uvicorn src.main:app --reload

# Run migrations
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "description"

# Lint (ruff comes from requirements-dev.txt, pinned to match CI)
ruff check src/
ruff format src/
```

`requirements-dev.txt` pulls in `requirements.txt` plus a pinned `ruff`. CI installs that
same pin directly; keep the two in step or the hook and the workflow will disagree.

## Frontend Commands

All frontend commands run from the `frontend/` directory.

```bash
npm install
npm run dev       # start Vite dev server
npm run build     # tsc + vite build
npm run lint      # eslint
npm run preview   # preview production build
```

## Docker (Full Stack)

```bash
docker compose up --build                      # dev stack: db + backend + frontend
docker compose -f docker-compose.yml up -d --build   # production stack
```

A bare `docker compose` auto-loads `docker-compose.override.yml` on top of the base file and gives the dev stack: the `frontend` service runs the Vite dev server on 5173 with `frontend/src` mounted, `backend/src` is mounted too, and Postgres is published on `127.0.0.1:5432` (loopback only, for a local DB GUI). Source edits hot-reload; changes to `vite.config.ts` or dependencies need `--build`.

Passing `-f docker-compose.yml` skips the override and gives the production stack: the frontend is built (`vite build`) and served by nginx on 5173, there are no source mounts (the images are the source of truth), and Postgres is not published at all — the backend reaches it over the compose network as host `db`.

The frontend resolves the API base URL at runtime: the host comes from `window.location` and the port from `VITE_BACKEND_PORT` (default 8000), while `VITE_BACKEND_ORIGIN` overrides both. So the app works on whatever LAN IP the page was opened on, with no rebuild. In the production image `VITE_BACKEND_PORT` is baked in at build time (compose passes it as a build arg), but the host is still read from `window.location`, so the LAN-IP behaviour is unchanged. Set `BACKEND_PORT` (shell or root `.env`, default 8000) to move the backend; compose passes it to both services.

## Environment

Backend reads env vars from a `.env` file (or `.env.docker` for the Docker service). Copy `backend/.env.example` to `backend/.env` and fill in values. `backend/.env.docker` is not tracked either — create it the same way, with `POSTGRES_HOST=db`; compose's `db` service reads its credentials from that file too, so both containers stay in sync. Required vars:

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DB=
```

Optional vars:

```
DEBUG=False        # set to True to enable SQLAlchemy query logging
CORS_ORIGINS=[]   # e.g. ["http://localhost:5173"]
CORS_ORIGIN_REGEX= # defaults to a LAN-only pattern (localhost, private IPs, *.local); empty disables it; read as-is, not JSON
ALLOWED_HOST_REGEX= # same LAN-only default, matched against the Host header; empty disables the host check
```

Wrap custom `*_REGEX` values in single quotes: compose's `env_file` parser expands `$` and python-dotenv processes escapes inside double quotes.

The `APP_ENV` env var determines which file is loaded: `.env.{APP_ENV}` if set, otherwise `.env`.

## Architecture

### Backend (`backend/src/`)

- `main.py` — FastAPI app setup: middleware, exception handler registration, and router registration
- `middleware.py` — `LanRequestGuard`, a pure ASGI middleware: a `Host` not matching `allowed_host_regex` gets 400 (DNS-rebinding defence), and an unsafe-method request whose `Origin` is neither a CORS-allowed origin nor same-origin with the (already validated) `Host` gets 403 (no `Origin` passes, `null` does not; same-origin is what keeps Swagger's "Try it out" working when `CORS_ORIGIN_REGEX` is empty); it builds its own `ErrorResponse` bodies and is registered before `CORSMiddleware` so CORS wraps it and still answers preflights
- Backend tests must construct `TestClient(app, base_url="http://localhost")` (or set `ALLOWED_HOST_REGEX=` before importing `src.main`), because the guard rejects the default `testserver` host with 400 and `main.py` reads the regex at import time
- `routers/` — `arcs.py` and `quests.py` `APIRouter`s holding the route handlers
- `dependencies.py` — `DbSession = Annotated[Session, Depends(get_db)]` alias plus the `ArcRepo`/`QuestRepo` dependency aliases; the shared `DbSession` is what keeps both repos on one session per request
- `schemas.py` — Pydantic request/response schemas; `ConstrainedStr` (max 100) for titles, `ConstrainedText` (max 1000) for descriptions; response schemas have `model_config = ConfigDict(from_attributes=True)`
- `repositories.py` — `ArcRepository` and `QuestRepository`; each takes `Session` in `__init__`; `create` methods call `db.refresh()` after `commit()`; `get_all` uses `selectinload` for eager loading
- `models.py` — SQLAlchemy ORM models (`Arc`, `Quest`); `Quest.arc` has `lazy="raise"`
- `database.py` — engine (`echo` gated on `settings.debug`), `SessionLocal`, and `get_db` with explicit rollback on exception
- `settings.py` — `pydantic-settings` config; constructs `database_url` from individual Postgres vars; `debug: bool = False`; `cors_origin_regex` and `allowed_host_regex` default to `LAN_CORS_ORIGIN_REGEX` / `LAN_HOST_REGEX` (built from one shared host pattern) and are validated at startup (empty means off)
- `exceptions.py` / `exception_handlers.py` — domain exceptions and the handlers registered in `main.py` that map them to `ErrorResponse` bodies; routers raise domain exceptions and never `HTTPException`, and the validation handler is what turns 422 into 400

### Data Model

- **Arc**: a story arc with a title; has many Quests (cascade delete)
- **Quest**: belongs to an Arc via `arc_id` FK; has title, description, a `completed` flag, and a nullable `completed_on` date — the completer's local calendar day, resolved server-side from a client-supplied UTC offset (the time of day is deliberately not stored)

### Migrations

Alembic is configured in `backend/alembic/`. The `env.py` imports `models.Base.metadata` for autogenerate support and pulls the DB URL from `settings`. Run migrations from the `backend/` directory.

### Frontend (`frontend/src/`)

Split-screen layout with a left navigation panel (640px fixed) and right detail panel.

**Entry (`App.tsx`)**
- Holds no state of its own; it composes the feature hooks and wires their handlers into the two panels
- A single `useMutationError()` instance is shared by every hook, so any successful mutation clears a pending error from either domain — do not give a hook its own instance

**State (`frontend/src/features/arcs/`)**
- `useArcs.ts` — owns `arcs`, `loading`, `error`, and the arc create/update/remove mutations
- `useQuests.ts` — quest create/update/remove plus `toggleComplete`, which optimistically updates, applies the server response, and rolls back on failure; it patches only the fields a mutation owns so concurrent edits are not clobbered
- `useSelectedQuest.ts` — tracks the selected quest and re-syncs it from `arcs`; its equality check must list **every** user-visible field or the detail panel renders stale data
- `useMutationError.ts` — `runMutation` wrapper that sets `mutationError` and re-throws, so callers must catch

**Components (`frontend/src/components/`)**
- `ArcList.tsx` — left panel container; manages arc expansion state, arc creation form, error dismissal
- `ArcCard.tsx` — individual arc with expand/collapse, inline title editing, delete confirmation, and inline quest creation
- `QuestRow.tsx` — single quest item with selection highlighting and delete button
- `QuestDetail.tsx` — right panel; shows selected quest title/description with an inline editor. The complete/incomplete toggle is the circular wax stamp left of the title; the completion date reads as `dd.MM.yyyy` in the meta line under it
- `icons.tsx` — reusable SVG icons (`PencilIcon`, `TrashIcon`)

**API (`frontend/src/api.ts`)**
- `BASE_URL` is resolved per page load (`resolveBaseUrl()`): page host + `VITE_BACKEND_PORT` (empty or unset means 8000), or `VITE_BACKEND_ORIGIN` (trailing slashes stripped); env vars are typed in `vite-env.d.ts`
- `request()` helper with unified error handling (includes HTTP status + body in errors)
- All API calls convert snake_case responses to camelCase (`RawArc`, `RawQuest` types for the mapping)
- Methods: `getArcs`, `createArc`, `updateArc`, `deleteArc`, `createQuest`, `updateQuest`, `deleteQuest`, `completeQuest`, `uncompleteQuest`
- `completeQuest`/`uncompleteQuest` return the updated quest (the endpoints return 200, not 204); `completeQuest` sends the browser's UTC offset so the backend can resolve the completer's local date

**Types (`frontend/src/types.ts`)**
- Uses camelCase (`arcId`, not `arc_id`) throughout

**Patterns to follow**
- Colors, fonts and radii live as `--qj-*` custom properties in `src/index.css`; component CSS references them with `var()` rather than hard-coding literals
- `React.memo` on all child components; `useCallback` on every handler returned from a feature hook
- Separate `mutationError` state (distinct from fetch `error`) for create/update/delete failures
- Error propagation: child catches, re-throws to parent via callback; parent sets `mutationError`
- Accessibility: `<button>` elements (not divs), ARIA labels on all interactive elements, `focus-visible` outlines (`--qj-focus-ring`, or `--qj-focus-ring-inverse` over the dark selected row; both defined in `index.css`) on everything except editable text fields, where the caret is deliberately the only focus indicator, Enter key support on inputs

## Workflow

- For any coding, editing, or fixing tasks → delegate to the `coder` subagent
- When asked to review code → delegate to the `reviewer` subagent
- Run the reviewer automatically when it is obvious the user would want it (e.g. after completing a feature or a set of changes); otherwise ask first
- After a review: if all issues are clear-cut and the fix is unambiguous, apply fixes automatically; if any issue requires a judgment call or the right approach is unclear, present the findings and ask before proceeding

## Code Style

- Python: ruff with `E`, `W`, `F`, `I`, `UP` rules, line length 120, Python 3.12 target, double quotes
- TypeScript: typescript-eslint with react-hooks and react-refresh plugins
