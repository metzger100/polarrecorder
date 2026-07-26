from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st
from polarrecorder.validation.angle_math import circular_distance, circular_range

_ANGLE = st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False)


def test_circular_distance_uses_shortest_wraparound_path() -> None:
    assert circular_distance(10.0, 350.0) == 20.0
    assert circular_distance(0.0, 360.0) == 0.0
    assert circular_distance(181.0, 179.0) == 2.0


def test_circular_range_handles_wraparound_and_identical_values() -> None:
    assert circular_range([350.0, 0.0, 10.0]) == 20.0
    assert circular_range([45.0, 45.0, 45.0]) == 0.0
    assert circular_range([]) == 0.0
    assert circular_range([0.0, 90.0, 180.0, 270.0]) == 270.0


@given(a=_ANGLE, b=_ANGLE)
def test_circular_distance_is_symmetric(a: float, b: float) -> None:
    assert circular_distance(a, b) == circular_distance(b, a)


@given(a=_ANGLE, b=_ANGLE, turns=st.integers(min_value=-1000, max_value=1000))
def test_circular_distance_is_rotation_invariant(a: float, b: float, turns: int) -> None:
    rotated = circular_distance(a + turns * 360.0, b)
    assert abs(rotated - circular_distance(a, b)) < 1e-6


@given(a=_ANGLE, b=_ANGLE)
def test_circular_distance_is_bounded(a: float, b: float) -> None:
    distance = circular_distance(a, b)
    assert 0.0 <= distance <= 180.0


@given(values=st.lists(_ANGLE, min_size=1, max_size=20))
def test_circular_range_is_bounded(values: list[float]) -> None:
    # Floating-point modulo/subtraction can overshoot the true [0, 360] bound by a few
    # ULPs (e.g. near-identical values whose "% 360.0" results differ in the last bit);
    # tolerate that instead of asserting exact floating-point bounds.
    epsilon = 1e-9
    assert -epsilon <= circular_range(values) <= 360.0 + epsilon


@given(
    values=st.lists(_ANGLE, min_size=2, max_size=20),
    turns=st.integers(min_value=-1000, max_value=1000),
)
def test_circular_range_is_rotation_invariant(values: list[float], turns: int) -> None:
    rotated = [value + turns * 360.0 for value in values]
    assert abs(circular_range(rotated) - circular_range(values)) < 1e-6
