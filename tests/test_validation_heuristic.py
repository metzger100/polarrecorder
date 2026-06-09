from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from polarrecorder.config import default_config
from polarrecorder.validation.rules_heuristic import RPM_OFF_CEILING, engine_heuristic
from validation_helpers import make_sample

if TYPE_CHECKING:
    from polarrecorder.sample import Sample


def _with_enhanced(tws_kt: float, stw_kt: float, enhanced: dict[str, float]) -> Sample:
    sample = make_sample(tws_kt=tws_kt, stw_kt=stw_kt)
    return replace(sample, enhanced=enhanced)


def test_r16_quarantines_suspected_engine_use() -> None:
    result = engine_heuristic(make_sample(tws_kt=4.0, stw_kt=4.0), default_config())

    assert result.decision == "quarantine"
    assert result.reason_codes == ["quarantine_engine_suspected"]


def test_r16_passes_non_engine_like_sample() -> None:
    result = engine_heuristic(make_sample(tws_kt=12.0, stw_kt=6.0), default_config())

    assert result.decision == "pass"
    assert result.reason_codes == []


def test_r16_suppressed_when_engine_state_reads_off() -> None:
    sample = _with_enhanced(4.0, 4.0, {"engine_signal": 0.0})

    result = engine_heuristic(sample, default_config())

    assert result.decision == "pass"


def test_r16_suppressed_when_rpm_reads_stopped() -> None:
    sample = _with_enhanced(4.0, 4.0, {"rpm": RPM_OFF_CEILING})

    result = engine_heuristic(sample, default_config())

    assert result.decision == "pass"


def test_r16_heuristic_still_runs_for_idle_band_rpm() -> None:
    sample = _with_enhanced(4.0, 4.0, {"rpm": 800.0})

    result = engine_heuristic(sample, default_config())

    assert result.decision == "quarantine"
    assert result.reason_codes == ["quarantine_engine_suspected"]


def test_r16_unchanged_when_no_engine_signal_present() -> None:
    quarantined = engine_heuristic(make_sample(tws_kt=4.0, stw_kt=4.0), default_config())
    passed = engine_heuristic(make_sample(tws_kt=12.0, stw_kt=6.0), default_config())

    assert quarantined.decision == "quarantine"
    assert passed.decision == "pass"
