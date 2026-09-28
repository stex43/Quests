import re
import subprocess
import time
import urllib.request
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from urllib.error import URLError

from deploy import config

_SECRET_NAME_RE = re.compile(r"password|token|secret", re.IGNORECASE)
_SECRET_INLINE_RE = re.compile(r"(?i)\b(password|token|secret)(\s*[:=]\s*)\S+")


class DeploymentFailed(Exception):
    """A pipeline step failed; the reason was already logged as a yielded line."""


def run_deploy(clone_path: Path) -> Iterator[str]:
    start = time.monotonic()
    outcome = "FAIL"
    try:
        yield f"=== quests deploy :: {datetime.now().isoformat(timespec='seconds')} ==="
        yield from _ensure_clone(clone_path)

        secrets = collect_secrets(clone_path)

        yield "--- fetching origin/main ---"
        yield from _run(["git", "fetch", "origin", "main"], clone_path, secrets)
        yield from _run(["git", "reset", "--hard", "origin/main"], clone_path, secrets)

        sha, message = _head_info(clone_path)
        yield f"Commit: {sha}  {message}"

        env_docker = clone_path / "backend" / ".env.docker"
        if not env_docker.exists():
            yield (
                f"FAIL: {env_docker} not found. Copy backend/.env.example to "
                f"{env_docker} in the deploy clone and fill in real credentials."
            )
            raise DeploymentFailed("missing backend/.env.docker")

        yield "--- docker compose build ---"
        yield from _run(_compose_cmd("build"), clone_path, secrets)

        yield "--- docker compose up -d ---"
        yield from _run(_compose_cmd("up", "-d"), clone_path, secrets)

        yield "--- health check ---"
        port = _read_backend_port(clone_path)
        yield from _wait_for_health(port)

        outcome = "PASS"
    except KeyboardInterrupt:
        outcome = "ABORTED"
        raise
    finally:
        # Exceptions propagate past this finally so the CLI layer can set the exit code;
        # the summary line is guaranteed to be the last thing yielded either way.
        duration = time.monotonic() - start
        yield f"=== DEPLOY {outcome} in {duration:.1f}s ==="


def _compose_cmd(*args: str) -> list[str]:
    # -f docker-compose.yml is explicit so a bare `docker compose` never auto-loads
    # docker-compose.override.yml (that only happens with no -f at all).
    return ["docker", "compose", "-p", config.COMPOSE_PROJECT_NAME, "-f", "docker-compose.yml", *args]


def _stream_process(cmd: list[str], cwd: Path) -> Iterator[str]:
    proc = subprocess.Popen(cmd, cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    try:
        assert proc.stdout is not None
        for line in proc.stdout:
            yield line.rstrip("\n")
    finally:
        if proc.poll() is None:
            proc.terminate()

    proc.wait()
    if proc.returncode != 0:
        raise subprocess.CalledProcessError(proc.returncode, cmd)


def _run(cmd: list[str], cwd: Path, secrets: set[str]) -> Iterator[str]:
    for line in _stream_process(cmd, cwd):
        yield redact(line, secrets)


def _ensure_clone(clone_path: Path) -> Iterator[str]:
    if (clone_path / ".git").exists():
        yield f"Using existing deploy clone at {clone_path}"
        return

    clone_path.parent.mkdir(parents=True, exist_ok=True)
    yield f"Cloning {config.get_repo_url()} into {clone_path}"
    yield from _run(["git", "clone", config.get_repo_url(), str(clone_path)], clone_path.parent, set())


def _head_info(clone_path: Path) -> tuple[str, str]:
    result = subprocess.run(
        ["git", "log", "-1", "--format=%h %s"], cwd=clone_path, capture_output=True, text=True, check=True
    )
    sha, _, message = result.stdout.strip().partition(" ")
    return sha, message


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip("'\"")
    return values


def collect_secrets(clone_path: Path) -> set[str]:
    secrets: set[str] = set()
    for env_path in (clone_path / "backend" / ".env.docker", clone_path / ".env"):
        for key, value in _parse_env_file(env_path).items():
            if value and _SECRET_NAME_RE.search(key):
                secrets.add(value)
    return secrets


def redact(line: str, secrets: set[str]) -> str:
    for secret in secrets:
        line = line.replace(secret, "***REDACTED***")
    return _SECRET_INLINE_RE.sub(r"\1\2***REDACTED***", line)


def _read_backend_port(clone_path: Path) -> int:
    return int(_parse_env_file(clone_path / ".env").get("BACKEND_PORT", "8000"))


def _wait_for_health(port: int, timeout: float = 60.0, interval: float = 2.0) -> Iterator[str]:
    url = f"http://127.0.0.1:{port}/health"
    start = time.monotonic()
    attempt = 0
    while True:
        attempt += 1
        yield f"Waiting for {url} ... (attempt {attempt})"
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status == 200:
                    yield f"Health check passed: {url}"
                    return
        except (URLError, TimeoutError, OSError):
            pass

        if time.monotonic() - start > timeout:
            yield f"FAIL: health check timed out waiting for {url}"
            raise DeploymentFailed("health check timed out")

        time.sleep(interval)


def get_status(clone_path: Path) -> list[str]:
    if not (clone_path / ".git").exists():
        return [f"No deploy clone found at {clone_path}. Run `py -m deploy deploy` first."]

    sha, message = _head_info(clone_path)
    result = subprocess.run(_compose_cmd("ps"), cwd=clone_path, capture_output=True, text=True)
    ps_lines = result.stdout.rstrip().splitlines()
    return [f"Deployed commit: {sha}  {message}", *ps_lines]
