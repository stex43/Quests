---
name: project_lan_serving
description: Quests is served from a laptop to LAN devices whose IP changes; CORS is intentionally LAN-wide, a LanRequestGuard middleware covers CSRF/rebinding; settled decisions not to re-raise
type: project
---

The app is served from the user's laptop to other devices on the LAN, and the laptop's IP changes. The frontend therefore takes the API host from `window.location` at runtime, and the backend CORS default is a LAN-only `allow_origin_regex` (loopback, RFC 1918, *.local). A pure-ASGI `LanRequestGuard` (`backend/src/middleware.py`) checks Host (400 `invalid_host`) and the Origin of unsafe methods (403 `forbidden_origin`), reusing the CORS settings. Shipped in PR #20 (branch `lan-runtime-backend-url`), verified from a phone on 2026-09-20.

**Why:** A backend URL baked in at build time broke whenever the Wi-Fi IP changed (change reviewed 2026-09-16). The guard was added to close simple-request CSRF and DNS rebinding raised in that review.

**How to apply:**
- Don't flag the CORS rule for accepting any LAN origin. That is the goal, and the API has no auth and listens on 0.0.0.0 anyway.
- The user decided NOT to add `.lan` / `.home.arpa` hosts. Don't re-raise that.
- Watch that the guard's origin check stays in step with Starlette's `CORSMiddleware.is_allowed_origin`.
- Settings in `backend/.env.docker` reach the app through compose `env_file` parsing, since the Dockerfile does not copy that file. Regex-valued vars must be single-quoted there.

**Resolved — do not re-raise:**
- Same-origin writes (e.g. /docs "Try it out") when `CORS_ORIGIN_REGEX` is empty: `_is_same_origin` now accepts an Origin whose scheme and host[:port] equal the request's already-validated Host.
- TestClient's default Host `testserver` getting 400: `CLAUDE.md` records the convention — tests construct `TestClient(app, base_url="http://localhost")`, or set `ALLOWED_HOST_REGEX=` before importing `src.main` (the regex is captured at import time).

**Still open, deliberately:**
- `CORS_ORIGINS=["*"]` is treated literally by the guard while `CORSMiddleware` reads it as allow-all. The user was told and left it; only worth raising if someone actually sets `*`.
- Postgres is still published LAN-wide (`5432:5432`, `quests/quests`). Pre-existing, out of scope for PR #20, fix is `127.0.0.1:5432:5432`.
- Non-issues by design: `Host: 0.0.0.0` or a trailing-dot host gets 400; a compose service name like `backend:8000` would too, but nothing calls that way.
