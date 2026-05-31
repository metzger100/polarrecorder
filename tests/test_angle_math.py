from __future__ import annotations

from polarrecorder.validation.angle_math import circular_distance, circular_range


def test_circular_distance_uses_shortest_wraparound_path() -> None:
    assert circular_distance(10.0, 350.0) == 20.0
    assert circular_distance(0.0, 360.0) == 0.0
    assert circular_distance(181.0, 179.0) == 2.0


def test_circular_range_handles_wraparound_and_identical_values() -> None:
    assert circular_range([350.0, 0.0, 10.0]) == 20.0
    assert circular_range([45.0, 45.0, 45.0]) == 0.0
    assert circular_range([]) == 0.0
    assert circular_range([0.0, 90.0, 180.0, 270.0]) == 270.0
