"""Module: Units - Speed unit conversion helpers.

Documentation: documentation/architecture/polar-model.md
Depends: none
"""

from __future__ import annotations

MPS_TO_KNOTS = 1.94384


def meters_per_second_to_knots(speed_ms: float) -> float:
    """Convert meters per second to knots.

    Args:
        speed_ms: Speed in meters per second.

    Returns:
        The speed in knots.
    """
    return speed_ms * MPS_TO_KNOTS


def knots_to_meters_per_second(speed_kt: float) -> float:
    """Convert knots to meters per second.

    Args:
        speed_kt: Speed in knots.

    Returns:
        The speed in meters per second.
    """
    return speed_kt / MPS_TO_KNOTS
