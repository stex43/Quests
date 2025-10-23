"""Entry point for the Quests FastAPI application."""

from fastapi import FastAPI

app = FastAPI(title="Quests Backend")


@app.get("/", summary="Health check", tags=["Health"])
async def read_root() -> dict[str, str]:
    """Return a simple greeting."""
    return {"message": "Hello world"}


@app.get("/health", summary="API health status", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Endpoint that reports the API is running."""
    return {"status": "ok"}

