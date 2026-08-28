"""Module: Validation Pipeline - Explicit runner for validation rules.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.config, polarrecorder.logger, polarrecorder.sample,
polarrecorder.validation.rules_core, polarrecorder.validation.rules_enhanced,
polarrecorder.validation.rules_heuristic, polarrecorder.validation.rules_stability,
polarrecorder.validation.state
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from polarrecorder.sample import ReadResult, RuleResult, Sample, build_sample
from polarrecorder.validation import rules_core, rules_enhanced, rules_heuristic, rules_stability

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.logger import Logger
    from polarrecorder.validation.state import ValidationState

PipelineDecision = Literal["accepted", "rejected", "quarantined"]
STABILITY_HISTORY_BREAK_REASONS = frozenset(
    {
        "quarantine_engine_suspected",
        "reject_sog_stw_mismatch",
        "reject_true_wind_crosscheck",
        "reject_heel_out_of_band",
    }
)


@dataclass(frozen=True)
class PipelineResult:
    """Final validation decision returned by the pipeline runner."""

    decision: PipelineDecision
    reason_codes: tuple[str, ...]
    is_sailing_candidate: bool
    retain_stability_history: bool = False
    failed_predicates: tuple[str, ...] = ()
    stability_evaluation: rules_stability.StabilityEvaluation | None = None


def suppressed(reason: str) -> PipelineResult:
    """Return a non-candidate result for a plugin-suppressed iteration."""
    return PipelineResult(
        decision="rejected",
        reason_codes=(reason,),
        is_sailing_candidate=False,
        failed_predicates=(reason,),
    )


def run(
    read_result: ReadResult,
    state: ValidationState,
    config: Config,
    logger: Logger | None = None,
) -> tuple[PipelineResult, Sample | None]:
    """Run validation rules in deterministic rejection order.

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
        result = _rejected(
            phase_a_result.reason_codes,
            is_sailing_candidate=False,
            failed_predicates=_predicate_codes((phase_a_result,)),
        )
        sample = None
    else:
        sample = build_sample(read_result)
        assert sample is not None
        result = _run_sample_rules(sample, state, config)

    if logger is not None:
        message = f"validation pipeline decision={result.decision}"
        logger.debug(message)
    return result, sample


def _run_sample_rules(sample: Sample, state: ValidationState, config: Config) -> PipelineResult:
    pre_candidate_result = _run_pre_candidate_rules(sample, config)
    if pre_candidate_result.decision == "reject":
        return _rejected(
            pre_candidate_result.reason_codes,
            is_sailing_candidate=False,
            failed_predicates=pre_candidate_result.predicate_codes,
        )

    candidate_result, stability = _run_candidate_rules(sample, state, config)
    if candidate_result.decision == "reject":
        return _candidate_rejection(
            candidate_result.reason_codes, candidate_result.predicate_codes, stability
        )
    if candidate_result.decision == "quarantine":
        return PipelineResult(
            decision="quarantined",
            reason_codes=candidate_result.reason_codes,
            is_sailing_candidate=True,
            retain_stability_history=False,
            failed_predicates=candidate_result.predicate_codes,
            stability_evaluation=stability,
        )
    return PipelineResult(
        decision="accepted",
        reason_codes=(),
        is_sailing_candidate=True,
        retain_stability_history=True,
        stability_evaluation=stability,
    )


def _run_phase_a(read_result: ReadResult) -> RuleResult:
    finite_result = rules_core.finite_values(read_result)
    required_result = rules_core.required_keys(read_result)
    reason_codes = finite_result.reason_codes + required_result.reason_codes
    if reason_codes:
        return RuleResult(
            decision="reject", reason_codes=reason_codes, predicate_codes=reason_codes
        )
    return RuleResult(decision="pass", reason_codes=())


def _run_pre_candidate_rules(sample: Sample, config: Config) -> RuleResult:
    results = (
        rules_core.stale_values(sample, config),
        rules_core.age_skew(sample, config),
        rules_core.twa_range(sample, config),
        rules_core.tws_range(sample, config),
        rules_core.stw_range(sample, config),
        rules_core.head_to_wind(sample, config),
        rules_core.low_wind(sample, config),
        rules_core.anchored_heuristic(sample, config),
        rules_enhanced.reject_engine_rpm(sample, config),
        rules_enhanced.reject_shallow(sample, config),
    )
    return _first_non_pass(results)


def _run_candidate_rules(
    sample: Sample, state: ValidationState, config: Config
) -> tuple[RuleResult, rules_stability.StabilityEvaluation]:
    stability = rules_stability.evaluate_stability(sample, state, config)
    results = (
        rules_stability.twa_rate_of_change(sample, state, config),
        rules_stability.tws_rate_of_change(sample, state, config),
        rules_stability.stw_acceleration(sample, state, config),
        rules_stability.maneuver_cooldown(sample, state, config),
        rules_stability.stability_decision(stability),
        rules_enhanced.reject_sog_stw_mismatch(sample, config),
        rules_enhanced.reject_true_wind_crosscheck(sample, config),
        rules_enhanced.reject_heel_out_of_band(sample, config),
        rules_heuristic.engine_heuristic(sample, config),
    )
    return _first_non_pass(results), stability


def _first_non_pass(results: tuple[RuleResult, ...]) -> RuleResult:
    failed = tuple(result for result in results if result.decision != "pass")
    if not failed:
        return RuleResult(decision="pass", reason_codes=())
    first = failed[0]
    return RuleResult(
        decision=first.decision,
        reason_codes=first.reason_codes,
        predicate_codes=_predicate_codes(failed),
    )


def _predicate_codes(results: tuple[RuleResult, ...]) -> tuple[str, ...]:
    codes: list[str] = []
    for result in results:
        source_codes = result.predicate_codes or result.reason_codes
        for code in source_codes:
            if code not in codes:
                codes.append(code)
    return tuple(codes)


def _candidate_rejection(
    reason_codes: tuple[str, ...],
    failed_predicates: tuple[str, ...],
    stability: rules_stability.StabilityEvaluation,
) -> PipelineResult:
    return _rejected(
        reason_codes,
        is_sailing_candidate=reason_codes != ("reject_warming_up",),
        retain_stability_history=STABILITY_HISTORY_BREAK_REASONS.isdisjoint(failed_predicates),
        failed_predicates=failed_predicates,
        stability_evaluation=stability,
    )


def _rejected(
    reason_codes: tuple[str, ...],
    is_sailing_candidate: bool,
    failed_predicates: tuple[str, ...],
    retain_stability_history: bool = False,
    stability_evaluation: rules_stability.StabilityEvaluation | None = None,
) -> PipelineResult:
    return PipelineResult(
        decision="rejected",
        reason_codes=reason_codes,
        is_sailing_candidate=is_sailing_candidate,
        retain_stability_history=retain_stability_history,
        failed_predicates=failed_predicates,
        stability_evaluation=stability_evaluation,
    )
