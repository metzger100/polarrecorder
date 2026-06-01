"""Module: Angle Math - Circular TWA calculations for validation.

Documentation: documentation/filters/rejection-rules.md
Depends: none
"""

from __future__ import annotations

FULL_CIRCLE_DEGREES = 360.0
MIN_RANGE_VALUES = 2


def circular_distance(a: float, b: float) -> float:
    """Return the shortest distance between two circular angles.

    Args:
        a: First angle in degrees.
        b: Second angle in degrees.

    Returns:
        Shortest angular distance in degrees.
    """
    distance = abs((a % FULL_CIRCLE_DEGREES) - (b % FULL_CIRCLE_DEGREES))
    return min(distance, FULL_CIRCLE_DEGREES - distance)


def circular_range(values: list[float]) -> float:
    """Return the smallest arc containing all angles.

    Args:
        values: Angles in degrees.

    Returns:
        Circular range in degrees, or ``0.0`` for an empty or identical list.
    """
    if len(values) < MIN_RANGE_VALUES:
        return 0.0

    sorted_values = sorted(value % FULL_CIRCLE_DEGREES for value in values)
    gaps = [
        sorted_values[index + 1] - sorted_values[index] for index in range(len(sorted_values) - 1)
    ]
    gaps.append(sorted_values[0] + FULL_CIRCLE_DEGREES - sorted_values[-1])
    largest_gap = max(gaps)
    return FULL_CIRCLE_DEGREES - largest_gap
