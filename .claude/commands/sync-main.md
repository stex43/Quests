# sync-main

Update `main`, switch to it, and delete the branch you were working on (locally and on the remote).

**Usage:**
- `/sync-main` — switch to `main`, pull latest, delete the branch you came from (local + remote)
- `/sync-main old-feature-branch` — same, but delete the named branch instead of the current one

After the cleanup it offers to ship `main` to the laptop by pushing a signed `deploy-*` tag. It always asks, and never tags unless you say yes.

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

### Step 7 — Offer to ship `main` to the laptop

The laptop deploys a signed `deploy-*` tag, not a merge to `main`. Merging alone ships nothing, so ask here — once, and never without an explicit yes.

**1. Fetch tags.** `git pull --prune` in Step 3 prunes branches, not tags, and does not reliably fetch every tag. Without this the name derived below can collide with one that exists only on the remote:
```
git fetch --tags origin
```

**2. Check that tag signing is configured:**
```
git config --get gpg.format
git config --get user.signingkey
```
If either is empty, **skip this entire step** and tell the user that signing is not configured in this clone, so any tag pushed from here would be refused by the laptop's verification gate. Do not create an unsigned tag.

**3. Derive the tag name.** Base is `deploy-YYYY-MM-DD` for today. If `git tag -l "<base>*"` already contains that name, append `-2`, then `-3`, until one is free.

> Keep this convention identical to the "Ship" action in the deploy menu — if the two drift, a tag made one way collides with a tag made the other on the same day.

**4. Show what would ship and ask.** Run `git log -1 --oneline main`, then print the commit and the proposed tag name and ask whether to push it. **The default is no** — anything other than an explicit yes skips to Step 8.

**5. Create the tag on `main`**, signed. The repo-local git config supplies the key; do not hardcode a key path here, this file is public:
```
git tag -s <tag-name> main -m "Deploy <tag-name>"
```

**6. Verify before pushing**, so a bad signature is caught locally rather than after it is public:
```
git verify-tag <tag-name>
```
If verification fails, delete the local tag with `git tag -d <tag-name>`, report why, and do not push.

**7. Push the tag** (only the tag):
```
git push origin <tag-name>
```

### Step 8 — Report

Tell the user:
- which commit `main` is now at (`git log -1 --oneline`),
- that the working branch was deleted locally (or why it wasn't),
- that the remote branch was deleted (or why it wasn't),
- which deploy tag was pushed — or that shipping was declined or skipped, and why.

If a tag was pushed, add that the laptop picks it up on its next poll, within about five minutes, unless deploys are paused.
