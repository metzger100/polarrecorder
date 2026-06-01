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


def engine_heuristic(sample: Sample, config: Config) -> RuleResult:
    """Quarantine low-wind, moderate-speed samples as suspected engine use."""
    if sample.tws_kt < config.engine_tws_ceil and sample.stw_kt > config.engine_stw_floor:
        return RuleResult(
            decision="quarantine",
            reason_codes=["quarantine_engine_suspected"],
        )
    return RuleResult(decision="pass", reason_codes=[])
