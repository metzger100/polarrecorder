"""Module: Enhanced Validation Rules - Optional-signal rejection rules R17-R22.

Documentation: documentation/filters/rejection-rules.md
Depends: polarrecorder.config, polarrecorder.sample, polarrecorder.validation.angle_math
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

from polarrecorder.sample import RuleResult, enhanced_value
from polarrecorder.validation.angle_math import circular_distance

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.sample import Sample

_FULL_CIRCLE_DEG = 360.0
_LAW_OF_COSINES_COEFF = 2.0


def reject_engine_rpm(sample: Sample, config: Config) -> RuleResult:
    """Reject (R17) when engine RPM exceeds the configured idle ceiling."""
    rpm = enhanced_value(sample, "rpm")
    if rpm is not None and rpm > config.enh_rpm_idle_max:
        return _reject("reject_engine_rpm")
    return _pass()


def reject_engine_on(sample: Sample, config: Config) -> RuleResult:
    """Reject (R18) when the engine-state signal reads at/above the on threshold."""
    engine_signal = enhanced_value(sample, "engine_signal")
    if engine_signal is not None and engine_signal >= config.enh_engine_state_on_threshold:
        return _reject("reject_engine_on")
    return _pass()


def reject_shallow(sample: Sample, config: Config) -> RuleResult:
    """Reject (R19) when depth/keel clearance is below the configured floor."""
    depth_m = enhanced_value(sample, "depth_m")
    if depth_m is not None and depth_m < config.enh_depth_floor_m:
        return _reject("reject_shallow")
    return _pass()


def reject_sog_stw_mismatch(sample: Sample, config: Config) -> RuleResult:
    """Reject (R20) when STW reads implausibly low versus SOG and current cannot explain it."""
    sog_kt = enhanced_value(sample, "sog_kt")
    current_drift_kt = enhanced_value(sample, "current_drift_kt")
    if sog_kt is None or current_drift_kt is None:
        return _pass()
    moving = sog_kt > config.enh_slip_sog_floor_kt
    stw_implausible = sample.stw_kt < sog_kt * config.enh_slip_ratio
    current_too_small = current_drift_kt < sog_kt - sample.stw_kt
    if moving and stw_implausible and current_too_small:
        return _reject("reject_sog_stw_mismatch")
    return _pass()


def reject_true_wind_crosscheck(sample: Sample, config: Config) -> RuleResult:
    """Reject (R21) when true wind recomputed from apparent wind disagrees with reports."""
    awa_deg = enhanced_value(sample, "awa_deg")
    aws_kt = enhanced_value(sample, "aws_kt")
    if awa_deg is None or aws_kt is None:
        return _pass()
    awa_rad = math.radians(awa_deg)
    stw = sample.stw_kt
    tws_calc = math.sqrt(
        aws_kt**2 + stw**2 - _LAW_OF_COSINES_COEFF * aws_kt * stw * math.cos(awa_rad)
    )
    twa_calc = (
        math.degrees(math.atan2(aws_kt * math.sin(awa_rad), aws_kt * math.cos(awa_rad) - stw))
        % _FULL_CIRCLE_DEG
    )
    twa_off = circular_distance(twa_calc, sample.twa_deg_raw) > config.enh_tw_twa_tol_deg
    tws_off = abs(tws_calc - sample.tws_kt) > config.enh_tw_tws_tol_kt
    if twa_off or tws_off:
        return _reject("reject_true_wind_crosscheck")
    return _pass()


def reject_heel_out_of_band(sample: Sample, config: Config) -> RuleResult:
    """Reject (R22) when absolute heel is outside the configured [min, max] band."""
    heel_deg = enhanced_value(sample, "heel_deg")
    if heel_deg is None:
        return _pass()
    heel_abs = abs(heel_deg)
    if heel_abs > config.enh_heel_max_deg or heel_abs < config.enh_heel_min_deg:
        return _reject("reject_heel_out_of_band")
    return _pass()


def _pass() -> RuleResult:
    return RuleResult(decision="pass", reason_codes=[])


def _reject(code: str) -> RuleResult:
    return RuleResult(decision="reject", reason_codes=[code])
