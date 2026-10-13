# remember

Review the current conversation and write anything worth keeping to memory — independent of committing or pushing anything.

**Usage:**
- `/remember` — review the whole conversation so far

---

## Instructions

Follow these steps precisely. Do not skip any step.

### Step 1 — Review the conversation

Review the whole conversation so far (not just the most recent message or diff) for important findings and new things worth keeping for future sessions:
- **feedback** — corrections or confirmed approaches from the user, with the reason
- **project** — gotchas, invariants, tooling quirks, or constraints discovered while working (convert relative dates to absolute)
- **user** — new facts about the user's role, expertise, or preferences
- **reference** — external resources (URLs, project ids, dashboards) that came up

Skip anything the repo already records (code structure, CLAUDE.md, git history) and anything that only mattered to this conversation. Do not write anything about security posture, vulnerabilities, or exploit details.

### Step 2 — Update memory

For each finding:
1. Check the memory directory for an existing file that covers it. If one does, update it instead of creating a duplicate. If an existing memory turned out to be wrong, fix or delete it.
2. Otherwise write a new file in the memory directory using the standard memory frontmatter (`name`, `description`, `metadata.type`), with **Why:** and **How to apply:** lines for feedback/project memories, and `[[name]]` links to related memories.
3. Add or update the one-line pointer in `MEMORY.md` (`- [Title](file.md) — hook`). Remove the pointer for any deleted memory.

If nothing new was learned, tell the user and stop — do not write anything.

### Step 3 — Report

List the memories that were added, updated, or deleted (one line each, naming the file and what changed).
