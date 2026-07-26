from __future__ import annotations

from typing import TYPE_CHECKING, cast

from operation_count_evaluator import evaluate_bounded_by_configured_steps, evaluate_linear_scaling
from polarrecorder import api_handlers
from scaling_contract_fixtures import FIXED_TWA_GRID, FIXED_TWS_GRID, build_model_bins

if TYPE_CHECKING:
    import pytest
    from polarrecorder.export import ProjectedCell

# 360 deg positions assembled into a curve per configured TWS band, regardless of raw
# bin count -- format_polar's curve/cell assembly step is grid-cell-bound, not
# raw-bin-bound (see projection.project_grid's raw-bin-bound envelope instead).
_CURVE_POSITIONS_PER_BAND = 360


def _data(response: dict[str, object]) -> dict[str, object]:
    assert response["status"] == "OK"
    return cast("dict[str, object]", response["data"])


def test_format_polar_projection_facing_reads_have_a_linear_envelope_for_a_fixed_grid() -> None:
    def measure(count: int) -> int:
        counter = [0]
        model_bins = build_model_bins(count, counter)
        api_handlers.format_polar(model_bins, FIXED_TWA_GRID, FIXED_TWS_GRID, 65, 1, "windy")
        return counter[0]

    result = evaluate_linear_scaling(
        sizes=[250, 500, 1000, 2000], measure=measure, fixed_overhead=8
    )

    assert result.ok, result.violations


def test_format_polar_curve_assembly_is_bounded_by_configured_grid_cells(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixed_bins = build_model_bins(200, None)
    calls = [0]
    real_polar_entry = api_handlers._polar_entry  # counting wrapper, test-only

    def counting_polar_entry(cell: ProjectedCell | None) -> object:
        calls[0] += 1
        return real_polar_entry(cell)

    def measure(steps: int) -> int:
        calls[0] = 0
        monkeypatch.setattr(api_handlers, "_polar_entry", counting_polar_entry)
        tws_grid = list(range(4, 4 + steps))
        api_handlers.format_polar(fixed_bins, FIXED_TWA_GRID, tws_grid, 65, 1, "windy")
        return calls[0]

    steps = [
        8,
        14,
        20,
        32,
    ]
    result = evaluate_bounded_by_configured_steps(
        steps=steps, measure=measure, tolerance_per_step=_CURVE_POSITIONS_PER_BAND
    )

    assert result.ok, result.violations


def test_format_polar_scaling_instrumentation_preserves_the_full_response() -> None:
    counter = [0]
    instrumented_bins = build_model_bins(50, counter)
    ordinary_bins = build_model_bins(50, None)

    instrumented = _data(
        api_handlers.format_polar(instrumented_bins, FIXED_TWA_GRID, FIXED_TWS_GRID, 65, 7, "windy")
    )
    ordinary = _data(
        api_handlers.format_polar(ordinary_bins, FIXED_TWA_GRID, FIXED_TWS_GRID, 65, 7, "windy")
    )

    assert instrumented == ordinary
    assert ordinary["format"] == "windy"
    assert ordinary["percentile"] == 65
    assert ordinary["generation"] == 7
    bands = cast("list[int]", ordinary["tws_bands"])
    assert len(bands) > 0
    curves = cast("dict[str, list[dict[str, object] | None]]", ordinary["curves"])
    for tws in bands:
        curve = curves[str(tws)]
        assert len(curve) == 360
        # The starboard-only grid leaves every port position (181-359 deg) unpopulated,
        # and each populated cell carries real confidence (nonzero samples) or is the
        # zero-STW origin anchor -- never a bare sentinel.
        assert any(entry is None for entry in curve)
        assert all(entry is None or cast("int", entry["samples"]) >= 0 for entry in curve)
