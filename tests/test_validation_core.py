from __future__ import annotations

import math
from typing import cast

from polarrecorder.config import default_config
from polarrecorder.sample import ReadResult
from polarrecorder.validation import rules_core
from validation_helpers import make_read_result, make_sample


def test_r1_reports_all_non_finite_raw_values() -> None:
    result = rules_core.finite_values(
        ReadResult(
            timestamp_monotonic=100.0,
            timestamp_wall=1000.0,
            twa_raw=math.nan,
            tws_raw=math.inf,
            stw_raw=cast("float", "bad"),
            twa_timestamp=99.0,
            tws_timestamp=99.0,
            stw_timestamp=99.0,
        )
    )

    assert result.decision == "reject"
    assert result.reason_codes == [
        "reject_non_finite_twa",
        "reject_non_finite_tws",
        "reject_non_finite_stw",
    ]


def test_r2_reports_all_missing_required_keys() -> None:
    result = rules_core.required_keys(make_read_result(twa_raw=None, tws_kt=None, stw_kt=None))

    assert result.decision == "reject"
    assert result.reason_codes == [
        "reject_missing_twa",
        "reject_missing_tws",
        "reject_missing_stw",
    ]


def test_r3_reports_all_stale_values() -> None:
    sample = make_sample(ages=(4.0, 5.0, 6.0))
    result = rules_core.stale_values(sample, default_config())

    assert result.decision == "reject"
    assert result.reason_codes == [
        "reject_stale_twa",
        "reject_stale_tws",
        "reject_stale_stw",
    ]


def test_r4_through_r10_return_expected_reason_codes() -> None:
    config = default_config()
    cases = [
        (
            rules_core.age_skew(make_sample(ages=(0.0, 0.0, 3.0)), config),
            "reject_age_skew",
        ),
        (rules_core.twa_range(make_sample(twa_raw=400.0), config), "reject_twa_range"),
        (rules_core.tws_range(make_sample(tws_kt=-5.0), config), "reject_tws_range"),
        (rules_core.stw_range(make_sample(stw_kt=45.0), config), "reject_stw_range"),
        (rules_core.head_to_wind(make_sample(twa_raw=5.0), config), "reject_head_to_wind"),
        (rules_core.low_wind(make_sample(tws_kt=2.0), config), "reject_low_wind"),
        (
            rules_core.anchored_heuristic(make_sample(tws_kt=12.0, stw_kt=0.2), config),
            "reject_anchored",
        ),
    ]

    for result, code in cases:
        assert result.decision == "reject"
        assert result.reason_codes == [code]


def test_core_rules_pass_clean_sample() -> None:
    config = default_config()
    sample = make_sample()

    assert rules_core.finite_values(make_read_result()).decision == "pass"
    assert rules_core.required_keys(make_read_result()).decision == "pass"
    assert rules_core.stale_values(sample, config).decision == "pass"
    assert rules_core.age_skew(sample, config).decision == "pass"
    assert rules_core.twa_range(sample, config).decision == "pass"
    assert rules_core.tws_range(sample, config).decision == "pass"
    assert rules_core.stw_range(sample, config).decision == "pass"
    assert rules_core.head_to_wind(sample, config).decision == "pass"
    assert rules_core.low_wind(sample, config).decision == "pass"
    assert rules_core.anchored_heuristic(sample, config).decision == "pass"
