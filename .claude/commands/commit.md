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

### Step 7 — Update memory

Review the whole conversation, not only the diff, for important findings and new things worth keeping for future sessions:
- **feedback** — corrections or confirmed approaches from the user, with the reason
- **project** — gotchas, invariants, tooling quirks, or constraints discovered while working (convert relative dates to absolute)
- **user** — new facts about the user's role, expertise, or preferences
- **reference** — external resources (URLs, project ids, dashboards) that came up

Skip anything the repo already records (code structure, CLAUDE.md, git history, the fix itself) and anything that only mattered to this conversation.

For each finding:
1. Check the memory directory for an existing file that covers it. If one does, update it instead of creating a duplicate. If an existing memory turned out to be wrong, fix or delete it.
2. Otherwise write a new file in the memory directory using the standard memory frontmatter (`name`, `description`, `metadata.type`), with **Why:** and **How to apply:** lines for feedback/project memories, and `[[name]]` links to related memories.
3. Add or update the one-line pointer in `MEMORY.md` (`- [Title](file.md) — hook`). Remove the pointer for any deleted memory.

If nothing new was learned, write nothing.

### Step 8 — Report

Tell the user the commit was created successfully and print the commit message. Then list the memories that were added, updated, or deleted (one line each), or say that no memory changes were needed.
