from __future__ import annotations

from operation_count_evaluator import evaluate_linear_scaling
from polarrecorder.projection import project_grid
from scaling_contract_fixtures import FIXED_TWA_GRID, FIXED_TWS_GRID, build_model_bins


def test_project_grid_has_a_linear_raw_bin_read_envelope_for_a_fixed_grid() -> None:
    def measure(count: int) -> int:
        counter = [0]
        model_bins = build_model_bins(count, counter)
        project_grid(model_bins, FIXED_TWA_GRID, FIXED_TWS_GRID, percentile=65, min_samples=1)
        return counter[0]

    result = evaluate_linear_scaling(
        sizes=[250, 500, 1000, 2000], measure=measure, fixed_overhead=8
    )

    assert result.ok, result.violations


def test_project_grid_scaling_instrumentation_preserves_correctness() -> None:
    counter = [0]
    instrumented_bins = build_model_bins(300, counter)
    ordinary_bins = build_model_bins(300, None)

    instrumented = project_grid(
        instrumented_bins, FIXED_TWA_GRID, FIXED_TWS_GRID, percentile=65, min_samples=1
    )
    ordinary = project_grid(
        ordinary_bins, FIXED_TWA_GRID, FIXED_TWS_GRID, percentile=65, min_samples=1
    )

    assert instrumented == ordinary
    assert len(ordinary) > 0
