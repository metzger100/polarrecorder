from __future__ import annotations

import json
from typing import Any

import pytest
from polarrecorder import persistence, restore
from polarrecorder.bins import Bin
from polarrecorder.counters import Counters
from polarrecorder.import_common import BackupError
from polarrecorder.polar_model import PolarModel


def _populated_model() -> PolarModel:
    model = PolarModel()
    model.bins[(90, 12)] = Bin(
        twa_deg=90,
        tws_kt=12,
        histogram={58: 2, 60: 1},
        total_accepted=3,
        total_rejected=1,
        total_quarantined=0,
        last_update_wall=1000.0,
        rejection_histogram={"reject_unstable": 1},
    )
    model.bins[(0, 0)] = Bin(twa_deg=0, tws_kt=0, histogram={0: 0})
    return model


def _populated_counters() -> Counters:
    return Counters(
        total_seen=10,
        total_accepted=3,
        total_rejected=1,
        total_quarantined=0,
        rejection_histogram={"reject_unstable": 1},
    )


def _valid_payload() -> dict[str, Any]:
    return persistence.serialize_to_dict(
        _populated_model(),
        _populated_counters(),
        persistence.PersistenceMetadata(created_wall=500.0, last_flush_wall=1500.0),
    )


def _valid_raw() -> str:
    return json.dumps(_valid_payload())


def test_round_trip_rebuilds_equal_model_and_counters() -> None:
    result = restore.validate_and_build(_valid_raw())

    assert result.model.bins == _populated_model().bins
    assert result.counters == _populated_counters()
    assert result.created_wall == 500.0
    assert result.last_flush_wall == 1500.0
    assert result.migrated_from_version == persistence.CURRENT_SCHEMA_VERSION
    assert result.bins_restored == 2
    assert result.total_accepted == 3


def test_v0_backup_migrates_and_reports_source_version() -> None:
    payload = {
        "schema_version": 0,
        "config": {
            "twa_bin_size": 1,
            "tws_bin_size": 1,
            "percentile": 65,
            "max_tws": 60,
        },
        "counters": Counters().to_dict(),
        "bins": {},
    }

    result = restore.validate_and_build(json.dumps(payload))

    assert result.migrated_from_version == 0
    assert result.bins_restored == 0


def test_non_json_is_rejected() -> None:
    with pytest.raises(BackupError, match="not valid JSON"):
        restore.validate_and_build("{not json")


@pytest.mark.parametrize("raw", ["[1, 2, 3]", "5", '"string"'])
def test_non_object_json_is_rejected(raw: str) -> None:
    with pytest.raises(BackupError, match="not a Polar Recorder backup"):
        restore.validate_and_build(raw)


def test_missing_schema_version_is_rejected() -> None:
    payload = _valid_payload()
    del payload["schema_version"]
    with pytest.raises(restore.RestoreError, match="missing schema version"):
        restore.validate_and_build(json.dumps(payload))


def test_missing_grid_config_is_rejected() -> None:
    payload = _valid_payload()
    del payload["config"]["twa_bin_size"]
    with pytest.raises(restore.RestoreError, match="missing grid config"):
        restore.validate_and_build(json.dumps(payload))


@pytest.mark.parametrize("field", ["bins", "counters"])
def test_missing_required_block_is_rejected(field: str) -> None:
    payload = _valid_payload()
    del payload[field]
    with pytest.raises(restore.RestoreError, match=f"missing {field}"):
        restore.validate_and_build(json.dumps(payload))


def test_schema_too_new_is_rejected() -> None:
    payload = _valid_payload()
    payload["schema_version"] = persistence.CURRENT_SCHEMA_VERSION + 1
    with pytest.raises(restore.RestoreError, match="newer than this plugin supports"):
        restore.validate_and_build(json.dumps(payload))


def test_unknown_top_level_key_is_rejected() -> None:
    payload = _valid_payload()
    payload["surprise"] = 1
    with pytest.raises(BackupError, match="unexpected fields"):
        restore.validate_and_build(json.dumps(payload))


def test_foreign_grid_is_rejected() -> None:
    payload = _valid_payload()
    payload["config"]["twa_bin_size"] = 5
    with pytest.raises(restore.RestoreError, match="different bin grid"):
        restore.validate_and_build(json.dumps(payload))


def test_twa_out_of_range_is_rejected() -> None:
    payload = _valid_payload()
    payload["bins"]["400_12"] = payload["bins"]["90_12"]
    with pytest.raises(restore.RestoreError, match="Bin TWA 400"):
        restore.validate_and_build(json.dumps(payload))


def test_tws_over_max_is_rejected() -> None:
    payload = _valid_payload()
    payload["bins"]["90_61"] = payload["bins"]["90_12"]
    with pytest.raises(restore.RestoreError, match="Bin TWS 61"):
        restore.validate_and_build(json.dumps(payload))


def test_malformed_bin_address_is_rejected() -> None:
    payload = _valid_payload()
    payload["bins"]["ninety_twelve"] = payload["bins"]["90_12"]
    with pytest.raises(restore.RestoreError, match="malformed"):
        restore.validate_and_build(json.dumps(payload))


def test_negative_count_is_rejected() -> None:
    payload = _valid_payload()
    payload["bins"]["90_12"]["total_accepted"] = -1
    with pytest.raises(restore.RestoreError, match="non-negative"):
        restore.validate_and_build(json.dumps(payload))


def test_non_integer_count_is_rejected() -> None:
    payload = _valid_payload()
    payload["counters"]["total_seen"] = True
    with pytest.raises(restore.RestoreError, match="must be an integer"):
        restore.validate_and_build(json.dumps(payload))


def test_non_finite_last_update_wall_is_rejected() -> None:
    payload = _valid_payload()
    payload["bins"]["90_12"]["last_update_wall"] = float("inf")
    with pytest.raises(restore.RestoreError, match="finite"):
        restore.validate_and_build(json.dumps(payload))


def test_oversize_payload_is_rejected() -> None:
    raw = "a" * (restore.MAX_IMPORT_BYTES + 1)
    with pytest.raises(BackupError, match="too large"):
        restore.validate_and_build(raw)
