from __future__ import annotations

import math
from dataclasses import dataclass, replace

import pytest
from polarrecorder.config import default_config
from polarrecorder.diagnostics import data_status
from polarrecorder.enhanced_input import assess_enhanced_input
from polarrecorder.validation.pipeline import run
from validation_helpers import make_read_result, make_warmed_state

_INVALID_TIMESTAMPS = (
    None,
    "99.5",
    True,
    math.nan,
    math.inf,
    -math.inf,
    10**10000,
)
_INVALID_TIMESTAMP_IDS = (
    "none",
    "string",
    "bool",
    "nan",
    "inf",
    "negative-inf",
    "huge",
)


@dataclass(frozen=True)
class _Entry:
    value: object
    timestamp: object


@pytest.mark.parametrize(
    "timestamp",
    _INVALID_TIMESTAMPS,
    ids=_INVALID_TIMESTAMP_IDS,
)
def test_invalid_core_timestamps_are_total_and_never_ready(timestamp: object) -> None:
    read_result = replace(make_read_result(), twa_timestamp=timestamp)

    result, sample = run(read_result, make_warmed_state(), default_config())

    assert result.decision == "rejected"
    assert sample is None
    assert not result.is_sailing_candidate
    assert data_status(read_result, default_config().stale_threshold) == "partial"


def test_finite_core_timestamp_with_small_future_offset_remains_usable() -> None:
    read_result = replace(make_read_result(), twa_timestamp=100.1)

    result, sample = run(read_result, make_warmed_state(), default_config())

    assert result.decision == "accepted"
    assert sample is not None
    assert sample.freshness.twa_age_s == pytest.approx(-0.1)
    assert data_status(read_result, default_config().stale_threshold) == "receiving"


@pytest.mark.parametrize(
    "timestamp",
    _INVALID_TIMESTAMPS,
    ids=_INVALID_TIMESTAMP_IDS,
)
def test_invalid_enhanced_timestamps_are_unusable_without_crashing(timestamp: object) -> None:
    result = assess_enhanced_input(_Entry(12.0, timestamp), 100.0, 3.0)

    assert result.state == "invalid"
    assert result.timestamp is None
    assert result.numeric_value is None


def test_finite_enhanced_timestamp_with_small_future_offset_is_usable() -> None:
    result = assess_enhanced_input(_Entry(12.0, 100.1), 100.0, 3.0)

    assert result.state == "usable"
    assert result.timestamp == 100.1
    assert result.numeric_value == 12.0
