from __future__ import annotations

import json
from typing import TYPE_CHECKING

from conftest import FakeLogger
from polarrecorder import export

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path


def test_windy_preset_values_are_exact() -> None:
    preset = export.builtin_preset()

    assert preset.name == "windy"
    assert preset.builtin is True
    assert preset.twa == [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]
    assert preset.tws == [4, 6, 8, 10, 12, 14, 16, 20, 25]


def test_projection_folds_and_merges_bins() -> None:
    bins = {
        (30, 4): {"histogram": {50: 2}},
        (330, 4): {"histogram": {60: 1}},
    }

    projected = export.project_grid(bins, [30], [4], percentile=65, min_samples=3)

    assert projected[(30, 4)] == export.ProjectedCell(stw=5.0, samples=3)


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


def test_preset_save_load_delete_round_trip(tmp_path: Path) -> None:
    saved = export.save_preset(tmp_path, "my plan", "90,0", "8,4", max_tws=20)

    assert saved.twa == [0, 90]
    assert saved.tws == [4, 8]
    assert [preset.name for preset in export.list_presets(tmp_path)] == ["windy", "my plan"]

    export.delete_preset(tmp_path, "my plan", "yes")

    assert [preset.name for preset in export.list_presets(tmp_path)] == ["windy"]


def test_reserved_windy_save_and_delete_are_rejected(tmp_path: Path) -> None:
    def save_windy() -> object:
        return export.save_preset(tmp_path, "Windy", "0", "4", max_tws=20)

    def delete_windy() -> object:
        export.delete_preset(tmp_path, "windy", "yes")
        return None

    _assert_export_error(save_windy)
    _assert_export_error(delete_windy)


def test_corrupt_and_schema_too_new_presets_recover_empty(tmp_path: Path) -> None:
    logger = FakeLogger()
    presets_path = tmp_path / export.PRESETS_NAME
    presets_path.write_text("{bad", encoding="utf-8")

    assert [preset.name for preset in export.list_presets(tmp_path, logger)] == ["windy"]
    assert any("corrupt" in message for level, message in logger.messages if level == "warn")

    presets_path.write_text(
        json.dumps({"schema_version": export.PRESET_SCHEMA_VERSION + 1, "presets": {}}),
        encoding="utf-8",
    )
    assert [preset.name for preset in export.list_presets(tmp_path, logger)] == ["windy"]
    assert any("too new" in message for level, message in logger.messages if level == "warn")


def test_name_and_grid_validation(tmp_path: Path) -> None:
    invalid = [
        ("", "0", "4"),
        ("bad_name", "0", "4"),
        ("valid", "", "4"),
        ("valid", "181", "4"),
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


def test_format_resolution_default_preset_inline_and_errors(tmp_path: Path) -> None:
    export.save_preset(tmp_path, "mine", "0,90", "4,8", max_tws=20)

    default = export.resolve_export_selection(tmp_path, {}, 20, 10)
    named = export.resolve_export_selection(tmp_path, {"format": "mine"}, 20, 10)
    inline = export.resolve_export_selection(tmp_path, {"twa": "90,0", "tws": "8,4"}, 20, 10)

    assert default.name == "windy"
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
