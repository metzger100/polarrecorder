"""Module: Stability Validation Rules - Stateful quality-gate checks R11 through R15.

Documentation: documentation/filters/rejection-rules.md
Depends: polarrecorder.config, polarrecorder.sample, polarrecorder.validation.angle_math,
polarrecorder.validation.state
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from polarrecorder.sample import RuleResult, enhanced_value
from polarrecorder.validation.angle_math import circular_distance, circular_range

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.sample import Sample
    from polarrecorder.validation.state import ValidationState, WindowEntry


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
    now = sample.timestamp_monotonic
    state.stability_window_seconds = float(config.stability_window_seconds)
    state.prune(now)
    if not state.is_filled(now):
        return _reject("reject_warming_up")

    twa_values = [entry.twa_deg_raw for entry in state.window]
    tws_values = [entry.tws_kt for entry in state.window]
    stw_values = [entry.stw_kt for entry in state.window]
    if (
        circular_range(twa_values) >= config.stability_twa_range
        or _linear_range(tws_values) >= config.stability_tws_range
        or _linear_range(stw_values) >= config.stability_stw_range
    ):
        return _reject("reject_unstable")
    return _pass()


def _linear_range(values: list[float]) -> float:
    if not values:
        return 0.0
    return max(values) - min(values)


def _pass() -> RuleResult:
    return RuleResult(decision="pass", reason_codes=[])


def _reject(code: str) -> RuleResult:
    return RuleResult(decision="reject", reason_codes=[code])
