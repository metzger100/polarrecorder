"""Deterministic operation-count scaling evaluator.

Verifies a workload's counted operations grow at most linearly with input size by
checking the envelope ``work(2n) <= 2 * work(n) + fixed_overhead`` for every
consecutive doubling in a caller-supplied size sequence, or that a workload's
counted operations stay within a configured-steps tolerance
(``work(steps) <= steps * tolerance_per_step``). Counts are test-only observables
(counting dict/mapping wrappers, monkeypatched counting call sites) supplied by the
caller; this evaluator is a pure, offline function of those counts and never touches
a wall clock.

The evaluator is local test infrastructure with no runtime dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class ScalingSample:
    """One measured (input size, operation count) pair."""

    n: int
    count: int


@dataclass(frozen=True)
class ScalingViolation:
    """A doubling step whose operation count exceeded its linear envelope."""

    n: int
    doubled_n: int
    count: int
    doubled_count: int
    allowed: int


@dataclass(frozen=True)
class LinearScalingResult:
    """Result of `evaluate_linear_scaling`."""

    ok: bool
    samples: list[ScalingSample]
    violations: list[ScalingViolation]


@dataclass(frozen=True)
class StepSample:
    """One measured (configured steps, operation count) pair."""

    steps: int
    count: int


@dataclass(frozen=True)
class StepViolation:
    """A configured-steps sample whose operation count exceeded its bound."""

    steps: int
    count: int
    allowed: float


@dataclass(frozen=True)
class BoundedByStepsResult:
    """Result of `evaluate_bounded_by_configured_steps`."""

    ok: bool
    samples: list[StepSample]
    violations: list[StepViolation]


def evaluate_linear_scaling(
    sizes: list[int],
    measure: Callable[[int], int],
    fixed_overhead: int,
) -> LinearScalingResult:
    """Check that doubling ``n`` at most doubles the measured operation count.

    Args:
        sizes: Strictly-doubling positive input sizes, at least two entries.
        measure: Callable returning a non-negative finite integer operation count for ``n``.
        fixed_overhead: Non-negative one-time setup cost tolerated on every doubling step.

    Returns:
        The samples measured and any doubling steps that exceeded their envelope.
    """
    if len(sizes) < 2:
        too_few_message = (
            "evaluate_linear_scaling requires at least 2 sizes to compare a doubling step."
        )
        raise ValueError(too_few_message)
    if (
        not isinstance(fixed_overhead, int)
        or isinstance(fixed_overhead, bool)
        or fixed_overhead < 0
    ):
        overhead_message = (
            "evaluate_linear_scaling requires a non-negative integer fixed_overhead constant."
        )
        raise ValueError(overhead_message)

    samples: list[ScalingSample] = []
    for n in sizes:
        if not isinstance(n, int) or isinstance(n, bool) or n <= 0:
            size_message = "evaluate_linear_scaling sizes must be positive integers."
            raise ValueError(size_message)
        samples.append(
            ScalingSample(
                n=n, count=_require_operation_count(measure(n), "evaluate_linear_scaling")
            )
        )

    violations: list[ScalingViolation] = []
    for previous, current in zip(samples, samples[1:]):
        if current.n != previous.n * 2:
            doubling_message = (
                f"evaluate_linear_scaling requires each size to exactly double the previous "
                f"size (got {previous.n} -> {current.n})."
            )
            raise ValueError(doubling_message)
        allowed = 2 * previous.count + fixed_overhead
        if current.count > allowed:
            violations.append(
                ScalingViolation(
                    n=previous.n,
                    doubled_n=current.n,
                    count=previous.count,
                    doubled_count=current.count,
                    allowed=allowed,
                )
            )

    return LinearScalingResult(ok=len(violations) == 0, samples=samples, violations=violations)


def evaluate_bounded_by_configured_steps(
    steps: list[int],
    measure: Callable[[int], int],
    tolerance_per_step: float,
) -> BoundedByStepsResult:
    """Check that a workload's operation count stays within a per-configured-step tolerance.

    Args:
        steps: Positive configured-step counts to measure, at least one entry.
        measure: Callable returning a non-negative finite integer operation count for a step count.
        tolerance_per_step: Positive finite allowed operation count per configured step.

    Returns:
        The samples measured and any that exceeded ``steps * tolerance_per_step``.
    """
    if len(steps) < 1:
        too_few_message = (
            "evaluate_bounded_by_configured_steps requires at least 1 configured-steps value."
        )
        raise ValueError(too_few_message)
    if tolerance_per_step <= 0:
        tolerance_message = (
            "evaluate_bounded_by_configured_steps requires a positive finite tolerance_per_step "
            "constant."
        )
        raise ValueError(tolerance_message)

    samples: list[StepSample] = []
    for configured_steps in steps:
        if (
            not isinstance(configured_steps, int)
            or isinstance(configured_steps, bool)
            or configured_steps <= 0
        ):
            steps_message = (
                "evaluate_bounded_by_configured_steps steps values must be positive integers."
            )
            raise ValueError(steps_message)
        samples.append(
            StepSample(
                steps=configured_steps,
                count=_require_operation_count(
                    measure(configured_steps), "evaluate_bounded_by_configured_steps"
                ),
            )
        )

    violations: list[StepViolation] = []
    for sample in samples:
        allowed = sample.steps * tolerance_per_step
        if sample.count > allowed:
            violations.append(
                StepViolation(steps=sample.steps, count=sample.count, allowed=allowed)
            )

    return BoundedByStepsResult(ok=len(violations) == 0, samples=samples, violations=violations)


def _require_operation_count(value: int, evaluator_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        message = (
            f"{evaluator_name} measure() must return a non-negative finite integer operation count."
        )
        raise ValueError(message)
    return value
