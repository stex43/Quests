# Deploy console

A small CLI that deploys Quests on this machine, driven from this dev repo. A web UI is
planned; the pipeline (`deploy/core.py`) is kept fully separate from the CLI layer
(`deploy/cli.py`) so that UI can be built later without touching the deploy logic itself.

It is pull-based: there are no GitHub Actions runners and no webhooks. You run
`py -m deploy deploy` on this machine whenever you want to ship whatever is currently on
`origin/main`; nothing deploys automatically on push.

## Setup

The first `py -m deploy deploy` run auto-clones the repo into a separate working copy —
by default `~/quests-deploy`. Override the location with the `QUESTS_DEPLOY_HOME`
environment variable, or by writing `{"clone_path": "..."}` to
`deploy/config.local.json` (gitignored).

Before deploying, create two files *inside that clone* (not in this dev repo):

- `backend/.env.docker` — copy from `backend/.env.example` and fill in real credentials.
  The deploy refuses to run without this file.
- `.env` — copy from the repo-root `.env.example`. This is the file `docker compose`
  itself reads (from its working directory) for `${VAR}` interpolation and the project
  name; it is unrelated to `backend/.env.docker`, which is only fed into the containers
  via `env_file:`.

## Why a separate clone

`git fetch` / `git reset --hard origin/main` run against the deploy clone, never against
this dev working copy, so a deploy can never discard your uncommitted work here.

## Running alongside your dev stack

The deploy stack always uses the compose project name `quests-deploy` (passed explicitly
via `-p`, not relied upon from `.env`), and `BACKEND_PORT` / `FRONTEND_PORT` in the
clone's `.env` are yours to set. Point them at ports other than your dev
`docker compose up` stack's and the two can run side by side without port or volume
collisions.

## Usage

Run these from this dev repo's root:

```
py -m deploy deploy   # fetch origin/main, reset the clone to it, build, (re)start, health-check
py -m deploy status    # show the deployed commit and `docker compose ps` for the clone
py -m deploy logs      # print the most recent deploy log
```

## Logging

Each `deploy` run writes a timestamped file under `deploy/logs/` (gitignored) and streams
the same lines to the terminal live. Any value from a `PASSWORD`/`TOKEN`/`SECRET`/`KEY`-named
key in the clone's env files is redacted from the log, plus a regex backstop for the same
names appearing inline (e.g. in a connection string).

On Ctrl+C, the CLI terminates (and if needed kills) the local `docker compose` process,
but this is a best-effort cleanup: killing the local CLI process doesn't guarantee the
Docker daemon aborts an in-progress build/start job server-side.

## Adding a web UI later

`run_deploy()` in `deploy/core.py` is a plain generator of log-line strings with no
knowledge of the CLI or of `print`. A future web layer can import it directly and stream
those lines over SSE or a websocket instead of stdout, reusing `deploy/config.py` for
clone-path and repo-URL resolution.
