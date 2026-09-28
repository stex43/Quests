import json
import os
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEPLOY_DIR = REPO_ROOT / "deploy"
LOGS_DIR = DEPLOY_DIR / "logs"
LOCAL_CONFIG_PATH = DEPLOY_DIR / "config.local.json"

COMPOSE_PROJECT_NAME = "quests-deploy"

_SSH_URL_RE = re.compile(r"^git@github\.com:(?P<owner>[^/]+)/(?P<repo>.+?)(\.git)?$")


def get_clone_path() -> Path:
    env_value = os.environ.get("QUESTS_DEPLOY_HOME")
    if env_value:
        return Path(env_value).expanduser().resolve()

    if LOCAL_CONFIG_PATH.exists():
        data = json.loads(LOCAL_CONFIG_PATH.read_text(encoding="utf-8"))
        clone_path = data.get("clone_path")
        if clone_path:
            return Path(clone_path).expanduser().resolve()

    return (Path.home() / "quests-deploy").expanduser().resolve()


def get_repo_url() -> str:
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
        check=True,
    )
    url = result.stdout.strip()
    match = _SSH_URL_RE.match(url)
    if match:
        return f"https://github.com/{match.group('owner')}/{match.group('repo')}"
    return url
