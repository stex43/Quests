import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from deploy import config, core


def _new_log_path() -> Path:
    config.LOGS_DIR.mkdir(parents=True, exist_ok=True)
    return config.LOGS_DIR / f"deploy-{datetime.now():%Y%m%d-%H%M%S}.log"


def _latest_log_path() -> Path | None:
    if not config.LOGS_DIR.exists():
        return None
    logs = sorted(config.LOGS_DIR.glob("deploy-*.log"))
    return logs[-1] if logs else None


def _cmd_deploy() -> int:
    try:
        clone_path = config.get_clone_path()
    except (OSError, ValueError) as e:
        print(f"Could not resolve deploy clone path: {e}")
        return 1

    log_path = _new_log_path()
    exit_code = 0
    with open(log_path, "w", encoding="utf-8") as log_file:

        def emit(line: str) -> None:
            print(line)
            log_file.write(line + "\n")
            log_file.flush()

        try:
            for line in core.run_deploy(clone_path):
                emit(line)
        except KeyboardInterrupt:
            emit("Aborted by user (Ctrl+C).")
            exit_code = 130
        except (core.DeploymentFailed, subprocess.CalledProcessError) as e:
            emit(f"Deploy failed: {e}")
            exit_code = 1
        except Exception as e:
            emit(f"Deploy failed with an unexpected error: {e!r}")
            exit_code = 1

    print(f"Log written to {log_path}")
    return exit_code


def _cmd_status() -> int:
    try:
        clone_path = config.get_clone_path()
        for line in core.get_status(clone_path):
            print(line)
    except Exception as e:
        print(f"Could not get deploy status: {e!r}")
        return 1
    return 0


def _cmd_logs() -> int:
    log_path = _latest_log_path()
    if log_path is None:
        print("No deploy logs yet.")
        return 0
    try:
        print(log_path.read_text(encoding="utf-8"), end="")
    except OSError as e:
        print(f"Could not read log file {log_path}: {e}")
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="py -m deploy")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("deploy")
    subparsers.add_parser("status")
    subparsers.add_parser("logs")

    args = parser.parse_args(argv)
    commands = {"deploy": _cmd_deploy, "status": _cmd_status, "logs": _cmd_logs}
    return commands[args.command]()


if __name__ == "__main__":
    sys.exit(main())
