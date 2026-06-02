"""Module: Persistence - JSON persistence for polar model data.

Documentation: documentation/architecture/persistence.md
Depends: polarrecorder.bins, polarrecorder.counters, polarrecorder.polar_model
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Literal, cast

from polarrecorder.bins import TWA_BIN_SIZE, TWS_BIN_SIZE, Bin
from polarrecorder.counters import Counters
from polarrecorder.polar_model import PolarModel

if TYPE_CHECKING:
    from collections.abc import Callable

    from polarrecorder.logger import Logger

CURRENT_SCHEMA_VERSION = 1
DEFAULT_PERCENTILE = 65
DEFAULT_MAX_TWS = 60
PRIMARY_NAME = "polar.json"
BACKUP_NAME = "polar.backup.json"
TMP_NAME = "polar.tmp.json"

SerializedDict = dict[str, object]
LoadStatus = Literal["loaded", "recovered_backup", "fresh", "corrupt_empty", "schema_too_new"]


@dataclass(frozen=True)
class PersistenceMetadata:
    """Metadata supplied by the integration boundary when serializing."""

    schema_version: int = CURRENT_SCHEMA_VERSION
    plugin_version: str = ""
    created_wall: float | None = None
    last_flush_wall: float = 0.0
    percentile: int = DEFAULT_PERCENTILE
    max_tws: int = DEFAULT_MAX_TWS


@dataclass(frozen=True)
class LoadResult:
    """Result of a corruption-tolerant persistence load."""

    model: PolarModel
    counters: Counters
    created_wall: float | None
    last_flush_wall: float
    file_size_bytes: int
    status: LoadStatus
    status_message: str


@dataclass(frozen=True)
class _ReadResult:
    data: SerializedDict | None
    size_bytes: int
    status: Literal["loaded", "missing", "corrupt", "schema_too_new"]
    message: str


class _SchemaTooNewError(Exception):
    def __init__(self, found: int) -> None:
        super().__init__(
            f"polar.json has schema version {found}, "
            f"this plugin supports up to {CURRENT_SCHEMA_VERSION}"
        )
        self.found = found


def serialize_to_dict(
    model: PolarModel,
    counters: Counters,
    metadata: PersistenceMetadata,
) -> SerializedDict:
    """Serialize live model data to the canonical persistence schema."""
    return {
        "schema_version": metadata.schema_version,
        "plugin_version": metadata.plugin_version,
        "created_wall": metadata.created_wall,
        "last_flush_wall": metadata.last_flush_wall,
        "config": {
            "percentile": metadata.percentile,
            "twa_bin_size": TWA_BIN_SIZE,
            "tws_bin_size": TWS_BIN_SIZE,
            "max_tws": metadata.max_tws,
        },
        "counters": counters.to_dict(),
        "bins": {
            f"{address[0]}_{address[1]}": _bin_to_dict(model_bin)
            for address, model_bin in sorted(model.iter_bins())
        },
    }


def save(
    data_dir: str | os.PathLike[str],
    payload: SerializedDict | PolarModel,
    counters: Counters | None = None,
    metadata: PersistenceMetadata | None = None,
    logger: Logger | None = None,
) -> int | None:
    """Serialize and atomically save polar data.

    Args:
        data_dir: Directory containing the polar persistence files.
        payload: Either an already serialized dict or the live model to serialize.
        counters: Required when payload is a model.
        metadata: Required when payload is a model.
        logger: Optional logger for write failures.

    Returns:
        The UTF-8 byte length of the serialized JSON on success, otherwise None.
    """
    serialized = _payload_to_dict(payload, counters, metadata)
    json_text = json.dumps(serialized, sort_keys=True, separators=(",", ":"))
    size_bytes = len(json_text.encode("utf-8"))
    paths = _paths(data_dir)
    try:
        paths.data_dir.mkdir(parents=True, exist_ok=True)
        with paths.tmp.open("w", encoding="utf-8") as handle:
            handle.write(json_text)
            handle.flush()
            os.fsync(handle.fileno())
        if paths.primary.exists():
            paths.primary.replace(paths.backup)
        paths.tmp.replace(paths.primary)
    except OSError as exc:
        _log_error(logger, f"Failed to save polar.json: {exc}")
        _cleanup_tmp(paths.tmp, logger)
        return None
    return size_bytes


def load(data_dir: str | os.PathLike[str], logger: Logger | None = None) -> LoadResult:
    """Load polar data with backup recovery and schema checks."""
    paths = _paths(data_dir)
    primary = _read_payload(paths.primary)
    result: LoadResult | None = None
    if primary.status == "loaded" and primary.data is not None:
        result = _load_from_data(primary.data, primary.size_bytes, "loaded", "Loaded polar.json")
    elif primary.status == "schema_too_new":
        _log_error(logger, primary.message)
        result = _empty_result("schema_too_new", primary.message)
    else:
        primary_status = cast("Literal['missing', 'corrupt']", primary.status)
        result = _load_backup_or_empty(paths.backup, primary_status, logger)
    return result


def _load_backup_or_empty(
    backup_path: Path,
    primary_status: Literal["missing", "corrupt"],
    logger: Logger | None,
) -> LoadResult:
    backup = _read_payload(backup_path)
    if backup.status == "loaded" and backup.data is not None:
        _log_warn(logger, "polar.json unavailable; recovered polar.backup.json")
        return _load_from_data(
            backup.data,
            backup.size_bytes,
            "recovered_backup",
            "Recovered polar.backup.json",
        )
    if backup.status == "schema_too_new":
        _log_error(logger, backup.message)
        return _empty_result("schema_too_new", backup.message)
    if primary_status == "missing" and backup.status == "missing":
        return _empty_result("fresh", "No polar persistence files found")
    return _corrupt_empty(logger)


def _corrupt_empty(logger: Logger | None) -> LoadResult:
    message = "polar.json and polar.backup.json are missing or corrupt; starting empty"
    _log_error(logger, message)
    return _empty_result("corrupt_empty", message)


@dataclass(frozen=True)
class _PersistencePaths:
    data_dir: Path
    primary: Path
    backup: Path
    tmp: Path


def _paths(data_dir: str | os.PathLike[str]) -> _PersistencePaths:
    root = Path(data_dir)
    return _PersistencePaths(
        data_dir=root,
        primary=root / PRIMARY_NAME,
        backup=root / BACKUP_NAME,
        tmp=root / TMP_NAME,
    )


def _payload_to_dict(
    payload: SerializedDict | PolarModel,
    counters: Counters | None,
    metadata: PersistenceMetadata | None,
) -> SerializedDict:
    if isinstance(payload, PolarModel):
        if counters is None or metadata is None:
            msg = "counters and metadata are required when saving a PolarModel"
            raise ValueError(msg)
        return serialize_to_dict(payload, counters, metadata)
    return payload


def _bin_to_dict(model_bin: Bin) -> SerializedDict:
    return {
        "histogram": dict(model_bin.histogram),
        "total_accepted": model_bin.total_accepted,
        "total_rejected": model_bin.total_rejected,
        "total_quarantined": model_bin.total_quarantined,
        "last_update_wall": model_bin.last_update_wall,
        "rejection_histogram": dict(model_bin.rejection_histogram),
    }


def _read_payload(path: Path) -> _ReadResult:
    if not path.exists():
        return _ReadResult(None, 0, "missing", f"{path.name} is missing")
    try:
        raw_text = path.read_text(encoding="utf-8")
        decoded = json.loads(raw_text)
        migrated = _migrate(_require_serialized_dict(decoded, path))
        _validate_payload(migrated)
    except _SchemaTooNewError as exc:
        return _ReadResult(None, 0, "schema_too_new", str(exc))
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        return _ReadResult(None, 0, "corrupt", f"{path.name} is corrupt: {exc}")
    return _ReadResult(migrated, len(raw_text.encode("utf-8")), "loaded", f"Loaded {path.name}")


def _require_serialized_dict(decoded: object, path: Path) -> SerializedDict:
    if isinstance(decoded, dict):
        return cast("SerializedDict", decoded)
    msg = f"{path.name} does not contain a JSON object"
    raise TypeError(msg)


def _migrate(data: SerializedDict) -> SerializedDict:
    version = _to_int(data.get("schema_version", 0))
    if version > CURRENT_SCHEMA_VERSION:
        raise _SchemaTooNewError(version)
    migrated = dict(data)
    while version < CURRENT_SCHEMA_VERSION:
        migration = _MIGRATIONS[version]
        migrated = migration(migrated)
        version = _to_int(migrated["schema_version"])
    return migrated


def _migrate_v0_to_v1(data: SerializedDict) -> SerializedDict:
    migrated = dict(data)
    config = _dict_field(migrated, "config")
    config.setdefault("percentile", DEFAULT_PERCENTILE)
    config.setdefault("twa_bin_size", TWA_BIN_SIZE)
    config.setdefault("tws_bin_size", TWS_BIN_SIZE)
    config.setdefault("max_tws", DEFAULT_MAX_TWS)
    migrated["schema_version"] = 1
    migrated.setdefault("plugin_version", "")
    migrated.setdefault("created_wall", None)
    migrated.setdefault("last_flush_wall", 0.0)
    migrated["config"] = config
    migrated.setdefault("counters", Counters().to_dict())
    migrated.setdefault("bins", {})
    return migrated


_MIGRATIONS: dict[int, Callable[[SerializedDict], SerializedDict]] = {0: _migrate_v0_to_v1}


def _load_from_data(
    data: SerializedDict,
    size_bytes: int,
    status: LoadStatus,
    message: str,
) -> LoadResult:
    model = _model_from_dict(data.get("bins", {}))
    return LoadResult(
        model=model,
        counters=Counters.from_dict(data.get("counters", {})),
        created_wall=_optional_float(data.get("created_wall")),
        last_flush_wall=_to_float(data.get("last_flush_wall", 0.0)),
        file_size_bytes=size_bytes,
        status=status,
        status_message=message,
    )


def _validate_payload(data: SerializedDict) -> None:
    _model_from_dict(data.get("bins", {}))
    Counters.from_dict(data.get("counters", {}))
    _optional_float(data.get("created_wall"))
    _to_float(data.get("last_flush_wall", 0.0))


def _empty_result(status: LoadStatus, message: str) -> LoadResult:
    return LoadResult(
        model=PolarModel(),
        counters=Counters(),
        created_wall=None,
        last_flush_wall=0.0,
        file_size_bytes=0,
        status=status,
        status_message=message,
    )


def _model_from_dict(data: object) -> PolarModel:
    model = PolarModel()
    if not isinstance(data, dict):
        return model
    for raw_address, raw_bin in data.items():
        if not isinstance(raw_bin, dict):
            msg = f"bin {raw_address!r} is not an object"
            raise TypeError(msg)
        address = _parse_address(str(raw_address))
        bin_data = cast("dict[object, object]", raw_bin)
        model.bins[address] = Bin(
            twa_deg=address[0],
            tws_kt=address[1],
            histogram=_int_histogram(bin_data.get("histogram", {})),
            total_accepted=_int_field(bin_data, "total_accepted"),
            total_rejected=_int_field(bin_data, "total_rejected"),
            total_quarantined=_int_field(bin_data, "total_quarantined"),
            last_update_wall=_to_float(bin_data.get("last_update_wall", 0.0)),
            rejection_histogram=_str_int_histogram(bin_data.get("rejection_histogram", {})),
        )
    return model


def _parse_address(raw_address: str) -> tuple[int, int]:
    twa_text, tws_text = raw_address.split("_", 1)
    return _to_int(twa_text), _to_int(tws_text)


def _int_histogram(data: object) -> dict[int, int]:
    if not isinstance(data, dict):
        return {}
    return {_to_int(key): _to_int(value) for key, value in data.items()}


def _str_int_histogram(data: object) -> dict[str, int]:
    if not isinstance(data, dict):
        return {}
    return {str(key): _to_int(value) for key, value in data.items()}


def _dict_field(data: SerializedDict, key: str) -> SerializedDict:
    value = data.get(key, {})
    if not isinstance(value, dict):
        return {}
    return cast("SerializedDict", dict(value))


def _int_field(data: dict[object, object], key: str) -> int:
    return _to_int(data.get(key, 0))


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    return _to_float(value)


def _to_int(value: object) -> int:
    if isinstance(value, (str, bytes, bytearray, int, float)):
        return int(value)
    msg = f"Expected int-compatible value, got {type(value).__name__}"
    raise TypeError(msg)


def _to_float(value: object) -> float:
    if isinstance(value, (str, bytes, bytearray, int, float)):
        return float(value)
    msg = f"Expected float-compatible value, got {type(value).__name__}"
    raise TypeError(msg)


def _cleanup_tmp(path: Path, logger: Logger | None) -> None:
    try:
        if path.exists():
            path.unlink()
    except OSError as exc:
        _log_error(logger, f"Failed to clean up polar.tmp.json: {exc}")


def _log_warn(logger: Logger | None, msg: str) -> None:
    if logger is not None:
        logger.warning(msg)


def _log_error(logger: Logger | None, msg: str) -> None:
    if logger is not None:
        logger.error(msg)
