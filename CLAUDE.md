# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quests is a full-stack web app with:
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL, located in `backend/`
- **Frontend**: React 19 + TypeScript + Vite, located in `frontend/`
- **Infrastructure**: Docker Compose manages PostgreSQL and the backend service

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

# Lint
ruff check src/
ruff format src/
```

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
docker-compose up --build   # starts db + backend
```

The docker-compose stack does NOT include the frontend; run it separately with `npm run dev`.

## Environment

Backend reads env vars from a `.env` file (or `.env.docker` for the Docker service). Copy `backend/.env.example` to `backend/.env` and fill in values. Required vars:

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
```

The `APP_ENV` env var determines which file is loaded: `.env.{APP_ENV}` if set, otherwise `.env`.

## Architecture

### Backend (`backend/src/`)

- `main.py` — FastAPI app and all route handlers; validation errors return 400 (not 422); uses `DbSession = Annotated[Session, Depends(get_db)]` alias for session sharing across repo dependencies
- `schemas.py` — Pydantic request/response schemas; `ConstrainedStr` (max 100) for titles, `ConstrainedText` (max 1000) for descriptions; response schemas have `model_config = ConfigDict(from_attributes=True)`
- `repositories.py` — `ArcRepository` and `QuestRepository`; each takes `Session` in `__init__`; `create` methods call `db.refresh()` after `commit()`; `get_all` uses `selectinload` for eager loading
- `models.py` — SQLAlchemy ORM models (`Arc`, `Quest`); `Quest.arc` has `lazy="raise"`
- `database.py` — engine (`echo` gated on `settings.debug`), `SessionLocal`, and `get_db` with explicit rollback on exception
- `settings.py` — `pydantic-settings` config; constructs `database_url` from individual Postgres vars; `debug: bool = False`

### Data Model

- **Arc**: a story arc with a title; has many Quests (cascade delete)
- **Quest**: belongs to an Arc via `arc_id` FK; has title and description

### Migrations

Alembic is configured in `backend/alembic/`. The `env.py` imports `models.Base.metadata` for autogenerate support and pulls the DB URL from `settings`. Run migrations from the `backend/` directory.

### Frontend (`frontend/src/`)

Split-screen layout with a left navigation panel (300px fixed) and right detail panel.

**Entry & State (`App.tsx`)**
- Manages all state: `arcs`, `loading`, `error`, `mutationError`, `selectedQuest`
- Uses `arcsRef` for safe async access to latest arcs state
- All mutation handlers defined with `useCallback` at the top level and passed down as props

**Components (`frontend/src/components/`)**
- `ArcList.tsx` — left panel container; manages arc expansion state, arc creation form, error dismissal
- `ArcCard.tsx` — individual arc with expand/collapse, inline title editing, delete confirmation, and inline quest creation
- `QuestRow.tsx` — single quest item with selection highlighting and delete button
- `QuestDetail.tsx` — right panel; shows selected quest title/description and "Mark as Complete" placeholder
- `icons.tsx` — reusable SVG icons (`PencilIcon`, `TrashIcon`)

**API (`frontend/src/api.ts`)**
- `request()` helper with unified error handling (includes HTTP status + body in errors)
- All API calls convert snake_case responses to camelCase (`RawArc`, `RawQuest` types for the mapping)
- Methods: `fetchArcs`, `createArc`, `updateArc`, `deleteArc`, `createQuest`, `deleteQuest`

**Types (`frontend/src/types.ts`)**
- Uses camelCase (`arcId`, not `arc_id`) throughout

**Patterns to follow**
- `React.memo` on all child components; `useCallback` on all handlers in `App.tsx`
- Separate `mutationError` state (distinct from fetch `error`) for create/update/delete failures
- Error propagation: child catches, re-throws to parent via callback; parent sets `mutationError`
- Accessibility: `<button>` elements (not divs), ARIA labels on all interactive elements, `focus-visible` outlines (`2px solid #4f46e5`), Enter key support on inputs

## Workflow

- For any coding, editing, or fixing tasks → delegate to the `coder` subagent
- When asked to review code → delegate to the `reviewer` subagent
- Never run the reviewer automatically — only when the user explicitly asks

## Code Style

- Python: ruff with `E`, `W`, `F`, `I`, `UP` rules, line length 100, Python 3.12 target, double quotes
- TypeScript: typescript-eslint with react-hooks and react-refresh plugins
