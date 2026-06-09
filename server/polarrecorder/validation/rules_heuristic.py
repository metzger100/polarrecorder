"""Module: Heuristic Validation Rules - Ambiguous quarantine checks.

Documentation: documentation/filters/rejection-rules.md
Depends: polarrecorder.config, polarrecorder.sample
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from polarrecorder.sample import RuleResult

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.sample import Sample

RPM_OFF_CEILING = 50.0


def engine_heuristic(sample: Sample, config: Config) -> RuleResult:
    """Quarantine low-wind, moderate-speed samples as suspected engine use.

    Defers to a definitive engine signal: when ``rpm``/``engine_signal`` reads off,
    the quarantine is suppressed; engine-on is already a pre-candidate R17/R18 reject
    and never reaches this rule. A present-but-idling RPM does not settle the question,
    so the low-wind/moving heuristic still applies in the idle band.
    """
    if _engine_reads_off(sample, config):
        return RuleResult(decision="pass", reason_codes=[])
    if sample.tws_kt < config.engine_tws_ceil and sample.stw_kt > config.engine_stw_floor:
        return RuleResult(
            decision="quarantine",
            reason_codes=["quarantine_engine_suspected"],
        )
    return RuleResult(decision="pass", reason_codes=[])


def _engine_reads_off(sample: Sample, config: Config) -> bool:
    enhanced = sample.enhanced
    if enhanced is None:
        return False
    engine_signal = enhanced.get("engine_signal")
    if engine_signal is not None and engine_signal < config.enh_engine_state_on_threshold:
        return True
    rpm = enhanced.get("rpm")
    return rpm is not None and rpm <= RPM_OFF_CEILING
