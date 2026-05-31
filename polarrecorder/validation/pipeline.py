"""Module: Validation Pipeline - Explicit runner for validation rules.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.config, polarrecorder.sample, polarrecorder.validation.rules_core,
polarrecorder.validation.rules_heuristic, polarrecorder.validation.rules_stability,
polarrecorder.validation.state
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from polarrecorder.sample import ReadResult, RuleResult, Sample, build_sample
from polarrecorder.validation import rules_core, rules_heuristic, rules_stability

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.logger import Logger
    from polarrecorder.validation.state import ValidationState

PipelineDecision = Literal["accepted", "rejected", "quarantined"]


@dataclass(frozen=True)
class PipelineResult:
    """Final validation decision returned by the pipeline runner."""

    decision: PipelineDecision
    reason_codes: list[str]
    is_sailing_candidate: bool


def run(
    read_result: ReadResult,
    state: ValidationState,
    config: Config,
    logger: Logger | None = None,
) -> tuple[PipelineResult, Sample | None]:
    """Run validation rules in the PLAN1 order.

    Args:
        read_result: Raw store read.
        state: Prior rolling validation state.
        config: Runtime validation thresholds.
        logger: Optional future diagnostics hook.

    Returns:
        Pipeline result and the built sample, or ``None`` when R1/R2 rejects.
    """
    phase_a_result = _run_phase_a(read_result)
    if phase_a_result.decision == "reject":
        result = _rejected(phase_a_result.reason_codes, is_sailing_candidate=False)
        sample = None
    else:
        sample = build_sample(read_result)
        assert sample is not None
        result = _run_sample_rules(sample, state, config)

    if logger is not None:
        logger.debug(f"validation pipeline decision={result.decision}")
    return result, sample


def _run_sample_rules(sample: Sample, state: ValidationState, config: Config) -> PipelineResult:
    pre_candidate_result = _run_pre_candidate_rules(sample, config)
    if pre_candidate_result.decision == "reject":
        return _rejected(pre_candidate_result.reason_codes, is_sailing_candidate=False)

    candidate_result = _run_candidate_rules(sample, state, config)
    if candidate_result.decision == "reject":
        return _candidate_rejection(candidate_result.reason_codes)
    if candidate_result.decision == "quarantine":
        return PipelineResult(
            decision="quarantined",
            reason_codes=candidate_result.reason_codes,
            is_sailing_candidate=True,
        )
    return PipelineResult(decision="accepted", reason_codes=[], is_sailing_candidate=True)


def _run_phase_a(read_result: ReadResult) -> RuleResult:
    finite_result = rules_core.finite_values(read_result)
    required_result = rules_core.required_keys(read_result)
    reason_codes = finite_result.reason_codes + required_result.reason_codes
    if reason_codes:
        return RuleResult(decision="reject", reason_codes=reason_codes)
    return RuleResult(decision="pass", reason_codes=[])


def _run_pre_candidate_rules(sample: Sample, config: Config) -> RuleResult:
    for result in (
        rules_core.stale_values(sample, config),
        rules_core.age_skew(sample, config),
        rules_core.twa_range(sample, config),
        rules_core.tws_range(sample, config),
        rules_core.stw_range(sample, config),
        rules_core.head_to_wind(sample, config),
        rules_core.low_wind(sample, config),
        rules_core.anchored_heuristic(sample, config),
    ):
        if result.decision == "reject":
            return result
    return RuleResult(decision="pass", reason_codes=[])


def _run_candidate_rules(sample: Sample, state: ValidationState, config: Config) -> RuleResult:
    for result in (
        rules_stability.twa_rate_of_change(sample, state, config),
        rules_stability.tws_rate_of_change(sample, state, config),
        rules_stability.stw_acceleration(sample, state, config),
        rules_stability.maneuver_cooldown(sample, state, config),
        rules_stability.stability_window(sample, state, config),
        rules_heuristic.engine_heuristic(sample, config),
    ):
        if result.decision != "pass":
            return result
    return RuleResult(decision="pass", reason_codes=[])


def _candidate_rejection(reason_codes: list[str]) -> PipelineResult:
    return _rejected(reason_codes, is_sailing_candidate=reason_codes != ["reject_warming_up"])


def _rejected(reason_codes: list[str], is_sailing_candidate: bool) -> PipelineResult:
    return PipelineResult(
        decision="rejected",
        reason_codes=reason_codes,
        is_sailing_candidate=is_sailing_candidate,
    )
