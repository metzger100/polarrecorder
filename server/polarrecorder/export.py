"""Module: Export - CSV export and preset persistence over pure projection.

Documentation: documentation/user/export-import.md
Depends: polarrecorder.coerce, polarrecorder.logger, polarrecorder.projection
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, cast

from polarrecorder.coerce import to_int
from polarrecorder.projection import (
    TWA_FOLD_MAX,
    TWA_FULL_CIRCLE,
    ProjectedCell,
    SnapshotBins,
    anchor_origin,
    project_grid,
)

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from polarrecorder.logger import Logger

# Re-exported so API handlers and tests keep addressing ``export.<name>``.
__all__ = [
    "TWA_FOLD_MAX",
    "TWA_FULL_CIRCLE",
    "ProjectedCell",
    "SnapshotBins",
    "anchor_origin",
    "project_grid",
    "to_int",
]

MIN_SAMPLES_DISPLAY = 3
PERCENTILE_MIN = 1
PERCENTILE_MAX = 99
PRESET_NAME_MAX_LENGTH = 30
PRESET_SCHEMA_VERSION = 1
PRESETS_NAME = "presets.json"
PRESETS_TMP_NAME = "presets.tmp.json"
WINDY_NAME = "windy"
DEFAULT_STARBOARD180_NAME = "DefaultStarboard180"
DEFAULT_PORT180_NAME = "DefaultPort180"
DEFAULT360_NAME = "Default360"
TWA_GRID_MAX = TWA_FULL_CIRCLE - 1
TWA_GRID_STEP = 15
WINDY_TWA = [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]
WINDY_TWS = [4, 6, 8, 10, 12, 14, 16, 20, 25]
DEFAULT_TWA_STARBOARD180 = list(range(0, TWA_FOLD_MAX + 1, TWA_GRID_STEP))
DEFAULT_TWA_PORT180 = list(range(TWA_FOLD_MAX, TWA_FULL_CIRCLE, TWA_GRID_STEP))
DEFAULT_TWA_360 = list(range(0, TWA_FULL_CIRCLE, TWA_GRID_STEP))
# Pre-rename selections persisted by AvNav still resolve to the starboard half.
LEGACY_PRESET_ALIASES = {"default180": DEFAULT_STARBOARD180_NAME.lower()}
NAME_PATTERN = re.compile(r"^[A-Za-z0-9 -]+$")


class ExportError(ValueError):
    """Raised when export or preset parameters are invalid."""


@dataclass(frozen=True)
class Preset:
    """Resolved export preset."""

    name: str
    builtin: bool
    twa: list[int]
    tws: list[int]


@dataclass(frozen=True)
class ExportSelection:
    """Resolved export grid and confidence floor."""

    name: str
    twa: list[int]
    tws: list[int]
    min_samples: int


def _builtin_presets() -> list[Preset]:
    """Return the ordered built-in presets (starboard 180 deg first as the default)."""
    return [
        Preset(
            DEFAULT_STARBOARD180_NAME,
            builtin=True,
            twa=list(DEFAULT_TWA_STARBOARD180),
            tws=list(WINDY_TWS),
        ),
        Preset(
            DEFAULT_PORT180_NAME,
            builtin=True,
            twa=list(DEFAULT_TWA_PORT180),
            tws=list(WINDY_TWS),
        ),
        Preset(DEFAULT360_NAME, builtin=True, twa=list(DEFAULT_TWA_360), tws=list(WINDY_TWS)),
        Preset(WINDY_NAME, builtin=True, twa=list(WINDY_TWA), tws=list(WINDY_TWS)),
    ]


def _builtin_by_name(name: str) -> Preset | None:
    lowered = name.strip().lower()
    target = LEGACY_PRESET_ALIASES.get(lowered, lowered)
    for preset in _builtin_presets():
        if preset.name.lower() == target:
            return preset
    return None


def _is_builtin_name(name: str) -> bool:
    return _builtin_by_name(name) is not None


def builtin_preset() -> Preset:
    """Return the default built-in preset (DefaultStarboard180)."""
    return _builtin_presets()[0]


def list_presets(data_dir: str | os.PathLike[str], logger: Logger | None = None) -> list[Preset]:
    """Return the built-in presets followed by sorted user presets from disk."""
    presets = _builtin_presets()
    for name, preset in sorted(_load_user_presets(data_dir, logger).items()):
        presets.append(Preset(name, builtin=False, twa=list(preset.twa), tws=list(preset.tws)))
    return presets


def save_preset(
    data_dir: str | os.PathLike[str],
    name: str,
    twa_text: str,
    tws_text: str,
    max_tws: int,
    logger: Logger | None = None,
) -> Preset:
    """Create or overwrite a user preset."""
    preset = Preset(
        name=_validate_name(name),
        builtin=False,
        twa=_parse_grid("twa", twa_text, 0, TWA_GRID_MAX),
        tws=_parse_grid("tws", tws_text, 1, max_tws),
    )
    presets = _load_user_presets(data_dir, logger)
    presets[preset.name] = preset
    _write_user_presets(data_dir, presets, logger)
    return preset


def delete_preset(
    data_dir: str | os.PathLike[str],
    name: str,
    confirm: str,
    logger: Logger | None = None,
) -> None:
    """Delete a user preset after confirmation."""
    if confirm != "yes":
        msg = "Invalid parameter 'confirm': expected 'yes'"
        raise ExportError(msg)
    trimmed = name.strip()
    if _is_builtin_name(trimmed):
        msg = f"Preset '{trimmed}' is built in and cannot be deleted"
        raise ExportError(msg)
    presets = _load_user_presets(data_dir, logger)
    if trimmed not in presets:
        msg = f"Unknown preset '{trimmed}'"
        raise ExportError(msg)
    del presets[trimmed]
    _write_user_presets(data_dir, presets, logger)


def replace_user_presets(
    data_dir: str | os.PathLike[str],
    presets: Sequence[Preset],
    logger: Logger | None = None,
) -> None:
    """Replace the entire user-preset set atomically with the given presets.

    Args:
        data_dir: Directory containing the presets persistence file.
        presets: The validated user presets to persist (built-ins excluded by
            the caller's validation, so they are never written).
        logger: Optional logger for write failures.
    """
    by_name = {preset.name: preset for preset in presets}
    _write_user_presets(data_dir, by_name, logger)


def resolve_polar_preset(
    data_dir: str | os.PathLike[str],
    args: Mapping[str, str],
    logger: Logger | None = None,
) -> Preset:
    """Resolve the named preset used by the polar diagram."""
    name = args.get("format", DEFAULT_STARBOARD180_NAME)
    builtin = _builtin_by_name(name)
    if builtin is not None:
        return builtin
    user = _load_user_presets(data_dir, logger).get(name)
    if user is None:
        msg = f"Unknown format '{name}'"
        raise ExportError(msg)
    return user


def resolve_export_selection(
    data_dir: str | os.PathLike[str],
    args: Mapping[str, str],
    max_tws: int,
    min_samples_for_export: int,
    logger: Logger | None = None,
) -> ExportSelection:
    """Resolve CSV export mode, grid, and confidence floor."""
    min_samples = _resolve_min_samples(args, min_samples_for_export)
    has_twa = "twa" in args
    has_tws = "tws" in args
    if "format" in args and (has_twa or has_tws):
        msg = "Invalid parameters: 'format' cannot be combined with 'twa' or 'tws'"
        raise ExportError(msg)
    if has_twa != has_tws:
        msg = "Invalid parameters: 'twa' and 'tws' must be supplied together"
        raise ExportError(msg)
    if has_twa and has_tws:
        return ExportSelection(
            "custom",
            _parse_grid("twa", args["twa"], 0, TWA_GRID_MAX),
            _parse_grid("tws", args["tws"], 1, max_tws),
            min_samples,
        )
    preset = resolve_polar_preset(data_dir, args, logger)
    return ExportSelection(preset.name, list(preset.twa), list(preset.tws), min_samples)


def parse_percentile(args: Mapping[str, str], default: int) -> int:
    """Parse an optional percentile query parameter."""
    raw = args.get("percentile")
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        msg = f"Invalid parameter 'percentile': expected integer 1-99, got {raw!r}"
        raise ExportError(msg) from exc
    if PERCENTILE_MIN <= value <= PERCENTILE_MAX:
        return value
    msg = f"Invalid parameter 'percentile': expected integer 1-99, got {raw!r}"
    raise ExportError(msg)


def csv_from_projection(
    projected: Mapping[tuple[int, int], ProjectedCell],
    twa_grid: Sequence[int],
    tws_grid: Sequence[int],
) -> str:
    """Format projected cells as Windy-compatible semicolon CSV."""
    rows = ["TWA\\TWS;" + ";".join(str(tws) for tws in tws_grid)]
    for twa in twa_grid:
        values = [str(twa)]
        for tws in tws_grid:
            cell = projected.get((twa, tws))
            values.append("" if cell is None else f"{cell.stw:.1f}")
        rows.append(";".join(values))
    return "\r\n".join(rows) + "\r\n"


def csv_export(
    model_bins: SnapshotBins,
    selection: ExportSelection,
    percentile: int,
) -> str:
    """Project model bins and return CSV text."""
    projected = anchor_origin(
        project_grid(
            model_bins,
            selection.twa,
            selection.tws,
            percentile,
            selection.min_samples,
        )
    )
    return csv_from_projection(projected, selection.twa, selection.tws)


def _resolve_min_samples(args: Mapping[str, str], min_samples_for_export: int) -> int:
    if args.get("high_confidence", "").lower() in {"yes", "true", "1"}:
        return min_samples_for_export
    return MIN_SAMPLES_DISPLAY


def validate_preset_name(name: str) -> str:
    """Validate and normalize a user preset name, rejecting reserved names.

    Args:
        name: The raw preset name from a query parameter or a backup key.

    Returns:
        The trimmed, validated name.

    Raises:
        ExportError: If the name is reserved/built-in, empty, too long, or uses
            characters outside the allowed pattern.
    """
    return _validate_name(name)


def validate_grid_values(
    name: str,
    values: Sequence[object],
    lower: int,
    upper: int,
) -> list[int]:
    """Validate an already-parsed grid list against an inclusive integer range.

    Args:
        name: Parameter name used in rejection messages ("twa" or "tws").
        values: Candidate grid values from a query split or a JSON array.
        lower: Inclusive lower bound.
        upper: Inclusive upper bound.

    Returns:
        The validated values, de-duplicated and sorted ascending.

    Raises:
        ExportError: If any value is not an ``int`` (``bool`` is rejected), is
            out of range, or the resulting set is empty.
    """
    validated: list[int] = []
    for value in values:
        if isinstance(value, bool) or not isinstance(value, int):
            msg = f"Invalid parameter '{name}': expected integers"
            raise ExportError(msg)
        if not lower <= value <= upper:
            msg = f"Invalid parameter '{name}': expected values {lower}-{upper}"
            raise ExportError(msg)
        validated.append(value)
    if not validated:
        msg = f"Invalid parameter '{name}': expected at least one value"
        raise ExportError(msg)
    return sorted(set(validated))


def _validate_name(name: str) -> str:
    trimmed = name.strip()
    if _is_builtin_name(trimmed):
        msg = f"Preset name '{trimmed}' is reserved"
        raise ExportError(msg)
    if not 1 <= len(trimmed) <= PRESET_NAME_MAX_LENGTH or NAME_PATTERN.fullmatch(trimmed) is None:
        msg = "Invalid parameter 'name': expected 1-30 alphanumeric, hyphen, or space chars"
        raise ExportError(msg)
    return trimmed


def _parse_grid(name: str, raw: str, lower: int, upper: int) -> list[int]:
    values: list[int] = []
    for part in raw.split(","):
        text = part.strip()
        if not text:
            continue
        try:
            values.append(int(text))
        except ValueError as exc:
            msg = f"Invalid parameter '{name}': expected comma-separated integers"
            raise ExportError(msg) from exc
    return validate_grid_values(name, values, lower, upper)


def _load_user_presets(
    data_dir: str | os.PathLike[str],
    logger: Logger | None,
) -> dict[str, Preset]:
    path = Path(data_dir) / PRESETS_NAME
    if not path.exists():
        _log_warn(logger, "presets.json is missing; using built-in presets only")
        return {}
    try:
        decoded = json.loads(path.read_text(encoding="utf-8"))
        data = cast("dict[str, object]", decoded)
        if to_int(data.get("schema_version", 0)) > PRESET_SCHEMA_VERSION:
            _log_warn(logger, "presets.json schema is too new; discarding user presets")
            return {}
        raw_presets = data.get("presets", {})
        return _decode_presets(_require_presets_dict(raw_presets))
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        _log_warn(logger, f"presets.json is corrupt; using built-in presets only: {exc}")
        return {}


def _decode_presets(raw_presets: dict[object, object]) -> dict[str, Preset]:
    presets: dict[str, Preset] = {}
    for raw_name, raw_preset in raw_presets.items():
        if not isinstance(raw_preset, dict):
            continue
        name = str(raw_name)
        twa = _int_list(raw_preset.get("twa", []))
        tws = _int_list(raw_preset.get("tws", []))
        if twa and tws and not _is_builtin_name(name):
            presets[name] = Preset(name, builtin=False, twa=sorted(twa), tws=sorted(tws))
    return presets


def _require_presets_dict(raw_presets: object) -> dict[object, object]:
    if isinstance(raw_presets, dict):
        return raw_presets
    msg = "presets block is not an object"
    raise TypeError(msg)


def _write_user_presets(
    data_dir: str | os.PathLike[str],
    presets: Mapping[str, Preset],
    logger: Logger | None,
) -> None:
    root = Path(data_dir)
    path = root / PRESETS_NAME
    tmp = root / PRESETS_TMP_NAME
    payload = {
        "schema_version": PRESET_SCHEMA_VERSION,
        "presets": {
            name: {"twa": list(preset.twa), "tws": list(preset.tws)}
            for name, preset in sorted(presets.items())
        },
    }
    text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    try:
        root.mkdir(parents=True, exist_ok=True)
        with tmp.open("w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        tmp.replace(path)
    except OSError as exc:
        _cleanup_tmp(tmp, logger)
        msg = f"Failed to save presets.json: {exc}"
        raise ExportError(msg) from exc


def _int_list(raw: object) -> list[int]:
    if not isinstance(raw, list):
        return []
    return [to_int(item) for item in raw]


def _cleanup_tmp(path: Path, logger: Logger | None) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        _log_warn(logger, f"Could not remove presets temp file: {exc}")


def _log_warn(logger: Logger | None, message: str) -> None:
    if logger is not None:
        logger.warning(message)
