# Agent Memory Index

## Project
- [project_codebase_patterns.md](project_codebase_patterns.md) — Key backend patterns (transactions, quest completion), known open gaps (sync SQLAlchemy, no pagination), and dev-stage signals in the Quests codebase
- [project_conventions.md](project_conventions.md) — Established backend conventions for the Quests FastAPI project (repository patterns, status codes, schema rules, lazy="raise" gotchas)
- [project_exception_handling.md](project_exception_handling.md) — Domain-exception + centralized HTTP translation layer conventions (DomainError hierarchy, handler status map, ErrorResponse shape, no HTTPException in routers)
- [project_frontend_patterns.md](project_frontend_patterns.md) — Established frontend conventions for the Quests React/TypeScript project (memo, useCallback, error states, API layer, accessibility) + responsive/CSS review checks (vw-in-font-size vs 1.4.4, fixed grid-track mins vs 1.4.10, panel overflow behaviour, layout tokens)
- [project_lan_serving.md](project_lan_serving.md) — App is served to LAN devices from a laptop whose IP changes; LAN-wide CORS is intended, LanRequestGuard covers CSRF/rebinding; settled decisions (no .lan), what the re-review resolved, and what stays open on purpose
- [project_deploy_console.md](project_deploy_console.md) — The sole deploy mechanism since 2026-09-28: manually-invoked `py -m deploy` CLI (`deploy/` package, PR #23), its invariants, and round-1 review gaps (all fixed same-day) to check for regression

## Feedback
- [feedback_focus_review_scope.md](feedback_focus_review_scope.md) — Settled focus-indicator decisions not to re-raise, and the user's preference for findings that clicking cannot surface
