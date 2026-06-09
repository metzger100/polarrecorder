from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from polarrecorder.config import Config, default_config
from polarrecorder.validation import rules_enhanced
from validation_helpers import make_sample

if TYPE_CHECKING:
    from polarrecorder.sample import Sample


def _sample(
    enhanced: dict[str, float] | None,
    *,
    twa_raw: float = 90.0,
    tws_kt: float = 12.0,
    stw_kt: float = 6.0,
) -> Sample:
    sample = make_sample(twa_raw=twa_raw, tws_kt=tws_kt, stw_kt=stw_kt)
    return replace(sample, enhanced=enhanced)


def test_reject_engine_rpm_above_idle_ceiling() -> None:
    config = default_config()

    assert rules_enhanced.reject_engine_rpm(_sample({"rpm": 1500.0}), config).decision == "reject"
    assert rules_enhanced.reject_engine_rpm(_sample({"rpm": 900.0}), config).decision == "pass"
    assert rules_enhanced.reject_engine_rpm(_sample({"rpm": 500.0}), config).decision == "pass"
    assert rules_enhanced.reject_engine_rpm(_sample(None), config).decision == "pass"


def test_reject_engine_on_against_threshold_for_each_source() -> None:
    boolean_config = replace(default_config(), enh_engine_state_on_threshold=0.5)
    rpm_config = replace(default_config(), enh_engine_state_on_threshold=50.0)
    voltage_config = replace(default_config(), enh_engine_state_on_threshold=13.2)

    on = rules_enhanced.reject_engine_on
    assert on(_sample({"engine_signal": 0.5}), boolean_config).decision == "reject"
    assert on(_sample({"engine_signal": 0.0}), boolean_config).decision == "pass"
    assert on(_sample({"engine_signal": 50.0}), rpm_config).decision == "reject"
    assert on(_sample({"engine_signal": 30.0}), rpm_config).decision == "pass"
    assert on(_sample({"engine_signal": 13.2}), voltage_config).decision == "reject"
    assert on(_sample({"engine_signal": 12.0}), voltage_config).decision == "pass"
    assert on(_sample(None), boolean_config).decision == "pass"


def test_reject_shallow_below_floor() -> None:
    config = default_config()

    assert rules_enhanced.reject_shallow(_sample({"depth_m": 0.5}), config).decision == "reject"
    assert rules_enhanced.reject_shallow(_sample({"depth_m": 1.0}), config).decision == "pass"
    assert rules_enhanced.reject_shallow(_sample({"depth_m": 3.0}), config).decision == "pass"
    assert rules_enhanced.reject_shallow(_sample(None), config).decision == "pass"


def test_reject_sog_stw_mismatch_paddlewheel_failure() -> None:
    config = default_config()
    mismatch = rules_enhanced.reject_sog_stw_mismatch

    # STW implausibly low, current too small to explain the gap -> reject.
    reject = mismatch(_sample({"sog_kt": 5.0, "current_drift_kt": 0.5}, stw_kt=1.0), config)
    assert reject.decision == "reject"

    # Healthy STW relative to SOG -> pass.
    healthy = mismatch(_sample({"sog_kt": 5.0, "current_drift_kt": 0.5}, stw_kt=4.0), config)
    assert healthy.decision == "pass"

    # No current-drift reading -> following-current safety case, pass.
    no_drift = mismatch(_sample({"sog_kt": 5.0}, stw_kt=1.0), config)
    assert no_drift.decision == "pass"

    # Current large enough to explain the gap -> honest following current, pass.
    explained = mismatch(_sample({"sog_kt": 2.0, "current_drift_kt": 1.3}, stw_kt=0.8), config)
    assert explained.decision == "pass"

    # SOG below the moving floor -> pass.
    not_moving = mismatch(_sample({"sog_kt": 0.8, "current_drift_kt": 0.0}, stw_kt=0.1), config)
    assert not_moving.decision == "pass"


def test_reject_true_wind_crosscheck_with_known_triangle() -> None:
    config = default_config()
    crosscheck = rules_enhanced.reject_true_wind_crosscheck
    enhanced = {"awa_deg": 90.0, "aws_kt": 10.0}

    # Boat stationary: apparent wind equals true wind, so TWA=90, TWS=10 -> pass.
    consistent = crosscheck(_sample(enhanced, twa_raw=90.0, tws_kt=10.0, stw_kt=0.0), config)
    assert consistent.decision == "pass"

    # Reported TWA far off recomputed true wind -> reject.
    twa_off = crosscheck(_sample(enhanced, twa_raw=130.0, tws_kt=10.0, stw_kt=0.0), config)
    assert twa_off.decision == "reject"

    # Reported TWS far off recomputed true wind -> reject.
    tws_off = crosscheck(_sample(enhanced, twa_raw=90.0, tws_kt=4.0, stw_kt=0.0), config)
    assert tws_off.decision == "reject"

    assert crosscheck(_sample(None, stw_kt=0.0), config).decision == "pass"


def test_reject_heel_out_of_band_upper_and_lower() -> None:
    config = default_config()
    heel = rules_enhanced.reject_heel_out_of_band

    assert heel(_sample({"heel_deg": 40.0}), config).decision == "reject"
    assert heel(_sample({"heel_deg": -40.0}), config).decision == "reject"
    assert heel(_sample({"heel_deg": 20.0}), config).decision == "pass"
    assert heel(_sample(None), config).decision == "pass"

    min_config = replace(config, enh_heel_min_deg=5.0)
    assert heel(_sample({"heel_deg": 3.0}), min_config).decision == "reject"
    assert heel(_sample({"heel_deg": 10.0}), min_config).decision == "pass"


def test_each_enhanced_reject_emits_only_its_reason_code() -> None:
    config: Config = default_config()

    assert rules_enhanced.reject_engine_rpm(_sample({"rpm": 2000.0}), config).reason_codes == [
        "reject_engine_rpm"
    ]
    assert rules_enhanced.reject_engine_on(
        _sample({"engine_signal": 1.0}), config
    ).reason_codes == ["reject_engine_on"]
    assert rules_enhanced.reject_shallow(_sample({"depth_m": 0.2}), config).reason_codes == [
        "reject_shallow"
    ]
    assert rules_enhanced.reject_heel_out_of_band(
        _sample({"heel_deg": 80.0}), config
    ).reason_codes == ["reject_heel_out_of_band"]
