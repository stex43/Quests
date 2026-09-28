---
name: project_deploy_console
description: The manual `py -m deploy` CLI (deploy/ package, added PR #23) — its invariants, and the recurring gap shapes found in round-1 review
type: project
---

Since PR #23 (2026-09-28) this is the **sole** deploy mechanism — it replaced the
earlier signed-tag Task Scheduler pipeline outright (retired and torn down the same day).
Do not describe these as "two independent pipelines" in future reviews.

Never propose a self-hosted GitHub Actions runner while the repo is public.

- `deploy/` is a small stdlib-only Python package (`py -m deploy deploy|status|logs`),
  manually invoked by a human on the machine. No scheduler, no webhook, no ref/branch
  argument — it only ever deploys `origin/main`, fetched anonymously over HTTPS into a
  separate clone (default `~/quests-deploy`, override via `QUESTS_DEPLOY_HOME` env var or
  `deploy/config.local.json`).
- Fixed compose project name `quests-deploy` (always passed via `-p`), independently
  configurable `BACKEND_PORT`/`FRONTEND_PORT` in the clone's own root `.env`. It uses
  the standard 8000/5173 ports, but the mechanism (per-clone `.env`, not hardcoded) is
  kept in case a second environment (e.g. staging) is ever wanted.
- The user explicitly chose, after being told the tradeoff, to run with **no signature
  verification** — deploying is human-triggered, so the operator running the command is
  the trust boundary, but unlike the retired pipeline there is no `git verify-tag` gate
  against a compromised push to `main`. This was a knowing, informed decision on
  2026-09-28 (not an oversight) — do not silently re-propose porting the signed-tag gate
  back in without flagging that it was deliberately declined once already; if raised
  again, treat it as "worth revisiting," not as a bug fix.
- `deploy/core.py`'s `run_deploy()` is a generator; `finally: yield <summary line>` while
  an exception is in flight is a deliberate, correct pattern (the yield delays the
  exception by one `next()` call so the CLI gets the summary line before the exception
  propagates) — do not mistake this for a bug on a fresh read.
- Secrets (`backend/.env.docker`, clone-root `.env`) are redacted by both a value-based
  substring pass (`redact()`, from `collect_secrets()`'s key-name scan) and a generic
  `password=`/`token=`-style regex backstop; both regexes now also match `key`
  (`API_KEY`/`PRIVATE_KEY` etc.), fixed same-day as the round-1 finding below.

**Round-1 review (2026-09-28) findings — all fixed same-day, in the same PR:**
1. `cli.py`'s three command functions didn't catch every exception path (a missing
   `git`/`docker`, a malformed `config.local.json`, etc. would escape as a raw
   traceback) — fixed: `_cmd_deploy`/`_cmd_status`/`_cmd_logs` now each have a catch-all.
2. Secret-name regexes missed `key` — fixed (see above).
3. `_parse_env_file` didn't strip inline `# comments`, so `BACKEND_PORT=8000  # note`
   would crash `int()` uncaught — fixed: quoted values now stop at the closing quote,
   unquoted values are split on `" #"`.
4. `_ensure_clone` treated a `.git` dir's mere existence as "already cloned," so a
   Ctrl+C during the *first* clone left a permanently-broken, non-self-healing clone —
   fixed: a new `_is_valid_clone` (`git rev-parse --is-inside-work-tree`) check fails
   clearly instead, pointing at manual deletion.
5. `_stream_process`'s cleanup sent one `terminate()` with no wait/escalation — fixed:
   now waits up to 10s then `kill()`s. Accepted-risk note added to the README: killing
   the local CLI doesn't guarantee the Docker daemon aborts a server-side build/start.
6. Dead code: an unreachable `print_help()`/`return 1` fallback in `cli.py`'s `main()`
   (argparse's `required=True` subparsers already exhaust every case) — removed, dict
   dispatch used instead.
7. The SSH→HTTPS URL rewrite only covered the scp-style shorthand, not `ssh://...` URIs
   — broadened to match both.
8. `get_status()` silently swallowed a failed `docker compose ps` — fixed: reports
   `stderr` on non-zero exit instead of returning a misleadingly-empty status.

**Fixed 2026-09-28 (round 2):** `_stream_process` used to `terminate()` in a `finally`
that also ran on normal completion, before `proc.wait()`, so a successful step could
surface as `CalledProcessError` (-15). It now runs inside `with Popen(...)`, waits inside
the `try`, and only terminates → waits 10s → kills under `except BaseException`.
Still open, pre-existing and minor: `run_deploy`'s `finally: yield` raises "generator
ignored GeneratorExit" when Ctrl+C lands inside the CLI's `emit()`; the child is still
terminated.

A future review of `deploy/` should confirm these stayed fixed rather than re-deriving
them; if any regress, that's worth flagging as a regression, not a fresh finding.

**How to apply:** Don't review this package against the retired pipeline, and don't
flag the missing signature gate as a defect (see above). Do periodically check whether
a "key"-adjacent credential name slips past the current regex coverage as the project's
env files grow.
