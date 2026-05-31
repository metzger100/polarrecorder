"""Module: Core Validation Rules - Candidacy-gate checks R1 through R10.

Documentation: documentation/filters/rejection-rules.md
Depends: polarrecorder.config, polarrecorder.sample
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any

from polarrecorder.sample import RuleResult

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.sample import ReadResult, Sample

TWA_MIN_DEGREES = 0.0
TWA_MAX_DEGREES = 360.0


def finite_values(read_result: ReadResult) -> RuleResult:
    """Reject non-numeric or non-finite raw values.

    Args:
        read_result: Raw store read.

    Returns:
        Pass or reject with one code per non-finite value.
    """
    codes: list[str] = []
    _add_non_finite_code(codes, read_result.twa_raw, "reject_non_finite_twa")
    _add_non_finite_code(codes, read_result.tws_raw, "reject_non_finite_tws")
    _add_non_finite_code(codes, read_result.stw_raw, "reject_non_finite_stw")
    return _multi_result(codes)


def required_keys(read_result: ReadResult) -> RuleResult:
    """Reject missing required raw values.

    Args:
        read_result: Raw store read.

    Returns:
        Pass or reject with one code per missing value.
    """
    codes: list[str] = []
    if read_result.twa_raw is None:
        codes.append("reject_missing_twa")
    if read_result.tws_raw is None:
        codes.append("reject_missing_tws")
    if read_result.stw_raw is None:
        codes.append("reject_missing_stw")
    return _multi_result(codes)


def stale_values(sample: Sample, config: Config) -> RuleResult:
    """Reject stale core values.

    Args:
        sample: Built sample.
        config: Runtime validation thresholds.

    Returns:
        Pass or reject with one code per stale value.
    """
    codes: list[str] = []
    if sample.freshness.twa_age_s > config.stale_threshold:
        codes.append("reject_stale_twa")
    if sample.freshness.tws_age_s > config.stale_threshold:
        codes.append("reject_stale_tws")
    if sample.freshness.stw_age_s > config.stale_threshold:
        codes.append("reject_stale_stw")
    return _multi_result(codes)


def age_skew(sample: Sample, config: Config) -> RuleResult:
    """Reject samples whose core value timestamps are too far apart."""
    if sample.freshness.age_skew_s >= config.age_skew_threshold:
        return _reject("reject_age_skew")
    return _pass()


def twa_range(sample: Sample, config: Config) -> RuleResult:
    """Reject raw TWA outside the 0-360 degree store convention."""
    del config
    if not TWA_MIN_DEGREES <= sample.twa_deg_raw <= TWA_MAX_DEGREES:
        return _reject("reject_twa_range")
    return _pass()


def tws_range(sample: Sample, config: Config) -> RuleResult:
    """Reject implausible true wind speeds."""
    if not 0.0 <= sample.tws_kt <= config.max_tws:
        return _reject("reject_tws_range")
    return _pass()


def stw_range(sample: Sample, config: Config) -> RuleResult:
    """Reject implausible speeds through water."""
    if not 0.0 <= sample.stw_kt <= config.max_stw:
        return _reject("reject_stw_range")
    return _pass()


def head_to_wind(sample: Sample, config: Config) -> RuleResult:
    """Reject samples inside the no-sailing head-to-wind zone."""
    if sample.twa_deg_abs < config.head_to_wind_threshold:
        return _reject("reject_head_to_wind")
    return _pass()


def low_wind(sample: Sample, config: Config) -> RuleResult:
    """Reject very low true wind samples."""
    if sample.tws_kt < config.low_wind_threshold:
        return _reject("reject_low_wind")
    return _pass()


def anchored_heuristic(sample: Sample, config: Config) -> RuleResult:
    """Reject anchored-like samples with wind but near-zero STW."""
    if sample.stw_kt < config.anchored_stw_threshold and sample.tws_kt > 0.0:
        return _reject("reject_anchored")
    return _pass()


def _add_non_finite_code(codes: list[str], value: Any, code: str) -> None:
    if value is None:
        return
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        codes.append(code)


def _multi_result(codes: list[str]) -> RuleResult:
    if codes:
        return RuleResult(decision="reject", reason_codes=codes)
    return _pass()


def _pass() -> RuleResult:
    return RuleResult(decision="pass", reason_codes=[])


def _reject(code: str) -> RuleResult:
    return RuleResult(decision="reject", reason_codes=[code])
