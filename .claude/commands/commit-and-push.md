# commit-and-push

Stage all changes, commit to a new branch, and open a GitHub PR to `main`.

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

### Step 3 — Understand what changed

Run `git diff HEAD` to read unstaged changes, and `git diff --cached HEAD` for anything already staged. Read the output to understand what was done. Do not output this diff to the user.

### Step 4 — Derive branch name and commit message

From the diff, produce:
- **Branch name**: 3–5 words in `kebab-case` summarising what was done (e.g. `add-frontend-api-types`, `fix-auth-token-expiry`). Do not use generic names like `update-code` or `changes`.
- **Commit message**: imperative sentence, max 72 characters (e.g. `Add TypeScript API client and shared types`).

If a branch with that name already exists locally or on the remote (`git branch -a`), append `-2`, then `-3`, etc. until the name is free.

### Step 5 — Create the branch

Run:
```
git checkout -b <branch-name>
```

### Step 6 — Stage changes

If there are **no exclusions**, run:
```
git add -A
```

If there are **exclusions**, run `git add -A` first, then unstage each excluded pattern:
```
git restore --staged <pattern>
```
Run `git status --short` again. If nothing is staged, warn the user and ask whether to proceed or stop.

### Step 7 — Commit

Run:
```
git commit -m "<commit message>"
```

### Step 8 — Push

Run:
```
git push -u origin <branch-name>
```

### Step 9 — Open a PR

Run:
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

### Step 10 — Report

Print the PR URL returned by `gh pr create` so the user can open it directly.
