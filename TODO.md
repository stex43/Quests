# TODO

## Backend

- **[High]** `POST /arcs` returns `schemas.Arc` (no `quests` field); `GET /arcs` returns `schemas.ArcExtended` (with `quests`). Change `POST /arcs` to return `ArcExtended` so the frontend can splice a newly created arc into state without a follow-up re-fetch.
