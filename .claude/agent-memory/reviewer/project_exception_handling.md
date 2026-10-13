---
name: project_exception_handling
description: Domain-exception + centralized HTTP translation layer conventions for the Quests backend
type: project
---

Backend uses a domain-exception layer with centralized HTTP translation (introduced ~2026-07):

- `src/exceptions.py`: `DomainError(Exception)` base carries `message` + optional `details` dict, plus class attributes `status_code = 400`/`error = "domain_error"`. Subclasses: `NotFoundError(entity, entity_id)` (auto-builds message + details `{"entity", "id"}` with id stringified; `status_code=404`/`error="not_found"`), `ConflictError(message)` (`status_code=409`/`error="conflict"`), `DomainValidationError(message)` (renamed from `ValidationError` ~2026-07 to avoid confusion with FastAPI/pydantic `ValidationError`; only overrides `error="validation_error"`, inherits the base's 400).
- **Collapsed to one handler (2026-10-13):** `src/exception_handlers.py` has a single `domain_error_handler(request, exc: DomainError)` that reads `exc.status_code`/`exc.error`/`exc.message`/`exc.details` off whatever subclass instance it receives — no more one-handler-per-subclass. `main.py` registers only `app.add_exception_handler(DomainError, ...)` (plus `RequestValidationError` separately, still 400/"validation_error"). Verified this produces byte-identical status/body shape to the old four-handler version. If a new `DomainError` subclass is added, it only needs the two class attributes — don't re-add a per-subclass handler function.
- `ErrorResponse` schema (schemas.py): `error: str`, `message: str`, `details: dict | None = None`.
- Handlers registered in main.py via `app.add_exception_handler(...)` for the domain exceptions and `RequestValidationError`. Unhandled exceptions are NOT a handler: `UnhandledErrorMiddleware` (`middleware.py`, innermost, inside CORS) turns them into 500 `internal_error` so the response keeps CORS headers and is logged once via `uvicorn.error` (since 2026-09-28).
- Routers raise domain exceptions, NEVER `HTTPException`. No HTTP knowledge in repositories.
- Conflict flow: `db.rollback()` then `raise ConflictError(...)` inside `except IntegrityError`.

**Why:** Deliberate design to keep HTTP concerns out of routers/repos and unify error response shape. Domain ValidationError intentionally maps to 400 (not 422) to preserve API contract.

**How to apply:** Flag any router raising `HTTPException` directly, any repo importing HTTP/exception-handler code, any error response not using the `ErrorResponse` shape, and any handler that leaks internals in the 500 path.

**Known-harmless subtlety:** `get_db` has `except Exception: db.rollback(); raise`. When a route already calls `db.rollback()` before raising ConflictError, `get_db` rolls back again — a no-op on a clean session, not a bug.
