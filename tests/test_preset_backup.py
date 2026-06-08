from __future__ import annotations

import json
from typing import Any

import pytest
from polarrecorder import preset_backup
from polarrecorder.export import PRESET_SCHEMA_VERSION, ExportError, Preset
from polarrecorder.import_common import MAX_IMPORT_BYTES, BackupError

MAX_TWS = 60


def _user_presets() -> list[Preset]:
    return [
        Preset("coastal", builtin=False, twa=[0, 45, 90], tws=[6, 12, 18]),
        Preset("offshore", builtin=False, twa=[30, 60, 120], tws=[8, 16]),
    ]


def _by_name(presets: list[Preset]) -> dict[str, Preset]:
    return {preset.name: preset for preset in presets}


def _backup(presets: dict[str, Any] | None = None) -> dict[str, Any]:
    if presets is None:
        presets = {"coastal": {"twa": [0, 45, 90], "tws": [6, 12]}}
    return {"schema_version": 1, "presets": presets}


def test_round_trip_returns_equal_preset_set() -> None:
    raw = json.dumps(preset_backup.serialize_presets(_user_presets()))

    result = preset_backup.validate_presets(raw, MAX_TWS)

    assert _by_name(result) == _by_name(_user_presets())


def test_serialize_presets_uses_backup_shape() -> None:
    payload = preset_backup.serialize_presets(_user_presets())
    presets = payload["presets"]

    assert payload["schema_version"] == PRESET_SCHEMA_VERSION
    assert isinstance(presets, dict)
    assert presets["coastal"] == {"twa": [0, 45, 90], "tws": [6, 12, 18]}


def test_non_json_is_rejected() -> None:
    with pytest.raises(BackupError, match="not valid JSON"):
        preset_backup.validate_presets("{bad", MAX_TWS)


@pytest.mark.parametrize("raw", ["[]", "5"])
def test_non_object_json_is_rejected(raw: str) -> None:
    with pytest.raises(BackupError, match="not a presets backup"):
        preset_backup.validate_presets(raw, MAX_TWS)


def test_missing_presets_is_rejected() -> None:
    with pytest.raises(ExportError, match="missing presets"):
        preset_backup.validate_presets(json.dumps({"schema_version": 1}), MAX_TWS)


def test_missing_schema_version_is_rejected() -> None:
    with pytest.raises(ExportError, match="missing schema version"):
        preset_backup.validate_presets(json.dumps({"presets": {}}), MAX_TWS)


def test_schema_too_new_is_rejected() -> None:
    payload = _backup()
    payload["schema_version"] = PRESET_SCHEMA_VERSION + 1
    with pytest.raises(ExportError, match="newer than this plugin supports"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_unknown_top_level_key_is_rejected() -> None:
    payload = _backup()
    payload["extra"] = 1
    with pytest.raises(BackupError, match="unexpected fields"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_reserved_builtin_name_is_rejected() -> None:
    payload = _backup({"windy": {"twa": [0, 90], "tws": [6]}})
    with pytest.raises(ExportError, match="reserved"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_bad_name_characters_are_rejected() -> None:
    payload = _backup({"bad@name": {"twa": [0], "tws": [6]}})
    with pytest.raises(ExportError, match="alphanumeric"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_name_too_long_is_rejected() -> None:
    payload = _backup({"x" * 31: {"twa": [0], "tws": [6]}})
    with pytest.raises(ExportError, match="alphanumeric"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_twa_out_of_range_is_rejected() -> None:
    payload = _backup({"coastal": {"twa": [400], "tws": [6]}})
    with pytest.raises(ExportError, match="expected values 0-359"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_tws_over_live_max_is_rejected() -> None:
    payload = _backup({"coastal": {"twa": [0], "tws": [61]}})
    with pytest.raises(ExportError, match="expected values 1-60"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_bool_value_is_rejected_as_non_integer() -> None:
    payload = _backup({"coastal": {"twa": [True], "tws": [6]}})
    with pytest.raises(ExportError, match="expected integers"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_non_list_grid_is_rejected() -> None:
    payload = _backup({"coastal": {"twa": "0,45", "tws": [6]}})
    with pytest.raises(ExportError, match="must be a list"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_duplicate_normalized_name_is_rejected() -> None:
    payload = _backup({"coastal ": {"twa": [0], "tws": [6]}, " coastal": {"twa": [0], "tws": [6]}})
    with pytest.raises(ExportError, match="Duplicate preset name"):
        preset_backup.validate_presets(json.dumps(payload), MAX_TWS)


def test_oversize_payload_is_rejected() -> None:
    raw = "a" * (MAX_IMPORT_BYTES + 1)
    with pytest.raises(BackupError, match="too large"):
        preset_backup.validate_presets(raw, MAX_TWS)
