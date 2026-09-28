---
name: project_tooling
description: Frontend typecheck, pre-commit hook behaviour, and how this agent-memory directory is shared — checks to keep from regressing
type: project
---

- `npm run typecheck` is `tsc -b` (fixed 2026-09-28). `frontend/tsconfig.json` is solution-style (`"files": []` + `references`), so plain `tsc --noEmit` type-checks **nothing** and always passes — that was the state of CI and the hook before. Flag any change back to `tsc --noEmit` or any new tsconfig that isn't referenced. Both leaf configs set `noEmit` and keep `tsBuildInfoFile` under `node_modules/.tmp`, so `tsc -b` writes nothing into the repo.
- `.husky/pre-commit` (POSIX sh, run by husky 9 under `sh -e`): computes each section's staged files up front (`--diff-filter=ACMR`), refuses with exit 1 if any are partially staged (it would otherwise commit their unstaged hunks), then formats and re-stages only those files. It used to `git add -u`, which swept unrelated unstaged edits into the commit — flag any return of that. The ruff path `.venv/Scripts/ruff` is Windows-only on purpose (the user develops on Windows).
- `npm ci`/`npm install` in `frontend/` runs the `prepare` script, which sets `core.hooksPath` and creates `.husky/_`. In a throwaway or cloud checkout without the Windows venv, the hook then fails every commit — unset it there.
- This memory directory is committed to the **public** repo on purpose: the user works on two machines and wants the memory shared (decided 2026-09-28, after briefly untracking it). Keep it to decisions and conventions — no secrets, personal details, absolute local paths or descriptions of the user's machines/network (`.claude/agents/reviewer.md` says the same).

**How to apply:** Check these on any review touching `package.json` scripts, tsconfig files, `.husky/`, `.gitignore` or this directory.
