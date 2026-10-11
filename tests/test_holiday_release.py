"""Exercise unattended publication against a temporary local Git remote."""

import json
import subprocess
from pathlib import Path

from scripts.holiday_pipeline import release
from scripts.holiday_pipeline.storage import write


def command(folder: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=folder, check=True, capture_output=True, text=True
    ).stdout.strip()


def test_release_pushes_snapshot_manifest_and_files_atomically(
    tmp_path, monkeypatch
) -> None:
    remote = tmp_path / "remote.git"
    project = tmp_path / "project"
    remote.mkdir()
    project.mkdir()
    command(remote, "init", "--bare")
    command(project, "init", "-b", "main")
    command(project, "config", "user.name", "Fixture")
    command(project, "config", "user.email", "fixture@example.invalid")
    command(project, "remote", "add", "origin", str(remote))
    (project / "README.md").write_text("Fixture", encoding="utf-8")
    command(project, "add", "README.md")
    command(project, "commit", "-m", "Fixture baseline")
    command(project, "push", "origin", "main")
    monkeypatch.setattr(release, "ROOT", project)
    monkeypatch.setattr(release, "DATA", project / "data/holidays")
    release.previous_snapshot()  # No delivery branch yet: existing files remain.
    snapshot = {"schema": 1, "records": [{"id": "official-fixture"}]}
    write(project / "data/holidays/automatic.json", snapshot)
    write(project / "public/data/holidays.json", snapshot)
    manifest = {
        "datasets": {"2026:IN": {"url": "/data/holidays/2026/national-abc.json"}}
    }
    write(project / "public/data/holidays/manifest.json", manifest)
    write(project / "public/data/holidays/2026/national-abc.json", {"records": []})
    annual = {"schema": 1, "year": 2026, "rows": [{"date": "2026-01-01"}]}
    write(project / "data/holidays/annual-cache/2026/portal-central.json", annual)
    assert release.release()
    head = command(remote, "rev-parse", "refs/heads/holiday-data")
    assert (
        json.loads(command(remote, "show", f"{head}:data/holidays/automatic.json"))
        == snapshot
    )
    assert (
        json.loads(
            command(remote, "show", f"{head}:public/data/holidays/manifest.json")
        )
        == manifest
    )
    assert command(
        remote, "show", f"{head}:public/data/holidays/2026/national-abc.json"
    )
    assert command(remote, "rev-parse", "main") == command(project, "rev-parse", "HEAD")
    write(project / "data/holidays/automatic.json", {"records": []})
    write(project / "data/holidays/annual-cache/2026/portal-central.json", {})
    release.previous_snapshot()
    assert (
        json.loads((project / "data/holidays/automatic.json").read_text()) == snapshot
    )
    assert read_cache(project) == annual
    command(project, "worktree", "remove", str(project / "output/holiday-release"))
    command(project, "branch", "-D", "holiday-data")
    assert not release.release()
    assert command(remote, "rev-parse", "refs/heads/holiday-data") == head


def read_cache(project: Path) -> dict:
    return json.loads(
        (project / "data/holidays/annual-cache/2026/portal-central.json").read_text()
    )
