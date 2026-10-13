"""Deploy whatever is on origin/main to a separate working copy.

Run `py deploy.py` from this dev repo's root. It clones (or fetches and hard-resets) a
separate copy of this repo at `~/quests-deploy` (override with the `QUESTS_DEPLOY_HOME`
env var), then runs `docker compose up -d --build` there. The clone is kept separate from
this working copy so `git reset --hard` never touches local dev changes.

Before first use, create `backend/.env.docker` inside the clone (copy it from
`backend/.env.example` and fill in real credentials) — the deploy refuses to run without it.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
SSH_URL_RE = re.compile(r"^(?:ssh://)?git@github\.com[:/](?P<owner>[^/]+)/(?P<repo>.+?)(\.git)?/?$")

clone_path = Path(os.environ.get("QUESTS_DEPLOY_HOME", "~/quests-deploy")).expanduser().resolve()

url = subprocess.run(
    ["git", "remote", "get-url", "origin"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
).stdout.strip()
match = SSH_URL_RE.match(url)
repo_url = f"https://github.com/{match.group('owner')}/{match.group('repo')}" if match else url

git_dir = clone_path / ".git"
if not git_dir.exists():
    subprocess.run(["git", "clone", repo_url, str(clone_path)], check=True)
else:
    is_valid = (
        subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"], cwd=clone_path, capture_output=True, text=True
        ).returncode
        == 0
    )
    if not is_valid:
        print(f"FAIL: {clone_path} has a .git directory but is not a valid git repo (likely an interrupted clone).")
        print(f"Delete {clone_path} and rerun this script to start a fresh clone.")
        sys.exit(1)
    subprocess.run(["git", "fetch", "origin", "main"], cwd=clone_path, check=True)
    subprocess.run(["git", "reset", "--hard", "origin/main"], cwd=clone_path, check=True)

env_docker = clone_path / "backend" / ".env.docker"
if not env_docker.exists():
    print(
        f"FAIL: {env_docker} not found. Copy backend/.env.example to {env_docker} "
        "in the deploy clone and fill in real credentials."
    )
    sys.exit(1)

subprocess.run(
    ["docker", "compose", "-p", "quests-deploy", "-f", "docker-compose.yml", "up", "-d", "--build"],
    cwd=clone_path,
    check=True,
)
