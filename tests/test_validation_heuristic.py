from __future__ import annotations

from polarrecorder.config import default_config
from polarrecorder.validation import rules_enhanced
from polarrecorder.validation.rules_heuristic import engine_heuristic
from validation_helpers import make_sample


def test_r16_quarantines_suspected_engine_use() -> None:
    result = engine_heuristic(make_sample(tws_kt=4.0, stw_kt=4.0), default_config())

    assert result.decision == "quarantine"
    assert result.reason_codes == ["quarantine_engine_suspected"]


def test_r16_passes_non_engine_like_sample() -> None:
    result = engine_heuristic(make_sample(tws_kt=12.0, stw_kt=6.0), default_config())

    assert result.decision == "pass"
    assert result.reason_codes == []
    assert rules_enhanced.__name__ == "polarrecorder.validation.rules_enhanced"
