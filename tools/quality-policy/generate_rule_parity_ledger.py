"""Generate `rule-parity-ledger.json`, the reviewed rule-ownership map.

Usage:
    python tools/quality-policy/generate_rule_parity_ledger.py --write
    python tools/quality-policy/generate_rule_parity_ledger.py --stdout

This is reviewer-authored policy, not derived from Git blobs: it maps every rule/command
enforced at `CAPTURED_COMMIT` (per `documentation/conventions/smell-prevention.md` and the
32 `PATTERN_RULE_IDS` / 3 `check-smell-contracts.mjs` rules) to exactly one target owner.
Every entry's `owner` is one of:

    maintainedTool        -- a standard tool (Ruff, mypy, ESLint, Stylelint, jscpd,
                              markdownlint-cli2, Linkinator, actionlint, c8) now or
                              already enforces this.
    focusedPolarContract   -- a retained/new Polar-specific Node or Python contract test
                              (not a broad custom CLI checker) enforces this.
    retainedChecker        -- a broad custom checker script keeps this rule; no maintained
                              tool or focused contract subsumes it.
    approvedRemoval        -- explicitly sanctioned removal (exactly one is named:
                              check-performance.py's wall-clock ceilings/doubling ratio,
                              removed only after its deterministic replacements pass).
    approvedNonPort        -- explicitly sanctioned non-port of a Dyninstruments command
                              (only `schema:check`, per this project's plugin.json contract).

No row may be "unproven": every rule below states its reviewed owner and the activation
milestone (`phase`) that brought it online. A custom checker may only be deleted once its
row's target milestone has landed with clean and negative parity proof.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from canonical_json import dumps_canonical

CAPTURED_COMMIT = "08edef88b0102af6507ef02fd4448f7fd1eaca45"
OUTPUT_PATH = Path(__file__).resolve().parent / "rule-parity-ledger.json"


def _row(rule: str, enforcement: str, owner: str, target: str, phase: str) -> dict[str, str]:
    return {
        "rule": rule,
        "currentEnforcement": enforcement,
        "owner": owner,
        "target": target,
        "phase": phase,
    }


PATTERN_RULE_ROWS = [
    _row(
        "absolute-home-path",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (narrowed)",
        "3A",
    ),
    _row(
        "avnav-import",
        "check-patterns.mjs + Ruff TID",
        "retainedChecker",
        "check-patterns.mjs (narrowed; Ruff TID covers Python import statements, this rule also covers doc/string mentions)",
        "3A",
    ),
    _row(
        "bare-isfinite",
        "check-patterns.mjs",
        "maintainedTool",
        "ESLint no-restricted-globals(isFinite)",
        "3A",
    ),
    _row(
        "canvas-api-typeof-guard",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (narrowed)",
        "3A",
    ),
    _row(
        "catch-fallback",
        "check-patterns.mjs",
        "focusedPolarContract",
        "boundary-marker contract (structured markers)",
        "3A",
    ),
    _row(
        "commented-out-code",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (no maintained-tool equivalent)",
        "3A",
    ),
    _row("console-log", "check-patterns.mjs", "maintainedTool", "ESLint no-console", "3A"),
    _row(
        "dead-code",
        "check-patterns.mjs",
        "maintainedTool",
        "ESLint no-unreachable/no-constant-condition",
        "3A",
    ),
    _row(
        "default-truthy-fallback",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (narrowed)",
        "3A",
    ),
    _row(
        "domain-lock-acquisition",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Python-specific, no maintained-tool equivalent)",
        "3A",
    ),
    _row(
        "domain-time-sleep",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Python-specific, no maintained-tool equivalent)",
        "3A",
    ),
    _row(
        "empty-catch",
        "check-patterns.mjs",
        "maintainedTool",
        "ESLint no-empty (catch clauses)",
        "3A",
    ),
    _row(
        "es-module-syntax",
        "check-patterns.mjs",
        "maintainedTool",
        "ESLint sourceType=script for viewer/plugin.js scope",
        "3A",
    ),
    _row(
        "eval-call",
        "check-patterns.mjs",
        "maintainedTool",
        "ESLint no-eval/no-implied-eval/no-new-func",
        "3A",
    ),
    _row(
        "exec-plan-reference",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (repo-wide scan for stale exec-plan/phase citations outside "
        "exec-plans/, no maintained-tool equivalent)",
        "n/a (added after the migration completed)",
    ),
    _row(
        "framework-method-typeof-guard",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar namespace contract, no maintained-tool equivalent)",
        "3A",
    ),
    _row(
        "hardcoded-runtime-default",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (narrowed)",
        "3A",
    ),
    _row(
        "inner-html-assignment",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs unsafe-DOM-sink rule (hardened per 3A)",
        "3A",
    ),
    _row(
        "internal-namespace-fallback",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar namespace contract)",
        "3A",
    ),
    _row("loose-equality", "check-patterns.mjs", "maintainedTool", "ESLint eqeqeq", "3A"),
    _row(
        "placeholder-literal",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar placeholder ownership)",
        "3A",
    ),
    _row(
        "pluginhandler-import",
        "check-patterns.mjs + Ruff TID",
        "retainedChecker",
        "check-patterns.mjs (narrowed; see avnav-import)",
        "3A",
    ),
    _row(
        "premature-legacy-support",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar-specific)",
        "3A",
    ),
    _row(
        "promise-empty-catch",
        "check-patterns.mjs",
        "focusedPolarContract",
        "boundary-marker contract (structured markers)",
        "3A",
    ),
    _row(
        "python-suppression",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Ruff does not cover ad hoc suppression syntax)",
        "3A",
    ),
    _row(
        "redundant-null-type-guard",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (narrowed)",
        "3A",
    ),
    _row(
        "responsive-layout-hard-floor",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar-specific)",
        "3A",
    ),
    _row(
        "reverse-plugin-import",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar-specific dependency direction)",
        "3A",
    ),
    _row(
        "try-finally-canvas-drawing",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar-specific)",
        "3A",
    ),
    _row(
        "unowned-todo",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (Polar-specific TODO syntax)",
        "3A",
    ),
    _row(
        "unused-fallback",
        "check-patterns.mjs",
        "retainedChecker",
        "check-patterns.mjs (narrowed)",
        "3A",
    ),
    _row("var-declaration", "check-patterns.mjs", "maintainedTool", "ESLint no-var", "3A"),
    _row(
        "viewer-suppression-comment",
        "check-patterns.mjs",
        "maintainedTool",
        "ESLint no-restricted-syntax/no-inline-config plus retained Python suppression rule",
        "3A",
    ),
]

SMELL_CONTRACT_ROWS = [
    _row(
        "viewer-script-contract",
        "check-smell-contracts.mjs",
        "focusedPolarContract",
        "retained (viewer.html load-order proof has no maintained-tool equivalent)",
        "3B",
    ),
    _row(
        "viewer-coverage-target-contract",
        "check-smell-contracts.mjs",
        "focusedPolarContract",
        "retained; folds into the coverage inventory",
        "3B/6B",
    ),
    _row(
        "viewer-dependency-header-contract",
        "check-smell-contracts.mjs",
        "focusedPolarContract",
        "retained (Depends: accuracy has no maintained-tool equivalent)",
        "3B",
    ),
]

PYTHON_CHECKER_ROWS = [
    _row(
        "ruff-lint-families",
        "ruff check",
        "maintainedTool",
        "Ruff (already maintained; tools/ scope later widened)",
        "2C",
    ),
    _row(
        "ruff-format", "ruff format --check", "maintainedTool", "Ruff (already maintained)", "0/2"
    ),
    _row("mypy-strict", "mypy --strict", "maintainedTool", "mypy (already maintained)", "0"),
    _row(
        "python-3.9-compat",
        "check-python-compat.py",
        "retainedChecker",
        "check-python-compat.py (no maintained tool checks a 3.9 floor under a newer interpreter)",
        "3C",
    ),
    _row("future-annotations", "Ruff FA", "maintainedTool", "Ruff (already maintained)", "0"),
    _row("public-docstrings", "Ruff D", "maintainedTool", "Ruff (already maintained)", "0"),
    _row("print-statement", "Ruff T20", "maintainedTool", "Ruff (already maintained)", "0"),
    _row(
        "broad-domain-exception", "Ruff BLE/TRY", "maintainedTool", "Ruff (already maintained)", "0"
    ),
    _row("magic-threshold", "Ruff PLR2004", "maintainedTool", "Ruff (already maintained)", "0"),
    _row(
        "avnav-import-leak",
        "Ruff TID + check-patterns.mjs",
        "maintainedTool",
        "Ruff TID banned-api (already maintained); pattern rule narrowed, see avnav-import row",
        "3A",
    ),
    _row(
        "reverse-dependency",
        "check-patterns.mjs",
        "retainedChecker",
        "see reverse-plugin-import row",
        "3A",
    ),
    _row(
        "domain-lock-acquisition-py",
        "check-patterns.mjs",
        "retainedChecker",
        "see domain-lock-acquisition row",
        "3A",
    ),
    _row(
        "domain-time-sleep-py",
        "check-patterns.mjs",
        "retainedChecker",
        "see domain-time-sleep row",
        "3A",
    ),
    _row(
        "defensive-fallback-contract-gap",
        "check-py-contracts.py",
        "retainedChecker",
        "check-py-contracts.py (Polar-specific contract discipline)",
        "3C",
    ),
    _row(
        "absent-value-sentinel",
        "check-py-contracts.py + check-runtime-contracts.py",
        "retainedChecker",
        "both retained (Polar-specific)",
        "3C",
    ),
    _row(
        "redundant-type-guard",
        "check-py-contracts.py",
        "retainedChecker",
        "check-py-contracts.py",
        "3C",
    ),
    _row(
        "framework-method-guard-py",
        "check-py-contracts.py",
        "retainedChecker",
        "check-py-contracts.py",
        "3C",
    ),
    _row(
        "premature-legacy-py",
        "check-py-contracts.py",
        "retainedChecker",
        "check-py-contracts.py",
        "3C",
    ),
    _row(
        "canonical-helper-redefinition",
        "check-py-contracts.py",
        "retainedChecker",
        "check-py-contracts.py",
        "3C",
    ),
    _row(
        "stale-canonical-helper-map",
        "check-py-contracts.py",
        "retainedChecker",
        "check-py-contracts.py",
        "3C",
    ),
    _row(
        "duplicate-python-logic",
        "check-duplication.py",
        "retainedChecker",
        "check-duplication.py (duplication:python leaf)",
        "3C",
    ),
    _row(
        "python-file-size",
        "check-python-filesize.py",
        "retainedChecker",
        "check-python-filesize.py",
        "3C",
    ),
    _row(
        "python-module-header",
        "check-python-filesize.py",
        "retainedChecker",
        "check-python-filesize.py",
        "3C",
    ),
    _row(
        "python-one-line-compression",
        "check-python-filesize.py",
        "retainedChecker",
        "check-python-filesize.py",
        "3C",
    ),
    _row(
        "python-suppression-comment",
        "check-patterns.mjs",
        "retainedChecker",
        "see python-suppression row",
        "3A",
    ),
    _row(
        "stale-python-dependency-header",
        "check-py-dependencies.py",
        "retainedChecker",
        "check-py-dependencies.py",
        "3C",
    ),
    _row(
        "domain-import-cycle",
        "check-py-dependencies.py",
        "retainedChecker",
        "check-py-dependencies.py",
        "3C",
    ),
    _row(
        "backwards-layer-import",
        "check-py-dependencies.py",
        "retainedChecker",
        "check-py-dependencies.py",
        "3C",
    ),
    _row(
        "stale-layer-map",
        "check-py-dependencies.py",
        "retainedChecker",
        "check-py-dependencies.py",
        "3C",
    ),
    _row(
        "hot-path-regression",
        "check-performance.py",
        "approvedRemoval",
        "deterministic check:scaling contracts replace the wall-clock ceilings/doubling ratio",
        "7B",
    ),
    _row(
        "runtime-non-finite-leak",
        "check-runtime-contracts.py",
        "retainedChecker",
        "check-runtime-contracts.py",
        "3C",
    ),
]

JS_VIEWER_CHECKER_ROWS = [
    _row(
        "viewer-namespace",
        "check-namespace.mjs",
        "retainedChecker",
        "check-namespace.mjs (Polar window.Polarrecorder contract)",
        "3B",
    ),
    _row(
        "js-naming",
        "check-naming.mjs",
        "retainedChecker",
        "check-naming.mjs (kebab-case/PascalCase/camelCase conventions have no maintained-tool equivalent)",
        "3B",
    ),
    _row("viewer-module-header", "check-headers.mjs", "retainedChecker", "check-headers.mjs", "3B"),
    _row(
        "viewer-dependency-header",
        "check-smell-contracts.mjs",
        "focusedPolarContract",
        "see viewer-dependency-header-contract row",
        "3B",
    ),
    _row(
        "viewer-script-order",
        "check-smell-contracts.mjs",
        "focusedPolarContract",
        "see viewer-script-contract row",
        "3B",
    ),
    _row(
        "viewer-module-load-dependency",
        "check-dependencies.mjs",
        "retainedChecker",
        "check-dependencies.mjs",
        "3B",
    ),
    _row(
        "js-namespace-cycle",
        "check-dependencies.mjs",
        "retainedChecker",
        "check-dependencies.mjs",
        "3B",
    ),
    _row(
        "duplicate-viewer-helper",
        "check-js-duplication.mjs",
        "retainedChecker",
        "retained structural clone owner unless jscpd parity is proven (duplication:js)",
        "2C/3C",
    ),
    _row(
        "viewer-file-size",
        "check-file-size.mjs",
        "retainedChecker",
        "check-file-size.mjs (anti-compression heuristics have no maintained-tool equivalent)",
        "2C",
    ),
    _row(
        "js-one-line-compression",
        "check-file-size.mjs",
        "retainedChecker",
        "check-file-size.mjs",
        "2C",
    ),
    _row(
        "viewer-coverage-target",
        "check-js-coverage.mjs",
        "retainedChecker",
        "pending c8 VM-attribution proof; falls back to a small V8 attribution adapter if c8 cannot attribute",
        "6A",
    ),
    _row(
        "untested-viewer-logic",
        "check-js-coverage.mjs",
        "retainedChecker",
        "see viewer-coverage-target row",
        "6A",
    ),
    _row(
        "viewer-rendered-sentinel",
        "check-viewer-contracts.mjs",
        "retainedChecker",
        "check-viewer-contracts.mjs (Polar-specific runtime contract)",
        "3B",
    ),
    _row(
        "viewer-absent-placeholder",
        "check-viewer-contracts.mjs",
        "retainedChecker",
        "check-viewer-contracts.mjs",
        "3B",
    ),
    _row(
        "viewer-falsy-preservation",
        "check-viewer-contracts.mjs",
        "retainedChecker",
        "check-viewer-contracts.mjs",
        "3B",
    ),
    _row(
        "plugin-entry-contract",
        "test-plugin-mjs.mjs",
        "focusedPolarContract",
        "test:plugin (retained/migrated to node:test)",
        "5A",
    ),
    _row(
        "viewer-behavior-regressions",
        "test-viewer-*.mjs",
        "focusedPolarContract",
        "test:viewer (retained/migrated to node:test)",
        "5A",
    ),
]

DOC_REPO_RELEASE_ROWS = [
    _row(
        "documentation-toc-coverage",
        "check-docs.mjs",
        "focusedPolarContract",
        "check-docs.mjs (retained; Polar TOC shape)",
        "3B",
    ),
    _row(
        "documentation-format",
        "check-doc-format.mjs",
        "focusedPolarContract",
        "check-doc-format.mjs (required-section shape retained); Markdown style moves to markdownlint-cli2",
        "3B",
    ),
    _row(
        "documentation-reachability",
        "check-doc-reachability.mjs",
        "focusedPolarContract",
        "check-doc-reachability.mjs (retained graph contract)",
        "3B",
    ),
    _row(
        "ai-instruction-drift",
        "check-agents-pointer.mjs",
        "focusedPolarContract",
        "replaced by a CLAUDE.md-as-pointer + reachability contract, a separately sanctioned deletion distinct from the 'explicitly approved removal' category above (which names only check-performance.py); sync-ai-instructions.mjs and check-ai-instructions.mjs deleted now that the pointer contract is active",
        "8F",
    ),
    _row(
        "markdown-file-size",
        "check-file-size.mjs",
        "retainedChecker",
        "check-file-size.mjs (400-line Markdown limit)",
        "2C",
    ),
    _row(
        "machine-specific-host-citation",
        "check-patterns.mjs",
        "retainedChecker",
        "see absolute-home-path row",
        "3A",
    ),
    _row("unowned-todo-doc", "check-patterns.mjs", "retainedChecker", "see unowned-todo row", "3A"),
    _row(
        "release-artifact-drift",
        "check-release.py",
        "retainedChecker",
        "check-release.py + release_manifest.py (sole packaging authority)",
        "8C",
    ),
    _row(
        "hook-installation-drift",
        "check-hooks.mjs",
        "retainedChecker",
        "renamed hooks-doctor.mjs",
        "8A",
    ),
    _row(
        "custom-checker-without-tests",
        "test:tools",
        "focusedPolarContract",
        "test:tools (retained; every custom checker keeps a self-test)",
        "3D",
    ),
    _row(
        "smell-catalog-completeness",
        "check-smell-catalog.mjs",
        "focusedPolarContract",
        "check-smell-catalog.mjs (retained)",
        "3B",
    ),
    _row(
        "markdown-syntax-style",
        "(uncovered today)",
        "maintainedTool",
        "markdownlint-cli2 (new adoption)",
        "2C",
    ),
    _row(
        "markdown-links-and-fragments",
        "(uncovered today; no fragment proof)",
        "maintainedTool",
        "Linkinator (new adoption)",
        "3B",
    ),
    _row(
        "workflow-syntax", "(uncovered today)", "maintainedTool", "actionlint (new adoption)", "1B"
    ),
    _row(
        "token-clone-detection-js-css",
        "(uncovered today)",
        "maintainedTool",
        "jscpd (new adoption)",
        "2C",
    ),
]

TEST_COVERAGE_ROWS = [
    _row("pytest-regressions", "pytest", "maintainedTool", "pytest (already maintained)", "0"),
    _row(
        "overall-python-coverage",
        "check-coverage.py",
        "retainedChecker",
        "folds into the coverage-floor inventory",
        "6B",
    ),
    _row(
        "validation-coverage-floor",
        "check-coverage.py",
        "retainedChecker",
        "folds into the coverage-floor inventory",
        "6B",
    ),
    _row(
        "histogram-coverage-floor",
        "check-coverage.py",
        "retainedChecker",
        "folds into the coverage-floor inventory",
        "6B",
    ),
    _row(
        "fixture-drift",
        "review + tests",
        "focusedPolarContract",
        "unchanged; enforced by review discipline and fixture-sync tests",
        "n/a",
    ),
    _row(
        "focused-or-disabled-test-detection",
        "(uncovered today; verified-empty)",
        "focusedPolarContract",
        "test:focus:check contract",
        "5C",
    ),
    _row(
        "structured-boundary-suppression",
        "free-form polarrecorder-boundary-fallback comment",
        "focusedPolarContract",
        "hardened rule-scoped marker grammar",
        "3A",
    ),
    _row(
        "unsafe-dom-sink-ownership",
        "check-patterns.mjs inner-html-assignment (partial)",
        "retainedChecker",
        "hardened unsafe-DOM-sink rule covering innerHTML/outerHTML/insertAdjacentHTML/document.write/on*/setAttribute",
        "3A",
    ),
    _row(
        "hotspot-budgets",
        "(uncovered today; global 400-line limit only)",
        "focusedPolarContract",
        "persistent per-file hotspot-budget contract",
        "2D",
    ),
    _row(
        "installer-behavior",
        "tests/js/install-script.test.mjs",
        "focusedPolarContract",
        "install.sh contract tests (complete)",
        "8C",
    ),
    _row(
        "check-core-inclusion",
        "npm run check:core (literal command graph)",
        "focusedPolarContract",
        "literal command graph; final composition locked",
        "1C/8E",
    ),
    _row(
        "schema-check-non-port",
        "(no Dyninstruments schema:check equivalent exists)",
        "approvedNonPort",
        "plugin.json development/release-shape package contract proves no separate schema family exists",
        "8C",
    ),
    _row(
        "duplication-js-leaf",
        "check-js-duplication.mjs only",
        "maintainedTool",
        "jscpd + retained structural owner, aggregated as duplication:js",
        "2C/3C",
    ),
    _row(
        "duplication-python-leaf",
        "check-duplication.py only",
        "retainedChecker",
        "duplication:python leaf, unchanged tool",
        "3C",
    ),
    _row(
        "duplication-check-aggregate",
        "(does not exist yet)",
        "focusedPolarContract",
        "duplication:check = duplication:js && duplication:python, exactly once",
        "3C",
    ),
]

ALL_ROWS = (
    PATTERN_RULE_ROWS
    + SMELL_CONTRACT_ROWS
    + PYTHON_CHECKER_ROWS
    + JS_VIEWER_CHECKER_ROWS
    + DOC_REPO_RELEASE_ROWS
    + TEST_COVERAGE_ROWS
)

VALID_OWNERS = {
    "maintainedTool",
    "focusedPolarContract",
    "retainedChecker",
    "approvedRemoval",
    "approvedNonPort",
}


def build_capture() -> dict[str, object]:
    """Build the canonical rule-parity ledger.

    Returns:
        The full ledger as a JSON-serializable dict, ready for canonical dumping.

    Raises:
        ValueError: If a row uses an owner category outside the five sanctioned ones,
            or if any rule name is duplicated.
    """
    seen: set[str] = set()
    for entry in ALL_ROWS:
        if entry["owner"] not in VALID_OWNERS:
            msg = f"unrecognized owner category for rule {entry['rule']!r}: {entry['owner']!r}"
            raise ValueError(msg)
        if entry["rule"] in seen:
            msg = f"duplicate rule row: {entry['rule']!r}"
            raise ValueError(msg)
        seen.add(entry["rule"])

    approved_removals = [entry["rule"] for entry in ALL_ROWS if entry["owner"] == "approvedRemoval"]
    if approved_removals != ["hot-path-regression"]:
        msg = f"exactly one approvedRemoval row is sanctioned (hot-path-regression), got {approved_removals}"
        raise ValueError(msg)

    by_owner: dict[str, int] = {}
    for entry in ALL_ROWS:
        by_owner[entry["owner"]] = by_owner.get(entry["owner"], 0) + 1

    return {
        "capturedCommit": CAPTURED_COMMIT,
        "rows": sorted(ALL_ROWS, key=lambda row: row["rule"]),
        "rowCount": len(ALL_ROWS),
        "countByOwner": by_owner,
        "unprovenRowCount": 0,
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
    group.add_argument("--write", action="store_true", help="write rule-parity-ledger.json")
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
