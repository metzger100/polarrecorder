"""Module: Stability Validation Rules - Stateful quality-gate checks R11 through R15.

Documentation: documentation/filters/rejection-rules.md
Depends: polarrecorder.config, polarrecorder.sample, polarrecorder.validation.angle_math,
polarrecorder.validation.state
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

from polarrecorder.sample import RuleResult, enhanced_value, pass_rule, reject_rule
from polarrecorder.validation.angle_math import circular_distance, circular_range
from polarrecorder.validation.state import entry_from_sample

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.sample import Sample
    from polarrecorder.validation.state import ValidationState, WindowEntry


STABILITY_MAX_GAP_INTERVALS = 3.0
STABILITY_MIN_SAMPLE_COUNT = 3


@dataclass(frozen=True)
class StabilityEvaluation:
    """Current-sample-inclusive R15 stability measurements."""

    filled: bool
    window_span_seconds: float | None
    largest_gap_seconds: float | None
    max_allowed_gap_seconds: float
    sample_count: int
    minimum_sample_count: int
    twa_range: float | None
    tws_range: float | None
    stw_range: float | None
    predicate_codes: tuple[str, ...]


def twa_rate_of_change(sample: Sample, state: ValidationState, config: Config) -> RuleResult:
    """Reject rapid TWA changes and start a maneuver cooldown.

    When heading/COG turn confirmation is enabled and a prior+current heading or
    COG is available, a high TWA rate with steady heading/COG is treated as a wind
    shift: the sample passes and no cooldown starts.
    """
    previous = state.previous_sample
    if previous is None:
        return _pass()
    elapsed_seconds = sample.timestamp_monotonic - previous.timestamp_monotonic
    if elapsed_seconds <= 0.0:
        return _pass()
    rate = circular_distance(sample.twa_deg_raw, previous.twa_deg_raw) / elapsed_seconds
    high_rate = rate > config.twa_roc_threshold
    if not high_rate or _is_wind_shift(sample, previous, elapsed_seconds, config):
        return _pass()
    state.cooldown_expires = sample.timestamp_monotonic + config.cooldown_seconds
    return _reject("reject_twa_roc")


def _is_wind_shift(
    sample: Sample,
    previous: WindowEntry,
    elapsed_seconds: float,
    config: Config,
) -> bool:
    if not config.enh_turnconfirm_enabled:
        return False
    rates = _turn_rates(sample, previous, elapsed_seconds)
    if not rates:
        return False
    return max(rates) < config.enh_turn_min_roc


def _turn_rates(
    sample: Sample,
    previous: WindowEntry,
    elapsed_seconds: float,
) -> list[float]:
    rates: list[float] = []
    heading = enhanced_value(sample, "heading_deg")
    if heading is not None and previous.heading_deg is not None:
        rates.append(circular_distance(heading, previous.heading_deg) / elapsed_seconds)
    cog = enhanced_value(sample, "cog_deg")
    if cog is not None and previous.cog_deg is not None:
        rates.append(circular_distance(cog, previous.cog_deg) / elapsed_seconds)
    return rates


def tws_rate_of_change(sample: Sample, state: ValidationState, config: Config) -> RuleResult:
    """Reject rapid TWS changes."""
    previous = state.previous_sample
    if previous is None:
        return _pass()
    elapsed_seconds = sample.timestamp_monotonic - previous.timestamp_monotonic
    if elapsed_seconds <= 0.0:
        return _pass()
    rate = abs(sample.tws_kt - previous.tws_kt) / elapsed_seconds
    if rate > config.tws_roc_threshold:
        return _reject("reject_tws_roc")
    return _pass()


def stw_acceleration(sample: Sample, state: ValidationState, config: Config) -> RuleResult:
    """Reject rapid STW acceleration or deceleration."""
    previous = state.previous_sample
    if previous is None:
        return _pass()
    elapsed_seconds = sample.timestamp_monotonic - previous.timestamp_monotonic
    if elapsed_seconds <= 0.0:
        return _pass()
    rate = abs(sample.stw_kt - previous.stw_kt) / elapsed_seconds
    if rate > config.stw_roc_threshold:
        return _reject("reject_stw_roc")
    return _pass()


def maneuver_cooldown(sample: Sample, state: ValidationState, config: Config) -> RuleResult:
    """Reject samples while the maneuver cooldown is still active."""
    del config
    if sample.timestamp_monotonic < state.cooldown_expires:
        return _reject("reject_maneuver_cooldown")
    return _pass()


def stability_window(sample: Sample, state: ValidationState, config: Config) -> RuleResult:
    """Reject warming-up or unstable rolling-window samples."""
    return stability_decision(evaluate_stability(sample, state, config))


def stability_decision(evaluation: StabilityEvaluation) -> RuleResult:
    """Map one immutable R15 evaluation to its rule decision."""
    if not evaluation.filled:
        return _reject("reject_warming_up")
    if evaluation.predicate_codes:
        return RuleResult(
            decision="reject",
            reason_codes=("reject_unstable",),
            predicate_codes=evaluation.predicate_codes,
        )
    return _pass()


def evaluate_stability(
    sample: Sample, state: ValidationState, config: Config
) -> StabilityEvaluation:
    """Evaluate R15 without mutating retained validation state."""
    now = sample.timestamp_monotonic
    window_seconds = float(config.stability_window_seconds)
    retained = _retained_entries(list(state.window), now, window_seconds)
    entries = [*retained, entry_from_sample(sample)]
    span = _window_span(entries)
    largest_gap = _largest_gap(entries)
    max_allowed_gap = config.sample_interval * STABILITY_MAX_GAP_INTERVALS
    minimum_samples = max(
        STABILITY_MIN_SAMPLE_COUNT,
        math.ceil(window_seconds / config.sample_interval) + 1,
    )
    continuous = largest_gap <= max_allowed_gap
    dense = len(entries) >= minimum_samples
    if (
        not retained
        or now - retained[0].timestamp_monotonic < window_seconds
        or not continuous
        or not dense
    ):
        return StabilityEvaluation(
            filled=False,
            window_span_seconds=span,
            largest_gap_seconds=largest_gap,
            max_allowed_gap_seconds=max_allowed_gap,
            sample_count=len(entries),
            minimum_sample_count=minimum_samples,
            twa_range=None,
            tws_range=None,
            stw_range=None,
            predicate_codes=(),
        )

    twa_values = [entry.twa_deg_raw for entry in entries]
    tws_values = [entry.tws_kt for entry in entries]
    stw_values = [entry.stw_kt for entry in entries]
    twa_range = circular_range(twa_values)
    tws_range = _linear_range(tws_values)
    stw_range = _linear_range(stw_values)
    predicates = _unstable_predicates(twa_range, tws_range, stw_range, config)
    return StabilityEvaluation(
        filled=True,
        window_span_seconds=span,
        largest_gap_seconds=largest_gap,
        max_allowed_gap_seconds=max_allowed_gap,
        sample_count=len(entries),
        minimum_sample_count=minimum_samples,
        twa_range=twa_range,
        tws_range=tws_range,
        stw_range=stw_range,
        predicate_codes=tuple(predicates),
    )


def _retained_entries(
    entries: list[WindowEntry], now: float, window_seconds: float
) -> list[WindowEntry]:
    oldest_allowed = now - window_seconds
    if entries and entries[-1].timestamp_monotonic < oldest_allowed:
        return []
    first_retained = 0
    while len(entries) - first_retained > 1:
        if entries[first_retained + 1].timestamp_monotonic > oldest_allowed:
            break
        first_retained += 1
    return entries[first_retained:]


def _linear_range(values: list[float]) -> float:
    if not values:
        return 0.0
    return max(values) - min(values)


def _window_span(entries: list[WindowEntry]) -> float | None:
    if not entries:
        return None
    return entries[-1].timestamp_monotonic - entries[0].timestamp_monotonic


def _largest_gap(entries: list[WindowEntry]) -> float:
    return max(
        (
            current.timestamp_monotonic - previous.timestamp_monotonic
            for previous, current in zip(entries, entries[1:])
        ),
        default=0.0,
    )


def _unstable_predicates(
    twa_range: float, tws_range: float, stw_range: float, config: Config
) -> list[str]:
    codes: list[str] = []
    if twa_range >= config.stability_twa_range:
        codes.append("unstable_twa")
    if tws_range >= config.stability_tws_range:
        codes.append("unstable_tws")
    if stw_range >= config.stability_stw_range:
        codes.append("unstable_stw")
    return codes


_pass = pass_rule
_reject = reject_rule
