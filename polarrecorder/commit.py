"""Module: Commit - Pure per-sample model dispatch.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.polar_model, polarrecorder.sample, polarrecorder.validation.pipeline
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from polarrecorder.polar_model import PolarModel
    from polarrecorder.sample import Sample
    from polarrecorder.validation.pipeline import PipelineResult


def commit_sample(
    pipeline_result: PipelineResult,
    sample: Sample | None,
    model: PolarModel,
) -> None:
    """Route one pipeline result to the polar model update contract.

    Args:
        pipeline_result: Final validation decision for the read.
        sample: Built sample returned by the pipeline, or ``None`` for R1/R2.
        model: Polar model to update for accepted, rejected, or quarantined
            sailing candidates.
    """
    if sample is None:
        return

    if pipeline_result.decision == "accepted":
        model.update_accepted(sample)
        return

    if pipeline_result.decision == "rejected" and pipeline_result.is_sailing_candidate:
        model.record_rejection(sample, pipeline_result.reason_codes)
        return

    if pipeline_result.decision == "quarantined":
        model.record_quarantine(sample, _single_reason_code(pipeline_result))


def _single_reason_code(pipeline_result: PipelineResult) -> str:
    reason_codes = pipeline_result.reason_codes
    if len(reason_codes) != 1:
        msg = "quarantine decisions must carry exactly one reason code"
        raise ValueError(msg)
    return reason_codes[0]
