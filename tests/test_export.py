from __future__ import annotations

import json
from typing import TYPE_CHECKING

from conftest import FakeLogger
from polarrecorder import export

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path


def test_builtin_preset_values_are_exact(tmp_path: Path) -> None:
    presets = {preset.name: preset for preset in export.list_presets(tmp_path)}

    shared_tws = [4, 6, 8, 10, 12, 14, 16, 20, 25]

    starboard = presets["DefaultStarboard180"]
    assert starboard.builtin is True
    assert starboard.twa == list(range(0, 181, 15))
    assert starboard.tws == shared_tws

    port = presets["DefaultPort180"]
    assert port.builtin is True
    assert port.twa == list(range(180, 360, 15))
    assert port.tws == shared_tws

    default360 = presets["Default360"]
    assert default360.builtin is True
    assert default360.twa == list(range(0, 360, 15))
    assert default360.tws == shared_tws

    windy = presets["windy"]
    assert windy.builtin is True
    assert windy.twa == [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]
    assert windy.tws == shared_tws

    # builtin_preset() resolves the default view (DefaultStarboard180).
    assert export.builtin_preset().name == "DefaultStarboard180"


def test_resolve_polar_preset_defaults_to_starboard180(tmp_path: Path) -> None:
    def resolved(args: dict[str, str]) -> str:
        return export.resolve_polar_preset(tmp_path, args).name

    assert resolved({}) == "DefaultStarboard180"
    assert resolved({"format": "DefaultPort180"}) == "DefaultPort180"
    assert resolved({"format": "Default360"}) == "Default360"
    assert resolved({"format": "windy"}) == "windy"
    # Pre-rename selections persisted by AvNav still resolve to the starboard half.
    assert resolved({"format": "Default180"}) == "DefaultStarboard180"


def test_projection_does_not_fold_port_bins_into_starboard() -> None:
    bins = {
        (30, 4): {"histogram": {50: 2}},
        (330, 4): {"histogram": {60: 1}},
    }

    # A 180 deg grid is starboard-only: the 30 deg bin projects on its own and the
    # 330 deg port bin is excluded instead of being mirrored onto 30 deg.
    starboard = export.project_grid(bins, [30], [4], percentile=65, min_samples=1)
    assert starboard[(30, 4)] == export.ProjectedCell(stw=5.0, samples=2)

    # A circular grid containing the port angle keeps starboard and port separate.
    circular = export.project_grid(bins, [30, 330], [4], percentile=65, min_samples=1)
    assert circular[(30, 4)] == export.ProjectedCell(stw=5.0, samples=2)
    assert circular[(330, 4)] == export.ProjectedCell(stw=6.0, samples=1)


def test_port_grid_excludes_starboard_bins() -> None:
    bins = {
        (30, 4): {"histogram": {50: 2}},
        (270, 4): {"histogram": {60: 3}},
    }

    # A port-only (180-360 deg) grid is the mirror of the starboard half: it keeps
    # the 270 deg bin and excludes the 30 deg starboard bin instead of pulling it
    # onto the nearest port column.
    port = export.project_grid(bins, [180, 270, 345], [4], percentile=65, min_samples=1)
    assert port[(270, 4)] == export.ProjectedCell(stw=6.0, samples=3)
    assert (30, 4) not in port
    assert all(twa >= 180 for twa, _tws in port)


def test_circular_projection_assigns_nearest_grid_point_across_wrap() -> None:
    grid = list(range(0, 360, 15))
    bins = {
        (358, 6): {"histogram": {50: 2}},
        (5, 6): {"histogram": {50: 1}},
        (185, 6): {"histogram": {60: 2}},
        (175, 6): {"histogram": {60: 1}},
    }

    projected = export.project_grid(bins, grid, [6], percentile=65, min_samples=1)

    # 358 deg and 5 deg both wrap onto the 0 deg grid point across 360 deg/0 deg.
    assert projected[(0, 6)].samples == 3
    # 175 deg and 185 deg share the single 180 deg dead-downwind sector.
    assert projected[(180, 6)].samples == 3
    assert (358, 6) not in projected
    assert (185, 6) not in projected


def test_csv_format_is_semicolon_crlf_and_blank_for_missing_cells() -> None:
    projected = {(0, 4): export.ProjectedCell(stw=5.04, samples=4)}

    csv = export.csv_from_projection(projected, [0, 30], [4, 6])

    assert csv == "TWA\\TWS;4;6\r\n0;5.0;\r\n30;;\r\n"
    assert ";\r\n" in csv


def test_anchor_origin_adds_zero_stw_to_populated_bands_only() -> None:
    projected = {(90, 12): export.ProjectedCell(stw=6.0, samples=3)}

    anchored = export.anchor_origin(projected)

    # The populated 12 kt band gains a 0 deg / 0 STW origin cell and nothing else.
    assert anchored[(0, 12)] == export.ProjectedCell(stw=0.0, samples=0)
    assert anchored[(90, 12)] == export.ProjectedCell(stw=6.0, samples=3)
    assert len(anchored) == 2


def test_anchor_origin_preserves_real_zero_twa_cell() -> None:
    projected = {(0, 12): export.ProjectedCell(stw=1.5, samples=4)}

    # Genuine data at 0 deg is never overwritten by the anchor.
    assert export.anchor_origin(projected)[(0, 12)] == export.ProjectedCell(stw=1.5, samples=4)


def test_csv_export_emits_zero_stw_origin_row_for_populated_bands() -> None:
    bins = {(90, 12): {"histogram": {60: 3}}}
    selection = export.ExportSelection("custom", [0, 90], [8, 12], 3)

    csv = export.csv_export(bins, selection, percentile=65)

    # Only the populated 12 kt band gets 0.0 at TWA 0; the empty 8 kt column and
    # every cell without data stay blank.
    assert csv == "TWA\\TWS;8;12\r\n0;;0.0\r\n90;;6.0\r\n"


def test_csv_export_emits_rows_above_180_for_circular_grid() -> None:
    bins = {
        (90, 12): {"histogram": {60: 3}},
        (270, 12): {"histogram": {50: 3}},
    }
    selection = export.ExportSelection("custom", [0, 90, 180, 270], [12], 3)

    csv = export.csv_export(bins, selection, percentile=65)

    # The 270 deg port bin emits its own row above 180 deg instead of folding onto 90 deg.
    assert csv == "TWA\\TWS;12\r\n0;0.0\r\n90;6.0\r\n180;\r\n270;5.0\r\n"


def test_preset_save_load_delete_round_trip(tmp_path: Path) -> None:
    saved = export.save_preset(tmp_path, "my plan", "90,0", "8,4", max_tws=20)

    assert saved.twa == [0, 90]
    assert saved.tws == [4, 8]
    assert [preset.name for preset in export.list_presets(tmp_path)] == [
        "DefaultStarboard180",
        "DefaultPort180",
        "Default360",
        "windy",
        "my plan",
    ]

    export.delete_preset(tmp_path, "my plan", "yes")

    assert [preset.name for preset in export.list_presets(tmp_path)] == [
        "DefaultStarboard180",
        "DefaultPort180",
        "Default360",
        "windy",
    ]


def test_reserved_builtin_names_save_and_delete_are_rejected(tmp_path: Path) -> None:
    reserved_names = (
        "Windy",
        "defaultstarboard180",
        "defaultport180",
        "DEFAULT360",
        "default180",
    )
    for reserved in reserved_names:

        def save_reserved(name: str = reserved) -> object:
            return export.save_preset(tmp_path, name, "0", "4", max_tws=20)

        def delete_reserved(name: str = reserved) -> object:
            export.delete_preset(tmp_path, name, "yes")
            return None

        _assert_export_error(save_reserved)
        _assert_export_error(delete_reserved)


def test_corrupt_and_schema_too_new_presets_recover_empty(tmp_path: Path) -> None:
    logger = FakeLogger()
    presets_path = tmp_path / export.PRESETS_NAME
    presets_path.write_text("{bad", encoding="utf-8")

    assert [preset.name for preset in export.list_presets(tmp_path, logger)] == [
        "DefaultStarboard180",
        "DefaultPort180",
        "Default360",
        "windy",
    ]
    assert any("corrupt" in message for level, message in logger.messages if level == "warn")

    presets_path.write_text(
        json.dumps({"schema_version": export.PRESET_SCHEMA_VERSION + 1, "presets": {}}),
        encoding="utf-8",
    )
    assert [preset.name for preset in export.list_presets(tmp_path, logger)] == [
        "DefaultStarboard180",
        "DefaultPort180",
        "Default360",
        "windy",
    ]
    assert any("too new" in message for level, message in logger.messages if level == "warn")


def test_name_and_grid_validation(tmp_path: Path) -> None:
    invalid = [
        ("", "0", "4"),
        ("bad_name", "0", "4"),
        ("valid", "", "4"),
        ("valid", "360", "4"),
        ("valid", "0", "0"),
        ("valid", "0", "99"),
    ]
    for name, twa, tws in invalid:
        try:
            export.save_preset(tmp_path, name, twa, tws, max_tws=20)
        except export.ExportError:
            continue
        msg = "expected ExportError"
        raise AssertionError(msg)

    # TWA values up to 359 deg are now accepted so circular grids are storable.
    saved = export.save_preset(tmp_path, "wide", "0,210,359", "4", max_tws=20)
    assert saved.twa == [0, 210, 359]


def test_format_resolution_default_preset_inline_and_errors(tmp_path: Path) -> None:
    export.save_preset(tmp_path, "mine", "0,90", "4,8", max_tws=20)

    default = export.resolve_export_selection(tmp_path, {}, 20, 10)
    named = export.resolve_export_selection(tmp_path, {"format": "mine"}, 20, 10)
    inline = export.resolve_export_selection(tmp_path, {"twa": "90,0", "tws": "8,4"}, 20, 10)

    assert default.name == "DefaultStarboard180"
    assert named.twa == [0, 90]
    assert inline.name == "custom"
    assert inline.tws == [4, 8]

    def mixed_builtin_and_inline() -> object:
        return export.resolve_export_selection(
            tmp_path,
            {"format": "windy", "twa": "0"},
            20,
            10,
        )

    def incomplete_inline() -> object:
        return export.resolve_export_selection(tmp_path, {"twa": "0"}, 20, 10)

    _assert_export_error(mixed_builtin_and_inline)
    _assert_export_error(incomplete_inline)


def test_floor_selection_changes_projected_cells_and_csv() -> None:
    bins = {(90, 12): {"histogram": {60: 5}}}

    low = export.project_grid(bins, [90], [12], percentile=65, min_samples=3)
    high = export.project_grid(bins, [90], [12], percentile=65, min_samples=10)

    assert low[(90, 12)] == export.ProjectedCell(stw=6.0, samples=5)
    assert (90, 12) not in high
    assert export.csv_from_projection(low, [90], [12]) == "TWA\\TWS;12\r\n90;6.0\r\n"
    assert export.csv_from_projection(high, [90], [12]) == "TWA\\TWS;12\r\n90;\r\n"


def test_projection_is_deterministic_and_reuses_polar_grid() -> None:
    bins = {(90, 12): {"histogram": {60: 3}}, (91, 12): {"histogram": {61: 3}}}
    twa_grid = list(range(181))
    tws_grid = [12]

    first = export.project_grid(bins, twa_grid, tws_grid, 65, export.MIN_SAMPLES_DISPLAY)
    second = export.project_grid(bins, twa_grid, tws_grid, 65, export.MIN_SAMPLES_DISPLAY)

    assert first == second
    assert first[(90, 12)] == export.ProjectedCell(stw=6.0, samples=3)
    assert first[(91, 12)] == export.ProjectedCell(stw=6.1, samples=3)


def _assert_export_error(call: Callable[[], object]) -> None:
    try:
        call()
    except export.ExportError:
        return
    msg = "expected ExportError"
    raise AssertionError(msg)
