"""Canonical JSON helpers shared by every baseline capture generator.

Not a `server/polarrecorder/**/*.py` module: lives under `tools/`, which is dev-CLI-only
and exempt from the runtime module-header/mypy-strict/ruff rules (see pyproject.toml
`extend-exclude`). Kept dependency-free (stdlib only) so generators run with no venv.

A "canonical" capture is: UTF-8 JSON, keys sorted recursively, 2-space indent, a single
trailing newline, and no floats formatted with locale- or platform-dependent precision
(callers must pre-round numeric metrics before handing them to `dumps_canonical`). This
is what makes two runs of the same generator, on the same Git blobs, byte-identical
regardless of dict insertion order or wall-clock/host metadata.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def dumps_canonical(data: object) -> str:
    """Serialize data as canonical, byte-stable JSON.

    Args:
        data: A JSON-serializable structure. Lists are serialized in the order given,
            so callers must sort any list whose order is not itself a semantic fact
            (e.g. sort file-path lists before passing them in).

    Returns:
        The canonical JSON text, ending in exactly one newline.
    """
    return json.dumps(data, sort_keys=True, indent=2, ensure_ascii=False) + "\n"


def sha256_text(text: str) -> str:
    """Compute the hex SHA-256 digest of UTF-8 text.

    Args:
        text: The text to digest.

    Returns:
        A lowercase hex-encoded SHA-256 digest.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def git_ls_tree_blobs(commit: str, *paths: str) -> dict[str, str]:
    """List blob SHA-1 identities for every file under the given paths at a commit.

    Args:
        commit: The commit-ish to read the tree from.
        paths: Repository-relative path prefixes (files or directories) to include.

    Returns:
        A mapping of repository-relative path to Git blob SHA-1, covering every regular
        file reachable under the given paths at the given commit.
    """
    output = subprocess.run(  # noqa: S603 -- fixed local git invocation, no untrusted input
        [  # noqa: S607 -- git is expected on PATH
            "git",
            "ls-tree",
            "-r",
            commit,
            "--",
            *paths,
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    blobs: dict[str, str] = {}
    for line in output.splitlines():
        if not line:
            continue
        meta, path = line.split("\t", 1)
        _mode, kind, blob_sha = meta.split(" ")
        if kind == "blob":
            blobs[path] = blob_sha
    return blobs


def git_blob_content(commit: str, path: str) -> str:
    """Read a file's exact committed text at a commit via `git show`.

    Args:
        commit: The commit-ish to read the blob from.
        path: The repository-relative path of the file.

    Returns:
        The file's UTF-8 text content as committed at `commit`.
    """
    return subprocess.run(  # noqa: S603 -- fixed local git invocation, no untrusted input
        ["git", "show", f"{commit}:{path}"],  # noqa: S607 -- git is expected on PATH
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def count_non_empty_lines(text: str) -> int:
    """Count non-empty (post-strip) lines in text, matching the repo's file-size gate.

    Args:
        text: The file text to measure.

    Returns:
        The number of lines whose stripped content is non-empty.
    """
    return sum(1 for line in text.splitlines() if line.strip())
