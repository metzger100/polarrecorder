from __future__ import annotations

import json
import os
from typing import TYPE_CHECKING, Any

from polarrecorder import persistence
from polarrecorder.counters import Counters
from polarrecorder.persistence import PersistenceMetadata
from polarrecorder.polar_model import PolarModel
from polarrecorder.sample import Freshness, Sample

if TYPE_CHECKING:
    from pathlib import Path


class CapturingLogger:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []

    def info(self, msg: str) -> None:
        self.messages.append(("info", msg))

    def warn(self, msg: str) -> None:
        self.messages.append(("warn", msg))

    def debug(self, msg: str) -> None:
        self.messages.append(("debug", msg))

    def error(self, msg: str) -> None:
        self.messages.append(("error", msg))


def make_sample(
    twa_deg_raw: float = 90.0,
    tws_kt: float = 12.0,
    stw_kt: float = 5.8,
    timestamp_wall: float = 1000.0,
) -> Sample:
    return Sample(
        timestamp_monotonic=100.0,
        timestamp_wall=timestamp_wall,
        twa_deg_raw=twa_deg_raw,
        twa_deg_abs=min(twa_deg_raw, 360.0 - twa_deg_raw),
        twa_deg_signed=twa_deg_raw if twa_deg_raw <= 180.0 else twa_deg_raw - 360.0,
        tws_ms=0.0,
        tws_kt=tws_kt,
        stw_ms=0.0,
        stw_kt=stw_kt,
        freshness=Freshness(
            twa_age_s=0.1,
            tws_age_s=0.2,
            stw_age_s=0.3,
            max_age_s=0.3,
            age_skew_s=0.2,
        ),
        enhanced=None,
    )


def populated_model() -> PolarModel:
    model = PolarModel()
    model.update_accepted(make_sample(stw_kt=5.8, timestamp_wall=1000.0))
    model.update_accepted(make_sample(stw_kt=6.0, timestamp_wall=1001.0))
    model.record_rejection(make_sample(), ["reject_unstable"])
    model.record_quarantine(make_sample(twa_deg_raw=120.0), "quarantine_engine_suspected")
    return model


def populated_counters() -> Counters:
    counters = Counters()
    counters.record_accepted()
    counters.record_rejected(["reject_unstable"])
    counters.record_quarantined("quarantine_engine_suspected")
    counters.record_non_candidate(["reject_low_wind"])
    return counters


def metadata(last_flush_wall: float = 2000.0) -> PersistenceMetadata:
    return PersistenceMetadata(
        plugin_version="1.0.0",
        created_wall=1234.0,
        last_flush_wall=last_flush_wall,
        percentile=65,
        max_tws=60,
    )


def test_round_trip_restores_model_counters_and_integer_keys(tmp_path: Path) -> None:
    model = populated_model()
    counters = populated_counters()

    saved_size = persistence.save(tmp_path, model, counters, metadata())
    result = persistence.load(tmp_path)

    assert saved_size is not None
    assert result.status == "loaded"
    assert result.created_wall == 1234.0
    assert result.last_flush_wall == 2000.0
    assert result.file_size_bytes == saved_size
    assert result.model.snapshot_bins() == model.snapshot_bins()
    assert result.counters.to_dict() == counters.to_dict()
    assert result.model.bins[(90, 12)].histogram == {58: 1, 60: 1}
    assert all(isinstance(key, int) for key in result.model.bins[(90, 12)].histogram)


def test_corrupt_primary_falls_back_to_backup(tmp_path: Path) -> None:
    logger = CapturingLogger()
    first = persistence.serialize_to_dict(populated_model(), populated_counters(), metadata())
    second = persistence.serialize_to_dict(PolarModel(), Counters(), metadata(3000.0))
    assert persistence.save(tmp_path, first) is not None
    assert persistence.save(tmp_path, second) is not None
    (tmp_path / persistence.PRIMARY_NAME).write_text("{not-json", encoding="utf-8")

    result = persistence.load(tmp_path, logger)

    assert result.status == "recovered_backup"
    assert result.last_flush_wall == 2000.0
    assert result.model.snapshot_bins() == populated_model().snapshot_bins()
    assert ("warn", "polar.json unavailable; recovered polar.backup.json") in logger.messages


def test_both_corrupt_returns_empty_model_and_logs_error(tmp_path: Path) -> None:
    logger = CapturingLogger()
    (tmp_path / persistence.PRIMARY_NAME).write_text("{bad", encoding="utf-8")
    (tmp_path / persistence.BACKUP_NAME).write_text("{bad", encoding="utf-8")

    result = persistence.load(tmp_path, logger)

    assert result.status == "corrupt_empty"
    assert result.last_flush_wall == 0.0
    assert result.model.bins == {}
    assert result.counters.to_dict() == Counters().to_dict()
    assert any(level == "error" and "starting empty" in msg for level, msg in logger.messages)


def test_atomic_write_promotes_primary_to_backup_and_removes_tmp(tmp_path: Path) -> None:
    first = persistence.serialize_to_dict(populated_model(), populated_counters(), metadata())
    second = persistence.serialize_to_dict(PolarModel(), Counters(), metadata(3000.0))

    assert persistence.save(tmp_path, first) is not None
    assert persistence.save(tmp_path, second) is not None

    primary_data = json.loads((tmp_path / persistence.PRIMARY_NAME).read_text(encoding="utf-8"))
    backup_data = json.loads((tmp_path / persistence.BACKUP_NAME).read_text(encoding="utf-8"))
    assert not (tmp_path / persistence.TMP_NAME).exists()
    assert primary_data["last_flush_wall"] == 3000.0
    assert backup_data["last_flush_wall"] == 2000.0


def test_schema_zero_migration_loads_and_fills_defaults(tmp_path: Path) -> None:
    v0_payload: dict[str, Any] = {
        "schema_version": 0,
        "bins": {
            "90_12": {
                "histogram": {"58": 2},
                "total_accepted": 2,
                "last_update_wall": 1000.0,
            }
        },
    }
    (tmp_path / persistence.PRIMARY_NAME).write_text(json.dumps(v0_payload), encoding="utf-8")

    result = persistence.load(tmp_path)
    migrated = persistence._migrate(v0_payload)

    assert result.status == "loaded"
    assert result.model.bins[(90, 12)].histogram == {58: 2}
    assert migrated["schema_version"] == 1
    assert migrated["config"] == {
        "percentile": 65,
        "twa_bin_size": 1,
        "tws_bin_size": 1,
        "max_tws": 60,
    }


def test_schema_too_new_returns_empty_model_and_surfaces_message(tmp_path: Path) -> None:
    payload = persistence.serialize_to_dict(populated_model(), populated_counters(), metadata())
    payload["schema_version"] = persistence.CURRENT_SCHEMA_VERSION + 1
    (tmp_path / persistence.PRIMARY_NAME).write_text(json.dumps(payload), encoding="utf-8")

    result = persistence.load(tmp_path)

    assert result.status == "schema_too_new"
    assert result.last_flush_wall == 0.0
    assert result.model.bins == {}
    assert "schema version" in result.status_message


def test_fresh_load_exposes_zero_last_flush_wall(tmp_path: Path) -> None:
    result = persistence.load(tmp_path)

    assert result.status == "fresh"
    assert result.last_flush_wall == 0.0


def test_malformed_last_flush_wall_recovers_from_backup(tmp_path: Path) -> None:
    backup_payload = persistence.serialize_to_dict(
        populated_model(),
        populated_counters(),
        metadata(),
    )
    primary_payload = persistence.serialize_to_dict(PolarModel(), Counters(), metadata(3000.0))
    primary_payload["last_flush_wall"] = {"not": "a-float"}
    (tmp_path / persistence.BACKUP_NAME).write_text(json.dumps(backup_payload), encoding="utf-8")
    (tmp_path / persistence.PRIMARY_NAME).write_text(json.dumps(primary_payload), encoding="utf-8")

    result = persistence.load(tmp_path)

    assert result.status == "recovered_backup"
    assert result.last_flush_wall == 2000.0


def test_malformed_last_flush_wall_without_backup_returns_empty(tmp_path: Path) -> None:
    payload = persistence.serialize_to_dict(populated_model(), populated_counters(), metadata())
    payload["last_flush_wall"] = {"not": "a-float"}
    (tmp_path / persistence.PRIMARY_NAME).write_text(json.dumps(payload), encoding="utf-8")

    result = persistence.load(tmp_path)

    assert result.status == "corrupt_empty"
    assert result.last_flush_wall == 0.0


def test_save_handles_makedirs_failure_without_raising(
    tmp_path: Path,
    monkeypatch: Any,
) -> None:
    logger = CapturingLogger()

    def fail_makedirs(path: object, exist_ok: bool = False) -> None:
        raise OSError("read-only filesystem")

    monkeypatch.setattr(os, "makedirs", fail_makedirs)

    saved_size = persistence.save(
        tmp_path,
        populated_model(),
        populated_counters(),
        metadata(),
        logger,
    )

    assert saved_size is None
    assert not (tmp_path / persistence.TMP_NAME).exists()
    assert any("read-only filesystem" in msg for level, msg in logger.messages if level == "error")
