"""Module: Diagnostics - Pure structured replay diagnostics.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.config, polarrecorder.sample, polarrecorder.validation.pipeline,
polarrecorder.validation.rules_stability
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, NamedTuple

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.sample import ReadResult, Sample
    from polarrecorder.validation.pipeline import PipelineResult
    from polarrecorder.validation.rules_stability import StabilityEvaluation

DIAGNOSTIC_SCHEMA_VERSION = 2


class CurrentValues(NamedTuple):
    """Latest normalized core values retained for status rendering."""

    twa_deg: float
    tws_kt: float
    stw_kt: float
    twa_timestamp: float
    tws_timestamp: float
    stw_timestamp: float


def data_status(read_result: ReadResult) -> str:
    """Classify the core-read presence for host status reporting."""
    present = (
        read_result.twa_raw is not None,
        read_result.tws_raw is not None,
        read_result.stw_raw is not None,
    )
    if all(present):
        return "receiving"
    if any(present):
        return "partial"
    return "no_data"


def format_sample_diagnostic(
    read_result: ReadResult,
    sample: Sample | None,
    result: PipelineResult,
    config: Config,
) -> dict[str, object]:
    """Format one finite, JSON-compatible per-iteration diagnostic payload.

    Args:
        read_result: Reader output for the current iteration.
        sample: Normalized sample, when the core values were safe to normalize.
        result: Pipeline decision for the iteration.
        config: Runtime thresholds that govern the decision.

    Returns:
        Replay-oriented diagnostic fields with unavailable numbers represented by ``None``.
    """
    payload: dict[str, object] = {
        "schema_version": DIAGNOSTIC_SCHEMA_VERSION,
        "timestamp_wall": _finite_or_none(read_result.timestamp_wall),
        "timestamp_monotonic": _finite_or_none(read_result.timestamp_monotonic),
        "core_raw": _core_raw_values(read_result),
        "core_normalized": _core_normalized_values(sample),
        "core_sources": _core_sources(read_result),
        "enhanced": _enhanced_values(read_result, sample),
        "pipeline": {
            "decision": result.decision,
            "reason_codes": result.reason_codes,
            "failed_predicates": result.failed_predicates,
            "is_sailing_candidate": result.is_sailing_candidate,
        },
        "r15": _stability_values(result.stability_evaluation),
        "config": _diagnostic_config(config),
    }
    return payload


def _core_raw_values(read_result: ReadResult) -> dict[str, float | None]:
    return {
        "twa": _finite_or_none(read_result.twa_raw),
        "tws_ms": _finite_or_none(read_result.tws_raw),
        "stw_ms": _finite_or_none(read_result.stw_raw),
    }


def _core_normalized_values(sample: Sample | None) -> dict[str, float | None]:
    if sample is None:
        return {"twa_deg": None, "tws_kt": None, "stw_kt": None}
    return {
        "twa_deg": _finite_or_none(sample.twa_deg_raw),
        "tws_kt": _finite_or_none(sample.tws_kt),
        "stw_kt": _finite_or_none(sample.stw_kt),
    }


def _core_sources(read_result: ReadResult) -> dict[str, dict[str, float | None]]:
    return {
        "twa": _source_metadata(read_result.twa_timestamp, read_result.timestamp_monotonic),
        "tws": _source_metadata(read_result.tws_timestamp, read_result.timestamp_monotonic),
        "stw": _source_metadata(read_result.stw_timestamp, read_result.timestamp_monotonic),
    }


def _enhanced_values(
    read_result: ReadResult, sample: Sample | None
) -> dict[str, dict[str, object]]:
    if read_result.enhanced_inputs is None:
        return {}
    normalized = {} if sample is None or sample.enhanced is None else sample.enhanced
    values: dict[str, dict[str, object]] = {}
    for role, acquisition in read_result.enhanced_inputs.items():
        values[role] = {
            "state": acquisition.state,
            "raw": _finite_or_none(acquisition.raw_value),
            "normalized": _finite_or_none(normalized.get(role)),
            **_source_metadata(acquisition.timestamp, read_result.timestamp_monotonic),
        }
    return values


def _stability_values(
    evaluation: StabilityEvaluation | None,
) -> dict[str, bool | float | None]:
    if evaluation is None:
        return {
            "filled": False,
            "window_span_seconds": None,
            "twa_range": None,
            "tws_range": None,
            "stw_range": None,
        }
    return {
        "filled": evaluation.filled,
        "window_span_seconds": _finite_or_none(evaluation.window_span_seconds),
        "twa_range": _finite_or_none(evaluation.twa_range),
        "tws_range": _finite_or_none(evaluation.tws_range),
        "stw_range": _finite_or_none(evaluation.stw_range),
    }


def _source_metadata(timestamp: float | None, now: float) -> dict[str, float | None]:
    finite_timestamp = _finite_or_none(timestamp)
    if finite_timestamp is None:
        return {"timestamp": None, "age_seconds": None}
    return {
        "timestamp": finite_timestamp,
        "age_seconds": _finite_or_none(now - finite_timestamp),
    }


def _diagnostic_config(config: Config) -> dict[str, float]:
    return {
        "stability_window_seconds": float(config.stability_window_seconds),
        "stability_twa_range": config.stability_twa_range,
        "stability_tws_range": config.stability_tws_range,
        "stability_stw_range": config.stability_stw_range,
        "anchoring_speed_floor_kt": config.anchored_stw_threshold,
        "sog_stw_movement_floor_kt": config.enh_slip_sog_floor_kt,
        "sog_stw_ratio": config.enh_slip_ratio,
    }


def _finite_or_none(value: object) -> float | None:
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value)
