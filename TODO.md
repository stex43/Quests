# TODO

## Backend

- **[Critical]** Add app-level `IntegrityError` handler in `main.py` — a concurrent arc deletion between the arc-existence check and the `quest_repo.update()` commit in `PATCH /quests/{quest_id}` causes an unhandled 500 with a SQLAlchemy stack trace. Return 409 instead:
  ```python
  from sqlalchemy.exc import IntegrityError

  @app.exception_handler(IntegrityError)
  async def integrity_error_handler(request, exc):
      return JSONResponse(status_code=409, content={"detail": "A database constraint was violated."})
  ```

- **[High]** `POST /arcs` returns `schemas.Arc` (no `quests` field); `GET /arcs` returns `schemas.ArcExtended` (with `quests`). Change `POST /arcs` to return `ArcExtended` so the frontend can splice a newly created arc into state without a follow-up re-fetch.
