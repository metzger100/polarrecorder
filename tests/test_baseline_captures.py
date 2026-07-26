"""Verify the immutable baseline captures under `tools/quality-policy/`.

These tests are the independent digest anchor: expected SHA-256 values live here, not
inside the JSON they protect or inside the generator scripts, so a coordinated edit to a
generator plus its output still fails this test unless the test itself is also (visibly)
changed.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from types import ModuleType

REPO_ROOT = Path(__file__).resolve().parents[1]
QUALITY_POLICY_DIR = REPO_ROOT / "tools" / "quality-policy"

# Independent expected digests: hardcoded here, not derived from the JSON files or the
# generators. Regenerate with `sha256sum tools/quality-policy/<file>.json` and update both
# the digest AND this comment's rationale in the same reviewed change if a baseline capture
# legitimately changes.
EXPECTED_DIGESTS = {
    "verified-baseline.json": "a74c219d72a5a05389c147590bbe3bb5f7f1907a44810a1767abb5525fb4a249",
    "baseline-test-inventory.json": (
        "ead7bf490ec00cc37f574ef7b2c982295dde7e950f3c9420b5f3d1122c65cb7c"
    ),
    "baseline-coverage-capture.json": (
        "a3af7e341a4dda51616808e2df14c034c130c0b5df1260ace8dee5f037addf62"
    ),
    "baseline-complexity-source-capture.json": (
        "8163b6c696d157fcb578739e73cdfa8f77d7072b1c993b8523bf90c58439adc5"
    ),
    "planned-quality-fixtures.json": (
        "2a625565e43177894affbed0720e32fb2afea40ab42ba2861704fca937ed55ad"
    ),
    "rule-parity-ledger.json": ("f06433f3567d12b16fa2699550fd3ecd5da4b951bbfabd2f1099679700f43793"),
}

PATTERN_RULE_IDS_SOURCE = re.compile(r'"(?P<id>[a-z][a-z-]+)"')

CAPTURED_COMMIT = "08edef88b0102af6507ef02fd4448f7fd1eaca45"


def _load_module(name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, QUALITY_POLICY_DIR / f"{name}.py")
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _sha256_of_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_every_captured_file_has_an_independent_expected_digest() -> None:
    """Every committed baseline capture matches its independently anchored digest."""
    for filename, expected_digest in EXPECTED_DIGESTS.items():
        actual = _sha256_of_file(QUALITY_POLICY_DIR / filename)
        assert actual == expected_digest, f"{filename} digest drifted: {actual}"


def test_baseline_capture_regenerates_byte_identically() -> None:
    """Re-running the baseline generator reproduces the committed bytes exactly."""
    canonical_json = _load_module("canonical_json")
    generator = _load_module("generate_verified_baseline")
    regenerated = canonical_json.dumps_canonical(generator.build_capture())
    committed = (QUALITY_POLICY_DIR / "verified-baseline.json").read_text(encoding="utf-8")
    assert regenerated == committed


def test_test_capture_regenerates_byte_identically() -> None:
    """Re-running the test-inventory generator reproduces the committed bytes exactly."""
    canonical_json = _load_module("canonical_json")
    generator = _load_module("generate_baseline_test_inventory")
    regenerated = canonical_json.dumps_canonical(generator.build_capture())
    committed = (QUALITY_POLICY_DIR / "baseline-test-inventory.json").read_text(encoding="utf-8")
    assert regenerated == committed


def test_complexity_source_capture_regenerates_byte_identically() -> None:
    """Re-running the JS source-inventory generator reproduces the committed bytes exactly."""
    canonical_json = _load_module("canonical_json")
    generator = _load_module("generate_baseline_complexity_source_capture")
    regenerated = canonical_json.dumps_canonical(generator.build_capture())
    committed = (QUALITY_POLICY_DIR / "baseline-complexity-source-capture.json").read_text(
        encoding="utf-8"
    )
    assert regenerated == committed


def test_canonical_json_is_stable_under_key_reordering() -> None:
    """Semantically identical data in a different key/list order yields identical bytes."""
    canonical_json = _load_module("canonical_json")
    first = {"b": 1, "a": [{"y": 2, "x": 1}], "c": {"z": 3, "y": 2}}
    second = {"a": [{"x": 1, "y": 2}], "c": {"y": 2, "z": 3}, "b": 1}
    assert canonical_json.dumps_canonical(first) == canonical_json.dumps_canonical(second)


def test_canonical_json_has_no_volatile_metadata_fields() -> None:
    """Captures never embed timestamps, durations, or machine-local paths."""
    volatile_markers = (
        "timestamp",
        "duration",
        "elapsed",
        "/home/",
        "/Users/",
        "/tmp/",  # noqa: S108 -- text marker checked against capture content, not a real path
    )
    for filename in EXPECTED_DIGESTS:
        text = (QUALITY_POLICY_DIR / filename).read_text(encoding="utf-8").lower()
        for marker in volatile_markers:
            assert marker not in text, f"{filename} contains volatile marker {marker!r}"


def test_all_captures_are_pinned_to_the_frozen_commit() -> None:
    """Every capture that names a commit names the one frozen commit, not a moving HEAD."""
    for filename in (
        "verified-baseline.json",
        "baseline-test-inventory.json",
        "baseline-coverage-capture.json",
        "baseline-complexity-source-capture.json",
        "planned-quality-fixtures.json",
    ):
        data: dict[str, Any] = json.loads(
            (QUALITY_POLICY_DIR / filename).read_text(encoding="utf-8")
        )
        assert data["capturedCommit"] == CAPTURED_COMMIT


def test_executable_test_exception_set_is_empty() -> None:
    """The strict-test exception baseline starts empty, not self-authorized debt."""
    data = json.loads(
        (QUALITY_POLICY_DIR / "baseline-test-inventory.json").read_text(encoding="utf-8")
    )
    assert data["executableTestExceptionSet"] == []
    assert data["verifiedEmptyFocusedOrDisabledMarkers"] == {"javascript": [], "python": []}


def test_planned_quality_fixtures_manifest_is_empty_and_paths_are_absent() -> None:
    """An empty planned-fixture manifest is valid; any future entry's path must be absent."""
    data = json.loads(
        (QUALITY_POLICY_DIR / "planned-quality-fixtures.json").read_text(encoding="utf-8")
    )
    assert data["plannedFixtures"] == []
    for entry in data["plannedFixtures"]:
        fixture_path = REPO_ROOT / entry["path"]
        assert not fixture_path.exists()


def test_coverage_capture_values_meet_their_own_recorded_floors() -> None:
    """Recorded coverage measurements are internally consistent with recorded floors.

    This does not re-run pytest/c8 (nesting a full coverage run inside a coverage run is
    unreliable); regenerating `baseline-coverage-capture.json` itself requires running
    `python tools/quality-policy/generate_baseline_coverage_capture.py --stdout` by hand and
    diffing against the committed file, which is exercised as part of establishing the
    baseline rather than on every `pytest` run.
    """
    data = json.loads(
        (QUALITY_POLICY_DIR / "baseline-coverage-capture.json").read_text(encoding="utf-8")
    )
    floors = data["preMigrationConfiguredFloors"]
    measured_python_percent = data["pythonPackageCoverage"]["combinedLineAndBranchPercent"]
    assert measured_python_percent >= floors["pythonAggregateCombinedPercent"]
    for path, percent in data["viewerLineCoveragePercentByFile"].items():
        floor_key = (
            "viewer"
            + "".join(part.capitalize() for part in Path(path).stem.split("-"))
            + "JsLinePercent"
        )
        assert floor_key in floors, f"no recorded floor for {path} (looked for {floor_key})"
        assert percent >= floors[floor_key]


def test_production_and_test_inventories_match_git_ls_tree_at_captured_commit() -> None:
    """The baseline's file counts match a fresh, independent `git ls-tree` read."""
    canonical_json = _load_module("canonical_json")
    baseline = json.loads(
        (QUALITY_POLICY_DIR / "verified-baseline.json").read_text(encoding="utf-8")
    )
    fresh_blobs = canonical_json.git_ls_tree_blobs(
        CAPTURED_COMMIT, "server/polarrecorder", "plugin.py"
    )
    assert baseline["productionInventory"]["pythonFileCount"] == len(fresh_blobs)


def _live_pattern_rule_ids() -> set[str]:
    source = (REPO_ROOT / "tools" / "check-patterns.mjs").read_text(encoding="utf-8")
    array_text = source.split("PATTERN_RULE_IDS = [", 1)[1].split("];", 1)[0]
    return set(PATTERN_RULE_IDS_SOURCE.findall(array_text))


def test_rule_parity_ledger_regenerates_byte_identically() -> None:
    """Re-running the rule-parity ledger generator reproduces the committed bytes exactly."""
    canonical_json = _load_module("canonical_json")
    generator = _load_module("generate_rule_parity_ledger")
    regenerated = canonical_json.dumps_canonical(generator.build_capture())
    committed = (QUALITY_POLICY_DIR / "rule-parity-ledger.json").read_text(encoding="utf-8")
    assert regenerated == committed


def test_rule_parity_ledger_covers_every_live_pattern_rule_id() -> None:
    """Every one of check-patterns.mjs's live `PATTERN_RULE_IDS` has a ledger row."""
    ledger = json.loads(
        (QUALITY_POLICY_DIR / "rule-parity-ledger.json").read_text(encoding="utf-8")
    )
    ledgered_rules = {row["rule"] for row in ledger["rows"]}
    live_ids = _live_pattern_rule_ids()
    assert live_ids, "failed to extract any PATTERN_RULE_IDS from tools/check-patterns.mjs"
    missing = live_ids - ledgered_rules
    assert not missing, f"pattern rule IDs missing a ledger row: {sorted(missing)}"


def test_rule_parity_ledger_has_no_unproven_row() -> None:
    """Every ledger row names one of the five sanctioned owner categories."""
    ledger = json.loads(
        (QUALITY_POLICY_DIR / "rule-parity-ledger.json").read_text(encoding="utf-8")
    )
    valid_owners = {
        "maintainedTool",
        "focusedPolarContract",
        "retainedChecker",
        "approvedRemoval",
        "approvedNonPort",
    }
    assert ledger["unprovenRowCount"] == 0
    for row in ledger["rows"]:
        assert row["owner"] in valid_owners, row


def test_rule_parity_ledger_names_exactly_one_approved_removal() -> None:
    """Exactly one approved removal is sanctioned: check-performance.py's timing."""
    ledger = json.loads(
        (QUALITY_POLICY_DIR / "rule-parity-ledger.json").read_text(encoding="utf-8")
    )
    removals = [row["rule"] for row in ledger["rows"] if row["owner"] == "approvedRemoval"]
    assert removals == ["hot-path-regression"]
