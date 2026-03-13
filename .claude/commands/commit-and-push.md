# commit-and-push

Stage all changes, commit, and open a GitHub PR to `main`.

**Usage:**
- `/commit-and-push` — include all changes
- `/commit-and-push backend/.env frontend/src/api.ts` — exclude specific files or folders

Exclusion patterns (if any) are: $ARGUMENTS

---

## Instructions

Follow these steps precisely. Do not skip any step.

### Step 1 — Check for changes

Run `git status --short`. If the output is empty, tell the user there is nothing to commit and stop.

### Step 2 — Parse exclusions

If `$ARGUMENTS` is non-empty, treat it as a space-separated list of file/folder patterns to exclude from staging. Store them as the exclusion list.

### Step 3 — Detect current branch

Run `git branch --show-current` and store the result as `<current-branch>`.

### Step 4 — Understand what changed

Run `git diff HEAD` to read unstaged changes, and `git diff --cached HEAD` for anything already staged. Read the output to understand what was done. Do not output this diff to the user.

### Step 5 — Derive commit message (and branch name if on main)

From the diff, produce:
- **Commit message**: imperative sentence, max 72 characters (e.g. `Add TypeScript API client and shared types`).

If `<current-branch>` is `main`, also derive:
- **Branch name**: 3–5 words in `kebab-case` summarising what was done (e.g. `add-frontend-api-types`, `fix-auth-token-expiry`). Do not use generic names like `update-code` or `changes`.
- If a branch with that name already exists locally or on the remote (`git branch -a`), append `-2`, then `-3`, etc. until the name is free.

### Step 6 — Create branch (only if on main)

If `<current-branch>` is `main`, run:
```
git checkout -b <branch-name>
```

If `<current-branch>` is not `main`, skip this step and use `<current-branch>` as the branch name going forward.

### Step 7 — Stage changes

If there are **no exclusions**, run:
```
git add -A
```

If there are **exclusions**, run `git add -A` first, then unstage each excluded pattern:
```
git restore --staged <pattern>
```
Run `git status --short` again. If nothing is staged, warn the user and ask whether to proceed or stop.

### Step 8 — Commit

Run:
```
git commit -m "<commit message>"
```

### Step 9 — Push

Check whether the remote branch exists:
```
git ls-remote --exit-code origin <branch-name>
```

- **If the remote branch exists** (exit code 0): run `git push`
- **If the remote branch does not exist** (non-zero exit code): run `git push -u origin <branch-name>`

### Step 10 — Open a PR

Check whether a PR already exists for this branch:
```
gh pr view --json url 2>/dev/null
```

- **If a PR already exists**: skip `gh pr create` and report the existing PR URL to the user.
- **If no PR exists**: run:

```
gh pr create \
  --title "<commit message>" \
  --body "$(cat <<'EOF'
## Summary

<bullet list of what changed, derived from the diff>

## Excluded from this PR

<list excluded patterns, or "None" if no exclusions>

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)" \
  --base main
```

### Step 11 — Report

Print the PR URL so the user can open it directly.
