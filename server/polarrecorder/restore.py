"""Module: Restore - Strict polar backup validation and model rebuild.

Documentation: documentation/architecture/import-restore.md
Depends: polarrecorder.bins, polarrecorder.counters, polarrecorder.import_common,
polarrecorder.persistence, polarrecorder.polar_model
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import cast

from polarrecorder.bins import TWA_BIN_SIZE, TWS_BIN_MAX, TWS_BIN_SIZE, Bin
from polarrecorder.counters import Counters
from polarrecorder.import_common import (
    MAX_IMPORT_BYTES,
    BackupError,
    check_unknown_keys,
    decode_object,
    is_int,
    require_dict,
)
from polarrecorder.persistence import SchemaTooNewError, migrate_payload
from polarrecorder.polar_model import PolarModel

__all__ = [
    "MAX_IMPORT_BYTES",
    "RestoreError",
    "RestoreResult",
    "validate_and_build",
]

TWA_ADDRESS_MAX = 359
_WHAT = "Polar Recorder backup"
_TOP_LEVEL_KEYS = frozenset(
    {
        "schema_version",
        "plugin_version",
        "created_wall",
        "last_flush_wall",
        "config",
        "counters",
        "bins",
    }
)


class RestoreError(BackupError):
    """Raised when a polar backup fails strict, polar-specific validation."""


@dataclass(frozen=True)
class RestoreResult:
    """A validated polar backup ready to replace the live model and counters."""

    model: PolarModel
    counters: Counters
    created_wall: float | None
    last_flush_wall: float
    migrated_from_version: int
    bins_restored: int
    total_accepted: int


def validate_and_build(raw: str) -> RestoreResult:
    """Validate a polar backup string and build a model + counters from it.

    Args:
        raw: The assembled polar backup text (a ``GET /api/export/json`` body).

    Returns:
        A :class:`RestoreResult` carrying the rebuilt model, counters, and
        restore summary metadata.

    Raises:
        RestoreError: If the backup is malformed, foreign-grid, too new, or
            carries any out-of-range or wrongly-typed value.
        BackupError: If a shared size/JSON/object/key gate rejects the payload.
    """
    data = decode_object(raw, _WHAT)
    _check_provenance(data)
    original_version = cast("int", data["schema_version"])
    migrated = _migrate(data)
    check_unknown_keys(migrated, _TOP_LEVEL_KEYS, _WHAT)
    _check_grid(migrated)
    model = _build_model(require_dict(migrated["bins"], "bins"))
    counters = _build_counters(require_dict(migrated["counters"], "counters"))
    return RestoreResult(
        model=model,
        counters=counters,
        created_wall=_optional_finite(migrated.get("created_wall"), "created_wall"),
        last_flush_wall=_finite(migrated.get("last_flush_wall", 0.0), "last_flush_wall"),
        migrated_from_version=original_version,
        bins_restored=len(model.bins),
        total_accepted=counters.total_accepted,
    )


def _check_provenance(data: dict[str, object]) -> None:
    if not is_int(data.get("schema_version")):
        msg = "This file is not a Polar Recorder backup (missing schema version)"
        raise RestoreError(msg)
    config = require_dict(data.get("config"), "config")
    if "twa_bin_size" not in config or "tws_bin_size" not in config:
        msg = "This file is not a Polar Recorder backup (missing grid config)"
        raise RestoreError(msg)
    if not isinstance(data.get("bins"), dict):
        msg = "This file is not a Polar Recorder backup (missing bins)"
        raise RestoreError(msg)
    if not isinstance(data.get("counters"), dict):
        msg = "This file is not a Polar Recorder backup (missing counters)"
        raise RestoreError(msg)


def _migrate(data: dict[str, object]) -> dict[str, object]:
    try:
        return migrate_payload(data)
    except SchemaTooNewError as exc:
        msg = f"Backup schema version {exc.found} is newer than this plugin supports"
        raise RestoreError(msg) from exc


def _check_grid(data: dict[str, object]) -> None:
    config = require_dict(data["config"], "config")
    twa_size = config.get("twa_bin_size")
    tws_size = config.get("tws_bin_size")
    if not (twa_size == TWA_BIN_SIZE and tws_size == TWS_BIN_SIZE):
        msg = "Backup uses a different bin grid and cannot be imported on this build"
        raise RestoreError(msg)


def _build_model(bins: dict[str, object]) -> PolarModel:
    model = PolarModel()
    for raw_address, raw_bin in bins.items():
        address = _parse_address(raw_address)
        bin_data = require_dict(raw_bin, f"bin {raw_address!r}")
        model.bins[address] = Bin(
            twa_deg=address[0],
            tws_kt=address[1],
            histogram=_histogram(bin_data.get("histogram", {})),
            total_accepted=_count(bin_data, "total_accepted"),
            total_rejected=_count(bin_data, "total_rejected"),
            total_quarantined=_count(bin_data, "total_quarantined"),
            last_update_wall=_finite(bin_data.get("last_update_wall", 0.0), "last_update_wall"),
            rejection_histogram=_reason_histogram(bin_data.get("rejection_histogram", {})),
        )
    return model


def _build_counters(data: dict[str, object]) -> Counters:
    return Counters(
        total_seen=_count(data, "total_seen"),
        total_accepted=_count(data, "total_accepted"),
        total_rejected=_count(data, "total_rejected"),
        total_quarantined=_count(data, "total_quarantined"),
        rejection_histogram=_reason_histogram(data.get("rejection_histogram", {})),
    )


def _parse_address(raw_address: str) -> tuple[int, int]:
    parts = raw_address.split("_")
    if len(parts) != 2:  # noqa: PLR2004  # bin keys are exactly "{twa}_{tws}"
        msg = f"Bin address {raw_address!r} is malformed"
        raise RestoreError(msg)
    try:
        twa, tws = int(parts[0]), int(parts[1])
    except ValueError as exc:
        msg = f"Bin address {raw_address!r} is malformed"
        raise RestoreError(msg) from exc
    if not 0 <= twa <= TWA_ADDRESS_MAX:
        msg = f"Bin TWA {twa} is outside 0-{TWA_ADDRESS_MAX}"
        raise RestoreError(msg)
    if not 0 <= tws <= TWS_BIN_MAX:
        msg = f"Bin TWS {tws} is outside 0-{TWS_BIN_MAX}"
        raise RestoreError(msg)
    return twa, tws


def _histogram(value: object) -> dict[int, int]:
    raw = require_dict(value, "histogram")
    out: dict[int, int] = {}
    for key, count in raw.items():
        speed = _parse_int_key(key)
        if speed < 0:
            msg = f"Histogram speed {speed} must be non-negative"
            raise RestoreError(msg)
        out[speed] = _non_negative_int(count, "histogram count")
    return out


def _reason_histogram(value: object) -> dict[str, int]:
    raw = require_dict(value, "rejection_histogram")
    return {str(key): _non_negative_int(count, "rejection count") for key, count in raw.items()}


def _parse_int_key(key: str) -> int:
    try:
        return int(key)
    except ValueError as exc:
        msg = f"Histogram key {key!r} is not an integer"
        raise RestoreError(msg) from exc


def _count(data: dict[str, object], field: str) -> int:
    return _non_negative_int(data.get(field, 0), field)


def _non_negative_int(value: object, label: str) -> int:
    if not is_int(value):
        msg = f"{label} must be an integer"
        raise RestoreError(msg)
    number = cast("int", value)
    if number < 0:
        msg = f"{label} must be non-negative"
        raise RestoreError(msg)
    return number


def _finite(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        msg = f"{label} must be a number"
        raise RestoreError(msg)
    number = float(value)
    if not math.isfinite(number):
        msg = f"{label} must be a finite number"
        raise RestoreError(msg)
    return number


def _optional_finite(value: object, label: str) -> float | None:
    if value is None:
        return None
    return _finite(value, label)
