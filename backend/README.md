# Quests Backend

The FastAPI backend for Quests.

## Requirements

- Python 3.12 or newer

## Getting started

Create and activate a virtual environment, then install dependencies using `pip`:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

Alternatively, install the dependencies without an editable install:

```bash
pip install -r requirements.txt
```

## Running the development server

Use `uvicorn` to run the API locally:

```bash
uvicorn src.main:app --reload
```

Visit <http://localhost:8000/health> for a liveness check.

Interactive API documentation is available at <http://localhost:8000/docs>.

## Running with Docker Compose

Build and start the backend service using Docker Compose:

```bash
docker compose up --build
```

Once it is up, the interactive API documentation is at <http://localhost:8000/docs>, and <http://localhost:8000/health> serves as a liveness check.

> **Note:** Compose mounts `backend/src` into the container (`./backend/src:/app/src`), but `uvicorn` runs without `--reload`, so edits are **not** picked up automatically. After changing anything under `backend/src`, restart the service; no rebuild is needed:
>
> ```bash
> docker compose restart backend
> ```
>
> Rebuild (`docker compose up -d --build backend`) only when dependencies, the Dockerfile or Alembic migrations (not mounted) change. For live reload during development, run the server directly instead (`uvicorn src.main:app --reload`) rather than through Docker Compose.
