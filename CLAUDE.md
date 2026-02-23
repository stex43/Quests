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

Backend reads env vars from a `.env` file (or `.env.docker` for the Docker service). Required vars:

```
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DB=
```

The `APP_ENV` env var determines which file is loaded: `.env.{APP_ENV}` if set, otherwise `.env`.

## Architecture

### Backend (`backend/src/`)

- `main.py` — FastAPI app, all route handlers, and Pydantic request/response schemas (colocated)
- `models.py` — SQLAlchemy ORM models (`Arc`, `Quest`)
- `database.py` — engine and `get_db` session dependency
- `settings.py` — `pydantic-settings` config; constructs `database_url` from individual Postgres vars

### Data Model

- **Arc**: a story arc with a title and description; has many Quests (cascade delete)
- **Quest**: belongs to an Arc via `arc_id` FK; has title and description

### Migrations

Alembic is configured in `backend/alembic/`. The `env.py` imports `models.Base.metadata` for autogenerate support and pulls the DB URL from `settings`. Run migrations from the `backend/` directory.

### Frontend (`frontend/src/`)

Currently a Vite + React scaffold. `App.tsx` is the entry component.

## Code Style

- Python: ruff with `E`, `W`, `F`, `I`, `UP` rules, line length 100, Python 3.12 target, double quotes
- TypeScript: typescript-eslint with react-hooks and react-refresh plugins
