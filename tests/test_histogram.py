from __future__ import annotations

import math

from hypothesis import given
from hypothesis import strategies as st
from polarrecorder.histogram import add_sample, merge_histograms, percentile, speed_key

_DECIKNOT_KEY = st.integers(min_value=0, max_value=600)
_COUNT = st.integers(min_value=1, max_value=1000)
_HISTOGRAM = st.dictionaries(_DECIKNOT_KEY, _COUNT, min_size=1, max_size=20)
_PERCENTILE_VALUE = st.floats(min_value=1.0, max_value=99.0, allow_nan=False, allow_infinity=False)


def test_speed_key_rounds_to_deciknot() -> None:
    assert speed_key(5.84) == 58
    assert speed_key(5.86) == 59


def test_add_sample_increments_histogram() -> None:
    histogram: dict[int, int] = {}

    add_sample(histogram, 5.84)
    add_sample(histogram, 5.86)
    add_sample(histogram, 5.86)

    assert histogram == {58: 1, 59: 2}


def test_merge_histograms_returns_detached_sum() -> None:
    first = {58: 1, 60: 2}
    second = {60: 3, 61: 4}

    merged = merge_histograms([first, second])
    first[58] = 99

    assert merged == {58: 1, 60: 5, 61: 4}


def test_percentile_returns_none_for_empty_histogram() -> None:
    assert percentile({}, 65) is None


def test_percentile_locks_plan_worked_example() -> None:
    assert percentile({58: 12, 59: 47, 60: 31, 61: 18}, 65) == 6.0


def test_percentile_locks_exact_boundary_lower_key() -> None:
    assert percentile({58: 50, 60: 50}, 50) == 5.8


def test_percentile_is_monotonic_non_decreasing() -> None:
    histogram = {48: 3, 52: 7, 58: 11, 61: 13, 66: 17}
    previous = percentile(histogram, 1)

    assert previous is not None
    for percentile_value in range(2, 100):
        current = percentile(histogram, percentile_value)

        assert current is not None
        assert current >= previous
        previous = current


@given(histogram=_HISTOGRAM, percentile_value=_PERCENTILE_VALUE)
def test_percentile_is_none_only_for_empty_input(
    histogram: dict[int, int], percentile_value: float
) -> None:
    assert percentile(histogram, percentile_value) is not None
    assert percentile({}, percentile_value) is None


@given(histogram=_HISTOGRAM, percentile_value=_PERCENTILE_VALUE)
def test_percentile_is_finite_and_an_observed_key(
    histogram: dict[int, int], percentile_value: float
) -> None:
    result = percentile(histogram, percentile_value)

    assert result is not None
    assert math.isfinite(result)
    observed_keys = {key / 10.0 for key in histogram}
    assert result in observed_keys


@given(histogram=_HISTOGRAM)
def test_percentile_is_monotonic_for_arbitrary_histograms(histogram: dict[int, int]) -> None:
    previous = percentile(histogram, 1)

    assert previous is not None
    for percentile_value in range(2, 100):
        current = percentile(histogram, percentile_value)

        assert current is not None
        assert current >= previous
        previous = current
