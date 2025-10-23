# Quests Backend

A minimal FastAPI project skeleton that exposes a friendly greeting.

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
uvicorn app.main:app --reload
```

Visit <http://localhost:8000/> to see the "Hello world" response.

Interactive API documentation is available at <http://localhost:8000/docs>.

## Running with Docker Compose

Build and start the backend service using Docker Compose:

```bash
docker compose up --build
```

The API will be available at <http://localhost:8000/>. Code changes in `backend/app` are mounted into the container, so the auto-reload server will pick them up without rebuilding the image.
