---
name: project_exception_handling
description: Domain-exception + centralized HTTP translation layer conventions for the Quests backend
type: project
---

Backend uses a domain-exception layer with centralized HTTP translation (introduced ~2026-07):

- `src/exceptions.py`: `DomainError(Exception)` base carries `message` + optional `details` dict. Subclasses: `NotFoundError(entity, entity_id)` (auto-builds message + details `{"entity", "id"}` with id stringified), `ConflictError(message)`, `DomainValidationError(message)` (renamed from `ValidationError` ~2026-07 to avoid confusion with FastAPI/pydantic `ValidationError`).
- `src/exception_handlers.py`: async handlers return `JSONResponse(status_code=..., content=ErrorResponse(...).model_dump())`. Status map: DomainError base fallback=400/"domain_error", NotFound=404/"not_found", Conflict=409/"conflict", DomainValidationError=400/"validation_error", RequestValidationError=400/"validation_error", base Exception=500/"internal_error". Starlette dispatches by exact-then-MRO lookup, so subclass handlers take precedence over the base DomainError fallback regardless of registration order.
- `ErrorResponse` schema (schemas.py): `error: str`, `message: str`, `details: dict | None = None`.
- Handlers registered in main.py via `app.add_exception_handler(...)`, including `add_exception_handler(Exception, ...)`.
- Routers raise domain exceptions, NEVER `HTTPException`. No HTTP knowledge in repositories.
- Conflict flow: `db.rollback()` then `raise ConflictError(...)` inside `except IntegrityError`.

**Why:** Deliberate design to keep HTTP concerns out of routers/repos and unify error response shape. Domain ValidationError intentionally maps to 400 (not 422) to preserve API contract.

**How to apply:** Flag any router raising `HTTPException` directly, any repo importing HTTP/exception-handler code, any error response not using the `ErrorResponse` shape, and any handler that leaks internals in the 500 path.

**Known-harmless subtlety:** `get_db` has `except Exception: db.rollback(); raise`. When a route already calls `db.rollback()` before raising ConflictError, `get_db` rolls back again — a no-op on a clean session, not a bug.
