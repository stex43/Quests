---
name: project_lan_serving
description: Quests is served from a laptop to LAN devices whose IP changes; CORS is intentionally LAN-wide, a LanRequestGuard middleware covers CSRF/rebinding; settled decisions not to re-raise
type: project
---

The app is served from the user's laptop to other devices on the LAN, and the laptop's IP changes. The frontend therefore takes the API host from `window.location` at runtime, and the backend CORS default is a LAN-only `allow_origin_regex` (loopback, RFC 1918, *.local). Since 2026-09-16 a pure-ASGI `LanRequestGuard` checks Host (400) and the Origin of unsafe methods (403), reusing the CORS settings.

**Why:** A backend URL baked in at build time broke whenever the Wi-Fi IP changed (change reviewed 2026-09-16). The guard was added to close simple-request CSRF and DNS rebinding raised in that review.

**How to apply:**
- Don't flag the CORS rule for accepting any LAN origin. That is the goal, and the API has no auth and listens on 0.0.0.0 anyway.
- The user decided NOT to add `.lan` / `.home.arpa` hosts. Don't re-raise that.
- Watch that the guard's origin check stays in step with Starlette's `CORSMiddleware.is_allowed_origin`.
- Open points from the 2026-09-16 re-review, to check whether they were resolved:
  - Same-origin writes (e.g. /docs "Try it out") are rejected when `CORS_ORIGIN_REGEX` is empty.
  - TestClient's default Host `testserver` gets 400.
  - `CORS_ORIGINS=["*"]` is treated literally.
- Settings in `backend/.env.docker` reach the app through compose `env_file` parsing, since the Dockerfile does not copy that file.
