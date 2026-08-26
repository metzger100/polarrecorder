"""Module: Units - Speed unit conversion helpers.

Documentation: documentation/architecture/polar-model.md
Depends: none
"""

from __future__ import annotations

import math
import sys

MPS_TO_KNOTS = 1.94384
MAX_FINITE_MPS_FOR_KNOTS = sys.float_info.max / MPS_TO_KNOTS


def meters_per_second_to_knots(speed_ms: float) -> float:
    """Convert meters per second to knots.

    Args:
        speed_ms: Speed in meters per second.

    Returns:
        The speed in knots.
    """
    return speed_ms * MPS_TO_KNOTS


def is_finite_meters_per_second_input(speed_ms: object | None) -> bool:
    """Return whether a value converts to a finite knot speed.

    Args:
        speed_ms: Untrusted meters-per-second input.

    Returns:
        ``True`` for finite numeric non-boolean values whose converted knot
        value is also finite.
    """
    if isinstance(speed_ms, bool) or not isinstance(speed_ms, (int, float)):
        return False
    try:
        return math.isfinite(speed_ms) and abs(speed_ms) <= MAX_FINITE_MPS_FOR_KNOTS
    except OverflowError:
        return False


def knots_to_meters_per_second(speed_kt: float) -> float:
    """Convert knots to meters per second.

    Args:
        speed_kt: Speed in knots.

    Returns:
        The speed in meters per second.
    """
    return speed_kt / MPS_TO_KNOTS
