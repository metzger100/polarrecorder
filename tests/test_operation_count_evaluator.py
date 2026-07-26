from __future__ import annotations

import pytest
from operation_count_evaluator import (
    evaluate_bounded_by_configured_steps,
    evaluate_linear_scaling,
)


def test_linear_scaling_passes_a_clean_workload() -> None:
    def plus_three(n: int) -> int:
        return 3 + n

    sizes = [
        10,
        20,
        40,
        80,
    ]
    result = evaluate_linear_scaling(sizes, measure=plus_three, fixed_overhead=0)

    assert result.ok is True
    assert result.violations == []
    counts = [sample.count for sample in result.samples]
    expected_counts = [
        13,
        23,
        43,
        83,
    ]
    assert counts == expected_counts


def test_linear_scaling_passes_with_real_fixed_overhead_once_covered() -> None:
    result = evaluate_linear_scaling(
        [10, 20], measure=lambda n: 14 if n == 10 else 20, fixed_overhead=4
    )

    assert result.ok is True


def test_linear_scaling_fails_a_synthetic_quadratic_sequence() -> None:
    def quadratic(n: int) -> int:
        return n * n

    result = evaluate_linear_scaling([10, 20, 40], measure=quadratic, fixed_overhead=5)

    assert result.ok is False
    assert len(result.violations) == 2
    first, second = result.violations
    assert first.n == 10
    assert first.doubled_n == 20
    assert first.count == 100
    assert first.doubled_count == 400
    assert first.allowed == 205
    assert second.n == 20
    assert second.doubled_n == 40
    assert second.count == 400
    assert second.doubled_count == 1600
    assert second.allowed == 805


def test_linear_scaling_requires_at_least_two_sizes() -> None:
    with pytest.raises(ValueError, match="at least 2 sizes"):
        evaluate_linear_scaling([10], measure=lambda _n: 1, fixed_overhead=0)


def test_linear_scaling_requires_each_size_to_exactly_double() -> None:
    with pytest.raises(ValueError, match="exactly double"):
        evaluate_linear_scaling([10, 25], measure=lambda _n: 1, fixed_overhead=0)


def test_linear_scaling_rejects_a_negative_fixed_overhead() -> None:
    with pytest.raises(ValueError, match="non-negative integer fixed_overhead"):
        evaluate_linear_scaling([10, 20], measure=lambda _n: 1, fixed_overhead=-1)


@pytest.mark.parametrize("count", [-1, True])
def test_linear_scaling_rejects_an_invalid_measured_count(count: int) -> None:
    with pytest.raises(ValueError, match="non-negative finite integer operation count"):
        evaluate_linear_scaling([10, 20], measure=lambda _n: count, fixed_overhead=0)


def test_bounded_by_steps_passes_within_tolerance() -> None:
    result = evaluate_bounded_by_configured_steps(
        [8, 14, 20], measure=lambda steps: steps, tolerance_per_step=1
    )

    assert result.ok is True
    assert result.violations == []


def test_bounded_by_steps_fails_on_input_length_dependent_work() -> None:
    result = evaluate_bounded_by_configured_steps(
        [14], measure=lambda _steps: 5000, tolerance_per_step=1
    )

    assert result.ok is False
    assert [(v.steps, v.count, v.allowed) for v in result.violations] == [(14, 5000, 14)]


def test_bounded_by_steps_rejects_a_non_positive_tolerance() -> None:
    def constant_one(_steps: int) -> int:
        return 1

    with pytest.raises(ValueError, match="positive finite tolerance_per_step"):
        evaluate_bounded_by_configured_steps([14], measure=constant_one, tolerance_per_step=0)


@pytest.mark.parametrize("count", [-1, True])
def test_bounded_by_steps_rejects_an_invalid_measured_count(count: int) -> None:
    with pytest.raises(ValueError, match="non-negative finite integer operation count"):
        evaluate_bounded_by_configured_steps(
            [14], measure=lambda _steps: count, tolerance_per_step=1
        )
