---
name: project_deploy_rig
description: How Quests reaches the laptop (pull-based, signed-tag-gated, machinery outside the repo) and the compose dev/prod split; the invariants a review must not break
type: project
---

Since 2026-09-20 Quests deploys pull-based. A Task Scheduler job runs `C:\deploy\deploy.ps1` every 5 minutes; it fetches, takes the newest `deploy-*` tag, runs `git verify-tag` against `C:\deploy\allowed_signers`, and only then checks out and runs `docker compose -p quests-prod -f docker-compose.yml up -d --build --wait`. Pushing to `main` deploys nothing. The machinery (`deploy.ps1`, `setup.md`, `allowed_signers`, the deploy clone) lives in `C:\deploy`, **outside the repo** — it is not visible in a normal diff.

**Why:** `stex43/Quests` is public, and a self-hosted GitHub Actions runner on a public repo lets a fork PR set `runs-on: self-hosted` and execute code on the laptop. Inverting the direction removes GitHub's ability to run anything locally.

**How to apply:**
- Never propose a self-hosted runner for this repo unless it is made private first. That is the settled decision, not an oversight.
- `docker-compose.yml` is the **production** base (no db port published, no source bind mounts, frontend `target: prod` behind nginx). `docker-compose.override.yml` is dev and is auto-loaded by a bare `docker compose up`. The explicit `-f docker-compose.yml` is the only thing that selects prod — flagging a missing `-f` in any compose command is a real finding.
- `VITE_BACKEND_PORT` must exist twice on purpose: a runtime `environment:` entry for the dev Vite server, a build arg for the static prod build. Neither is redundant.
- Deploy-script invariants, each the fix for a confirmed bug — do not "simplify" them away:
  - `Invoke-Native` forces `$ErrorActionPreference='Continue'` around native calls. On PS 5.1, `2>&1` under `Stop` throws on stderr output even at exit 0, and `git verify-tag` writes its success line to stderr.
  - Freshness is compared against `last-deployed.sha`, never `HEAD`: `git reset` runs before the build, so keying off `HEAD` means a failed build never retries.
  - `git clean -xdf` needs `-e /.env` (the root file holding `BACKEND_PORT`); `-x` deletes ignored files. It deliberately does **not** exclude `backend/.env.docker` any more — that file is restored after the clean from a master copy at `C:\deploy\backend.env.docker`, because it used to be tracked and `git reset --hard` onto the commit that untracks it deletes it. The script must create `backend/` before the copy (`git clean -d` removes a directory once it holds no tracked files).
  - `git fetch` needs `--prune-tags`; plain `--prune` only prunes branches.
  - The `C:\deploy\paused` sentinel exists so the dev stack can hold ports 5173/8000 without the self-healing branch racing prod back up.
- Accepted risks — do **not** re-raise, all four are deliberate and documented in `setup.md`:
  - The gate authorises any signed commit, not only ancestors of `origin/main` (hotfix path).
  - Base images stay on floating tags (`postgres:16`, `node:22-alpine`, `python:3.12-slim`, `nginx:alpine`).
  - `docker image prune -f` is daemon-wide, not scoped to the project.
  - Reaching the app by bare hostname 400s because `ALLOWED_HOST_REGEX` is LAN-literals-only; documented rather than fixed in nginx.
- Recurring bug shape in `deploy.ps1`: because `Invoke-Native` runs under `$ErrorActionPreference='Continue'` and merges `2>&1`, every native call returns a **mixed** stream (strings + ErrorRecords) and keys success off a `$LASTEXITCODE` that a failed command *resolution* never updates. Any new parsing of a native command's output, or any new native call, has to filter the stream (`-is [string]`, via `Get-NativeStdout`) and prove the exit code is fresh. `& docker ...` called directly, outside `Invoke-Native`, is the exception to look for.
- Second recurring shape: the **self-heal branch** (taken when `$target -eq $lastDeployed`) is the least-exercised path and quietly depends on things only the deploy branch establishes. It runs `docker compose config --services` and `ps`, so it needs `backend/.env.docker` present in the tree, yet only the deploy branch restores it. Every review of this script should walk the heal branch separately from the deploy branch.
- Each of three fix rounds introduced a new bug **inside the newly added helper**, not in the code it fixed. Review new helpers (`Get-NativeStdout`, `Get-ServingCount`, `Invoke-Native`'s resolution check) harder than the call sites.

Related: [[project_lan_serving]].
