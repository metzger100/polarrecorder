"""Generate `verified-baseline.json`, the repository's immutable pre-migration capture.

Usage:
    python tools/quality-policy/generate_verified_baseline.py --write   # (re)write the file
    python tools/quality-policy/generate_verified_baseline.py --stdout  # print, do not write

All facts below were verified once, by hand, against a disposable detached worktree at
`CAPTURED_COMMIT`. Tool/environment versions are frozen literal constants here, not
re-probed at generation time: re-detecting live tool versions on every run would make the
capture network- and host-dependent, which is exactly what "immutable" rules out. Only the
Git-derived file inventories are computed from the repository at generation time, and Git
blob identities for a historical commit never change, so regeneration is still
byte-for-byte deterministic.

Dyninstruments policy data (paths, counts, hashes, coverage floors, complexity identities,
test exceptions) is explicitly NOT an input to any fact recorded here.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from canonical_json import dumps_canonical, git_ls_tree_blobs

CAPTURED_COMMIT = "08edef88b0102af6507ef02fd4448f7fd1eaca45"
CAPTURED_TAG = "v1.0.0-beta.7"
OUTPUT_PATH = Path(__file__).resolve().parent / "verified-baseline.json"

# Verified 2026-07-24 in a disposable worktree at CAPTURED_COMMIT plus the live main
# worktree. Frozen; not re-probed at generation time.
TOOL_VERSIONS = {
    "python": "3.14.6",
    "pipBootstrap": "26.1.2",
    "ruff": "0.16.0",
    "mypy": "2.3.0",
    "pytest": "9.1.1",
    "pytestCov": "7.0.0",
    "coveragePy": "7.15.2",
    "node": "26.4.0",
    "npm": "12.0.1",
}

# The developer-Python/bootstrap/lock-generation/platform contract this baseline freezes;
# `tools/quality-policy/developer-python.json` is written from it.
DEVELOPER_PYTHON_CONTRACT = {
    "preferredInterpreter": "python3",
    "environmentOverrideVariable": "POLARRECORDER_PYTHON",
    "supportedVersionRange": ">=3.14,<3.15",
    "rationale": (
        "The verification sandbox is Arch/CachyOS with pacman as the sole package "
        "manager; python 3.14.6-2 is the only Python package available (no pyenv/uv, "
        "no 3.9-3.13 package). mypy 2.3.0 on Python 3.14.6 analyzes the "
        '`target-version = "py39"` Ruff/mypy configuration with no internal error, '
        "which supersedes an earlier mypy-2.1.0-era internal error recorded against this "
        "same configuration. The developer interpreter version is therefore pinned narrowly to what "
        "was actually verified rather than a wider, unverified range; a future clone "
        "with a different available Python must set POLARRECORDER_PYTHON explicitly "
        "and this contract must be re-verified and widened with evidence, not assumed."
    ),
    "pipBootstrapVersion": "26.1.2",
    "lockGenerator": "pip-tools (pip-compile)",
    "supportedPlatforms": ["linux-x86_64"],
}

# `tools/check-all.sh` command graph as it existed at CAPTURED_COMMIT, before the script
# was rewritten into a thin `npm run check:all` wrapper.
OLD_COMMAND_GRAPH_STEPS = [
    "ruff check .",
    "ruff format --check .",
    "mypy server/polarrecorder tests plugin.py --strict",
    "python tools/check-python-compat.py",
    "pytest tests/ --tb=short",
    "pytest tests/ --cov=polarrecorder --cov-branch --cov-fail-under=90",
    "python tools/check-coverage.py",
    "python tools/check-python-filesize.py",
    "python tools/check-py-contracts.py",
    "python tools/check-py-dependencies.py",
    "python tools/check-duplication.py",
    "python tools/check-performance.py",
    "python tools/check-runtime-contracts.py",
    "python tools/check-release.py --dry-run",
    "npm run check:js:all",
]

# Configured floors as committed at CAPTURED_COMMIT.
EXISTING_THRESHOLDS = {
    "pythonAggregateCoveragePercent": 90,
    "validationPackageLineCoveragePercent": 95,
    "validationPackageBranchCoveragePercent": 95,
    "histogramLineCoveragePercent": 95,
    "histogramBranchCoveragePercent": 90,
    "ruffMaxComplexity": 10,
    "ruffMaxStatements": 40,
    "ruffMaxBranches": 10,
    "ruffMaxReturns": 4,
    "ruffMaxArgs": 6,
    "performanceModelUpdateSeconds": 1.0,
    "performancePolarFormatSeconds": 1.5,
    "performanceDoublingRatio": 2.8,
}

# A defect discovered while establishing this baseline, classified and fixed in the same
# change rather than carried forward. See `pyproject.toml`'s `[tool.ruff] extend-exclude`.
KNOWN_DEFECTS_FIXED_BEFORE_MIGRATION = [
    {
        "defect": (
            "`ruff format --check .` at CAPTURED_COMMIT wants to reformat "
            "exec-plans/completed/PLAN1.md because Ruff's default "
            'file_resolver.include now contains "*.md" and formats embedded Python '
            "fenced code blocks. Verified reproducible across ruff 0.9.10 through "
            "0.16.0 (every readily installable version), so this is not a narrow "
            "tool-version-pin escape; historical Markdown formatting was never "
            "actually enforced by this repository's own Ruff scope."
        ),
        "fix": (
            'Added "*.md" to `[tool.ruff] extend-exclude` in pyproject.toml. '
            "Markdown formatting is Prettier's domain, not Ruff's; excluding it removes "
            "an accidental scope overlap instead of editing the historical exec-plan file "
            "the defect was found against."
        ),
        "verifiedCleanAfterFix": True,
    }
]


def _sorted_paths(blobs: dict[str, str]) -> list[dict[str, str]]:
    return [{"path": path, "gitBlobSha1": blobs[path]} for path in sorted(blobs)]


def build_capture() -> dict[str, object]:
    """Build the canonical verified-baseline capture from Git and frozen tool facts.

    Returns:
        The full capture as a JSON-serializable dict, ready for canonical dumping.
    """
    production_python = git_ls_tree_blobs(CAPTURED_COMMIT, "server/polarrecorder", "plugin.py")
    shipped_js = git_ls_tree_blobs(CAPTURED_COMMIT, "viewer", "plugin.js", "plugin.mjs")
    shipped_js = {p: h for p, h in shipped_js.items() if p.endswith((".js", ".mjs"))}
    test_python = git_ls_tree_blobs(CAPTURED_COMMIT, "tests")
    test_python = {p: h for p, h in test_python.items() if p.endswith(".py")}
    js_tool_files = git_ls_tree_blobs(CAPTURED_COMMIT, "tools")
    js_tool_files = {p: h for p, h in js_tool_files.items() if p.endswith(".mjs")}

    return {
        "capturedCommit": CAPTURED_COMMIT,
        "capturedTag": CAPTURED_TAG,
        "dyninstrumentsPolicyDataIsNotAnInput": True,
        "toolVersions": TOOL_VERSIONS,
        "developerPythonContract": DEVELOPER_PYTHON_CONTRACT,
        "oldCommandGraphSteps": OLD_COMMAND_GRAPH_STEPS,
        "existingThresholds": EXISTING_THRESHOLDS,
        "knownDefectsFixedBeforeMigration": KNOWN_DEFECTS_FIXED_BEFORE_MIGRATION,
        "productionInventory": {
            "pythonFiles": _sorted_paths(production_python),
            "pythonFileCount": len(production_python),
            "shippedJavascriptFiles": _sorted_paths(shipped_js),
            "shippedJavascriptFileCount": len(shipped_js),
        },
        "testInventory": {
            "pythonTestFiles": _sorted_paths(test_python),
            "pythonTestFileCount": len(test_python),
        },
        "toolJavascriptFiles": {
            "files": _sorted_paths(js_tool_files),
            "count": len(js_tool_files),
        },
    }


def main(argv: list[str]) -> int:
    """Run the CLI entry point.

    Args:
        argv: Command-line arguments, excluding the program name.

    Returns:
        The process exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", action="store_true", help="write verified-baseline.json")
    group.add_argument("--stdout", action="store_true", help="print canonical JSON, do not write")
    args = parser.parse_args(argv)

    canonical = dumps_canonical(build_capture())
    if args.write:
        OUTPUT_PATH.write_text(canonical, encoding="utf-8")
        sys.stderr.write(f"wrote {OUTPUT_PATH}\n")
    else:
        sys.stdout.write(canonical)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
