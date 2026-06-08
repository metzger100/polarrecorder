"""Module: Preset Backup - Strict presets backup serialization and validation.

Documentation: documentation/user/export-import.md
Depends: polarrecorder.export, polarrecorder.import_common
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from polarrecorder.export import (
    PRESET_SCHEMA_VERSION,
    TWA_GRID_MAX,
    ExportError,
    Preset,
    validate_grid_values,
    validate_preset_name,
)
from polarrecorder.import_common import check_unknown_keys, decode_object, is_int, require_dict

if TYPE_CHECKING:
    from collections.abc import Sequence

__all__ = ["serialize_presets", "validate_presets"]

TWA_GRID_LOWER = 0
TWS_GRID_LOWER = 1
_WHAT = "presets backup"
_TOP_LEVEL_KEYS = frozenset({"schema_version", "presets"})


def serialize_presets(presets: Sequence[Preset]) -> dict[str, object]:
    """Serialize user presets to the ``presets.json`` backup shape.

    Args:
        presets: The user presets to serialize. Built-ins must be excluded by
            the caller so the download round-trips through the importer.

    Returns:
        A backup object ``{schema_version, presets: {name: {twa, tws}}}``.
    """
    return {
        "schema_version": PRESET_SCHEMA_VERSION,
        "presets": {
            preset.name: {"twa": list(preset.twa), "tws": list(preset.tws)} for preset in presets
        },
    }


def validate_presets(raw: str, max_tws: int) -> list[Preset]:
    """Validate a presets backup string into a replacement set of user presets.

    Args:
        raw: The assembled presets backup text (a ``GET /api/export/presets`` body).
        max_tws: The live maximum TWS used to bound preset TWS values.

    Returns:
        The validated user presets that replace the current user-preset set.

    Raises:
        ExportError: If any preset name, value, or backup field is invalid.
        BackupError: If a shared size/JSON/object/key gate rejects the payload.
    """
    data = decode_object(raw, _WHAT)
    _check_provenance(data)
    _check_schema(data)
    check_unknown_keys(data, _TOP_LEVEL_KEYS, _WHAT)
    return _build_presets(require_dict(data["presets"], "presets"), max_tws)


def _check_provenance(data: dict[str, object]) -> None:
    if not is_int(data.get("schema_version")):
        msg = "This file is not a presets backup (missing schema version)"
        raise ExportError(msg)
    if not isinstance(data.get("presets"), dict):
        msg = "This file is not a presets backup (missing presets)"
        raise ExportError(msg)


def _check_schema(data: dict[str, object]) -> None:
    version = cast("int", data["schema_version"])
    if version > PRESET_SCHEMA_VERSION:
        msg = f"Presets backup schema version {version} is newer than this plugin supports"
        raise ExportError(msg)


def _build_presets(presets_obj: dict[str, object], max_tws: int) -> list[Preset]:
    presets: list[Preset] = []
    seen: set[str] = set()
    for raw_name, raw_entry in presets_obj.items():
        name = validate_preset_name(str(raw_name))
        if name in seen:
            msg = f"Duplicate preset name '{name}' in backup"
            raise ExportError(msg)
        seen.add(name)
        entry = require_dict(raw_entry, f"preset '{name}'")
        twa = validate_grid_values(
            "twa", _list(entry.get("twa"), name, "twa"), TWA_GRID_LOWER, TWA_GRID_MAX
        )
        tws = validate_grid_values(
            "tws", _list(entry.get("tws"), name, "tws"), TWS_GRID_LOWER, max_tws
        )
        presets.append(Preset(name=name, builtin=False, twa=twa, tws=tws))
    return presets


def _list(value: object, preset_name: str, field: str) -> list[object]:
    if not isinstance(value, list):
        msg = f"Preset '{preset_name}' field '{field}' must be a list"
        raise ExportError(msg)
    return value
