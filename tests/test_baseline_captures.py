"""Verify the immutable baseline captures under `tools/quality-policy/`.

These tests are the independent digest anchor: expected SHA-256 values live here, not
inside the JSON they protect or inside the generator scripts, so a coordinated edit to a
generator plus its output still fails this test unless the test itself is also (visibly)
changed.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
QUALITY_POLICY_DIR = REPO_ROOT / "tools" / "quality-policy"

# Independent expected digests: hardcoded here, not derived from the JSON files or the
# generators. Regenerate with `sha256sum tools/quality-policy/<file>.json` and update both
# the digest AND this comment's rationale in the same reviewed change if a baseline capture
# legitimately changes.
EXPECTED_DIGESTS = {
    "baseline-coverage-capture.json": (
        "a3af7e341a4dda51616808e2df14c034c130c0b5df1260ace8dee5f037addf62"
    ),
    "planned-quality-fixtures.json": (
        "2a625565e43177894affbed0720e32fb2afea40ab42ba2861704fca937ed55ad"
    ),
}

CAPTURED_COMMIT = "08edef88b0102af6507ef02fd4448f7fd1eaca45"


def _sha256_of_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _canonical_json(value: object) -> str:
    """Serialize JSON with the immutable-capture canonical layout."""
    return json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n"


def test_every_captured_file_has_an_independent_expected_digest() -> None:
    """Every committed baseline capture matches its independently anchored digest."""
    for filename, expected_digest in EXPECTED_DIGESTS.items():
        actual = _sha256_of_file(QUALITY_POLICY_DIR / filename)
        assert actual == expected_digest, f"{filename} digest drifted: {actual}"


def test_canonical_json_is_stable_under_key_reordering() -> None:
    """Semantically identical data in a different key/list order yields identical bytes."""
    first = {"b": 1, "a": [{"y": 2, "x": 1}], "c": {"z": 3, "y": 2}}
    second = {"a": [{"x": 1, "y": 2}], "c": {"y": 2, "z": 3}, "b": 1}
    assert _canonical_json(first) == _canonical_json(second)


def test_baseline_captures_have_no_volatile_metadata_fields() -> None:
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
        "baseline-coverage-capture.json",
        "planned-quality-fixtures.json",
    ):
        data: dict[str, Any] = json.loads(
            (QUALITY_POLICY_DIR / filename).read_text(encoding="utf-8")
        )
        assert data["capturedCommit"] == CAPTURED_COMMIT


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
    reviewing a proposed capture against the committed file, which is exercised as part of
    establishing the baseline rather than on every `pytest` run.
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
