# sync-main

Update `main`, switch to it, and delete the branch you were working on (locally and on the remote).

**Usage:**
- `/sync-main` — switch to `main`, pull latest, delete the branch you came from (local + remote)
- `/sync-main old-feature-branch` — same, but delete the named branch instead of the current one

The branch to delete (if any) is: $ARGUMENTS

---

## Instructions

Follow these steps precisely. Do not skip any step.

### Step 1 — Determine the working branch to delete

Run `git branch --show-current` and store the result as `<current-branch>`.

- If `$ARGUMENTS` is non-empty, treat the first token as `<working-branch>` (the branch to delete).
- Otherwise, use `<current-branch>` as `<working-branch>`.

If `<working-branch>` is `main`, there is no working branch to delete. Tell the user, still run Step 3 to update `main`, then skip Steps 4–5.

### Step 2 — Check the working branch is safe to delete

Run `gh pr list --head <working-branch> --state all --json number,state,mergedAt` to see the PR status.

- If a PR exists and is **MERGED**, it is safe to delete.
- If a PR exists and is **OPEN** or **CLOSED** (not merged), warn the user that the branch is not merged and ask whether to proceed before continuing.
- If no PR exists, note that; Step 5 uses a safe delete (`-d`) that will refuse to drop unmerged work, so proceed.

### Step 3 — Switch to main and update it

Run:
```
git checkout main
git pull --prune
```
`--prune` also cleans up remote-tracking refs for branches deleted on the remote.

If `git checkout main` fails due to uncommitted changes, stop and tell the user — do not stash or discard anything.

### Step 4 — Skip if nothing to delete

If `<working-branch>` is `main` (from Step 1), skip Step 5.

### Step 5 — Delete the working branch

Run:
```
git branch -d <working-branch>
```

- If it succeeds, done.
- If it fails because the branch is not fully merged into `main`, report git's message and ask the user whether to force-delete with `git branch -D <working-branch>`. Do NOT force-delete without explicit confirmation.

### Step 6 — Delete the remote branch

Check whether the remote branch still exists:
```
git ls-remote --heads origin <working-branch>
```

If it exists, delete it:
```
git push origin --delete <working-branch>
```

Only delete the remote branch when it is safe:
- The PR was **MERGED** (Step 2), or
- the safe local delete in Step 5 succeeded (which means git confirmed it was merged).

If the branch was **not** merged, do NOT delete the remote branch without explicit user confirmation. If the remote branch does not exist (already deleted, e.g. by GitHub on merge), note that and move on.

### Step 7 — Report

Tell the user:
- which commit `main` is now at (`git log -1 --oneline`),
- that the working branch was deleted locally (or why it wasn't),
- that the remote branch was deleted (or why it wasn't).
