"""Module: Diagnostics - Pure structured replay diagnostics.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.config, polarrecorder.sample, polarrecorder.validation.pipeline,
polarrecorder.validation.rules_stability, polarrecorder.validation.state
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any, NamedTuple

from polarrecorder.validation.rules_stability import evaluate_stability

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.sample import ReadResult, Sample
    from polarrecorder.validation.pipeline import PipelineResult
    from polarrecorder.validation.state import ValidationState


class CurrentValues(NamedTuple):
    """Latest normalized core values retained for status rendering."""

    twa_deg: float
    tws_kt: float
    stw_kt: float
    twa_timestamp: float
    tws_timestamp: float
    stw_timestamp: float


class StoreBoundaryAdapter:
    """Adapt the host store spelling to the domain reader contract."""

    def __init__(self, api: Any) -> None:
        """Store the host API boundary."""
        self._api = api

    def get_single_value(self, key: str, include_info: bool = False) -> Any:
        """Read one host store value using the domain naming contract."""
        return self._api.getSingleValue(key, includeInfo=include_info)


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
    state: ValidationState,
    config: Config,
) -> dict[str, object]:
    """Format one finite, JSON-compatible per-iteration diagnostic payload.

    Args:
        read_result: Reader output for the current iteration.
        sample: Normalized sample, when the core values were safe to normalize.
        result: Pipeline decision for the iteration.
        state: Retained validation state before the current sample is observed.
        config: Runtime thresholds that govern the decision.

    Returns:
        Replay-oriented diagnostic fields with unavailable numbers represented by ``None``.
    """
    payload: dict[str, object] = {
        "timestamp_wall": _finite_or_none(read_result.timestamp_wall),
        "timestamp_monotonic": _finite_or_none(read_result.timestamp_monotonic),
        "core": _core_values(sample),
        "enhanced": _enhanced_values(sample),
        "pipeline": {
            "decision": result.decision,
            "reason_codes": result.reason_codes,
            "failed_predicates": result.failed_predicates,
            "is_sailing_candidate": result.is_sailing_candidate,
        },
        "r15": _stability_values(sample, state, config),
        "config": _diagnostic_config(config),
    }
    return payload


def _core_values(sample: Sample | None) -> dict[str, float | None]:
    if sample is None:
        return {"twa_deg": None, "tws_kt": None, "stw_kt": None}
    return {
        "twa_deg": _finite_or_none(sample.twa_deg_raw),
        "tws_kt": _finite_or_none(sample.tws_kt),
        "stw_kt": _finite_or_none(sample.stw_kt),
    }


def _enhanced_values(sample: Sample | None) -> dict[str, float]:
    if sample is None or sample.enhanced is None:
        return {}
    return {
        role: value for role, value in sample.enhanced.items() if _finite_or_none(value) is not None
    }


def _stability_values(
    sample: Sample | None, state: ValidationState, config: Config
) -> dict[str, bool | float | None]:
    if sample is None:
        return {
            "filled": False,
            "window_span_seconds": None,
            "twa_range": None,
            "tws_range": None,
            "stw_range": None,
        }
    evaluation = evaluate_stability(sample, state, config)
    return {
        "filled": evaluation.filled,
        "window_span_seconds": _finite_or_none(evaluation.window_span_seconds),
        "twa_range": _finite_or_none(evaluation.twa_range),
        "tws_range": _finite_or_none(evaluation.tws_range),
        "stw_range": _finite_or_none(evaluation.stw_range),
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


def _finite_or_none(value: float | None) -> float | None:
    if value is None or not math.isfinite(value):
        return None
    return value
