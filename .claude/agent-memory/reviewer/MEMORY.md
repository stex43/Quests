# Agent Memory Index

## Project
- [project_codebase_patterns.md](project_codebase_patterns.md) — Key backend patterns (transactions, quest completion, created_at list ordering), known open gaps, and what the 2026-09-28 full review fixed vs left open, and dev-stage signals in the Quests codebase
- [project_conventions.md](project_conventions.md) — Established backend conventions for the Quests FastAPI project (repository patterns, status codes, schema rules, lazy="raise" gotchas)
- [project_exception_handling.md](project_exception_handling.md) — Domain-exception + centralized HTTP translation layer conventions (DomainError hierarchy, handler status map, ErrorResponse shape, no HTTPException in routers, 500s via UnhandledErrorMiddleware)
- [project_frontend_patterns.md](project_frontend_patterns.md) — Established frontend conventions for the Quests React/TypeScript project (memo, useCallback, error states, API layer, accessibility, arc delete confirmation + focus after delete) + responsive/CSS review checks (vw-in-font-size vs 1.4.4, fixed grid-track mins vs 1.4.10, panel overflow behaviour, layout tokens)
- [project_lan_serving.md](project_lan_serving.md) — App is served to local-network devices from a host whose IP can change; LAN-wide CORS is intended, LanRequestGuard covers CSRF/rebinding; settled decisions (exposure model, no .lan), what the re-review resolved, and what stays open on purpose
- [project_deploy_console.md](project_deploy_console.md) — The sole deploy mechanism since 2026-09-28: manually-invoked `py -m deploy` CLI (`deploy/` package, PR #23), its invariants, round-1 review gaps to check for regression, and the fixed `_stream_process` race
- [project_tooling.md](project_tooling.md) — `tsc -b` typecheck (plain `tsc --noEmit` checks nothing here), pre-commit re-staging/partial-staging rules, husky `prepare` side effect, and why this memory is tracked in the repo

## Feedback
- [feedback_focus_review_scope.md](feedback_focus_review_scope.md) — Settled focus-indicator decisions not to re-raise, and the user's preference for findings that clicking cannot surface
