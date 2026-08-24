"""Module: Enhanced Input - Canonical optional-signal acquisition semantics.

Documentation: documentation/architecture/data-pipeline.md
Depends: none
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, Protocol

EnhancedInputState = Literal["missing", "stale", "invalid", "usable"]


class StoreEntryLike(Protocol):
    """Store entry shape needed to assess an enhanced input."""

    @property
    def value(self) -> object:
        """Return the raw store value."""
        ...

    @property
    def timestamp(self) -> object:
        """Return the monotonic store timestamp."""
        ...


@dataclass(frozen=True)
class EnhancedInput:
    """One optional signal's canonical acquisition result."""

    state: EnhancedInputState
    raw_value: object | None
    timestamp: float | None
    numeric_value: float | None


def assess_enhanced_input(
    entry: StoreEntryLike | None,
    now_monotonic: float,
    stale_threshold: float,
    *,
    accepts_bool: bool = False,
) -> EnhancedInput:
    """Classify one store entry exactly as the sampling path consumes it.

    Args:
        entry: Store entry, or ``None`` when the key is unavailable.
        now_monotonic: Current monotonic timestamp.
        stale_threshold: Maximum usable source age in seconds.
        accepts_bool: Whether this signal role permits boolean input.

    Returns:
        A complete missing, stale, invalid, or usable acquisition result.
    """
    if entry is None:
        return EnhancedInput("missing", None, None, None)
    timestamp = coerce_finite_timestamp(entry.timestamp)
    numeric = coerce_finite_float(entry.value, accepts_bool=accepts_bool)
    if timestamp is None or numeric is None:
        return EnhancedInput("invalid", entry.value, timestamp, None)
    if now_monotonic - timestamp > stale_threshold:
        return EnhancedInput("stale", entry.value, timestamp, numeric)
    return EnhancedInput("usable", entry.value, timestamp, numeric)


def coerce_finite_timestamp(value: object) -> float | None:
    """Return a finite numeric timestamp, rejecting booleans and strings."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        timestamp = float(value)
    except OverflowError:
        return None
    return timestamp if math.isfinite(timestamp) else None


def coerce_finite_float(value: object, *, accepts_bool: bool = False) -> float | None:
    """Coerce a supported scalar to a finite float.

    Args:
        value: Raw bool, number, or numeric string.
        accepts_bool: Whether boolean input maps to zero or one.

    Returns:
        The finite float, or ``None`` for unsupported or non-finite input.
    """
    coerced: float | None = None
    if isinstance(value, bool):
        if accepts_bool:
            coerced = 1.0 if value else 0.0
    elif isinstance(value, (int, float, str)):
        try:
            coerced = float(value)
        except (OverflowError, ValueError):
            coerced = None
    if coerced is None or not math.isfinite(coerced):
        return None
    return coerced
