# Agent Memory Index

## Project
- [project_codebase_patterns.md](project_codebase_patterns.md) — Key backend patterns, known pre-existing gaps (async, UUID type mismatch, missing from_attributes, no arc_id FK validation), and dev-stage signals in the Quests codebase
- [project_conventions.md](project_conventions.md) — Established backend conventions for the Quests FastAPI project (repository patterns, status codes, schema rules, lazy="raise" gotchas)
- [project_exception_handling.md](project_exception_handling.md) — Domain-exception + centralized HTTP translation layer conventions (DomainError hierarchy, handler status map, ErrorResponse shape, no HTTPException in routers)
- [project_frontend_patterns.md](project_frontend_patterns.md) — Established frontend conventions for the Quests React/TypeScript project (memo, useCallback, error states, arcsRef, API layer, accessibility)

## Feedback
- [feedback_focus_review_scope.md](feedback_focus_review_scope.md) — Settled focus-indicator decisions not to re-raise, and the user's preference for findings that clicking cannot surface
