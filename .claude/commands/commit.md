# commit

Stage all changes and commit locally (no push, no PR).

**Usage:**
- `/commit` — include all changes
- `/commit backend/.env frontend/src/api.ts` — exclude specific files or folders

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

### Step 4 — Derive commit message

From the diff, produce:
- **Commit message**: imperative sentence, max 72 characters (e.g. `Add TypeScript API client and shared types`).

### Step 5 — Stage changes

If there are **no exclusions**, run:
```
git add -A
```

If there are **exclusions**, run `git add -A` first, then unstage each excluded pattern:
```
git restore --staged <pattern>
```
Run `git status --short` again. If nothing is staged, warn the user and ask whether to proceed or stop.

### Step 6 — Commit

Run:
```
git commit -m "<commit message>"
```

### Step 7 — Report

Tell the user the commit was created successfully and print the commit message.
