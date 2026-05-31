from __future__ import annotations

import math

from polarrecorder.sample import ReadResult, RuleResult, build_sample


def make_read_result(
    twa_raw: float | None = 270.0,
    tws_raw: float | None = 2.0,
    stw_raw: float | None = 3.0,
) -> ReadResult:
    return ReadResult(
        timestamp_monotonic=100.0,
        timestamp_wall=1000.0,
        twa_raw=twa_raw,
        tws_raw=tws_raw,
        stw_raw=stw_raw,
        twa_timestamp=99.5,
        tws_timestamp=98.0,
        stw_timestamp=99.0,
    )


def test_build_sample_converts_units_and_freshness() -> None:
    sample = build_sample(make_read_result())

    assert sample is not None
    assert sample.twa_deg_raw == 270.0
    assert sample.tws_ms == 2.0
    assert sample.stw_ms == 3.0
    assert math.isclose(sample.tws_kt, 3.88768)
    assert math.isclose(sample.stw_kt, 5.83152)
    assert sample.freshness.twa_age_s == 0.5
    assert sample.freshness.tws_age_s == 2.0
    assert sample.freshness.stw_age_s == 1.0
    assert sample.freshness.max_age_s == 2.0
    assert sample.freshness.age_skew_s == 1.5
    assert sample.enhanced is None


def test_build_sample_normalizes_twa_abs_and_signed_values() -> None:
    cases = [
        (0.0, 0.0, 0.0),
        (90.0, 90.0, 90.0),
        (180.0, 180.0, 180.0),
        (270.0, 90.0, -90.0),
        (352.0, 8.0, -8.0),
        (370.0, 10.0, 10.0),
    ]

    for raw, expected_abs, expected_signed in cases:
        sample = build_sample(make_read_result(twa_raw=raw))

        assert sample is not None
        assert sample.twa_deg_abs == expected_abs
        assert sample.twa_deg_signed == expected_signed


def test_build_sample_returns_none_for_missing_core_values() -> None:
    assert build_sample(make_read_result(twa_raw=None)) is None
    assert build_sample(make_read_result(tws_raw=None)) is None
    assert build_sample(make_read_result(stw_raw=None)) is None


def test_build_sample_returns_none_for_non_finite_core_values() -> None:
    assert build_sample(make_read_result(twa_raw=math.nan)) is None
    assert build_sample(make_read_result(tws_raw=math.inf)) is None
    assert build_sample(make_read_result(stw_raw=-math.inf)) is None


def test_rule_result_is_shared_pipeline_rule_type() -> None:
    result = RuleResult(decision="reject", reason_codes=["reject_low_wind"])

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_low_wind"]
