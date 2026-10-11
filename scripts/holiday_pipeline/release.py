"""Publish automatic datasets to the public delivery branch using Actions auth."""

import argparse
import shutil
import subprocess
from pathlib import Path

from .storage import DATA, ROOT

BRANCH = "holiday-data"


def git(
    *args: str, cwd: Path = ROOT, check: bool = True
) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=cwd, check=check, capture_output=True, text=True
    )


def previous_snapshot() -> None:
    """Retain the last automatic records and immutable datasets between runs."""
    result = git(
        "fetch", "origin", f"{BRANCH}:refs/remotes/origin/{BRANCH}", check=False
    )
    if result.returncode:
        return
    snapshot = git("show", f"origin/{BRANCH}:data/holidays/automatic.json", check=False)
    if snapshot.returncode == 0:
        (DATA / "automatic.json").write_text(
            snapshot.stdout, encoding="utf-8", newline="\n"
        )
    listing = git(
        "ls-tree", "-r", "--name-only", f"origin/{BRANCH}", "public/data/holidays"
    )
    for name in listing.stdout.splitlines():
        if name.endswith(".json") and name != "public/data/holidays/manifest.json":
            target = ROOT / name
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(
                    git("show", f"origin/{BRANCH}:{name}").stdout,
                    encoding="utf-8",
                    newline="\n",
                )


def release() -> bool:
    """One atomic Git push exposes the manifest and all referenced datasets."""
    folder = ROOT / "output/holiday-release"
    if folder.exists():
        raise ValueError("Release worktree already exists; use a clean runner")
    exists = (
        git(
            "show-ref", "--verify", f"refs/remotes/origin/{BRANCH}", check=False
        ).returncode
        == 0
    )
    git(
        "worktree",
        "add",
        "--detach",
        str(folder),
        f"origin/{BRANCH}" if exists else "HEAD",
    )
    git("switch", "-c", BRANCH, cwd=folder)
    for path in ["data/holidays/automatic.json", "public/data/holidays.json"]:
        target = folder / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / path, target)
    shutil.copytree(
        ROOT / "public/data/holidays",
        folder / "public/data/holidays",
        dirs_exist_ok=True,
    )
    git("config", "user.name", "BookDay holiday automation", cwd=folder)
    git(
        "config",
        "user.email",
        "41898282+github-actions[bot]@users.noreply.github.com",
        cwd=folder,
    )
    git(
        "add",
        "data/holidays/automatic.json",
        "public/data/holidays",
        "public/data/holidays.json",
        cwd=folder,
    )
    if git("diff", "--cached", "--quiet", cwd=folder, check=False).returncode == 0:
        return False
    git("commit", "-m", "Publish automatically validated holiday data", cwd=folder)
    git("push", "origin", f"HEAD:refs/heads/{BRANCH}", cwd=folder)
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["restore", "publish"])
    args = parser.parse_args()
    if args.operation == "restore":
        previous_snapshot()
    else:
        print(
            "Published automatic holiday data"
            if release()
            else "Holiday data unchanged"
        )
