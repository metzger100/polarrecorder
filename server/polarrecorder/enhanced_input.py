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
    def timestamp(self) -> float:
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
) -> EnhancedInput:
    """Classify one store entry exactly as the sampling path consumes it.

    Args:
        entry: Store entry, or ``None`` when the key is unavailable.
        now_monotonic: Current monotonic timestamp.
        stale_threshold: Maximum usable source age in seconds.

    Returns:
        A complete missing, stale, invalid, or usable acquisition result.
    """
    if entry is None:
        return EnhancedInput("missing", None, None, None)
    numeric = coerce_finite_float(entry.value)
    if numeric is None:
        return EnhancedInput("invalid", entry.value, entry.timestamp, None)
    if now_monotonic - entry.timestamp > stale_threshold:
        return EnhancedInput("stale", entry.value, entry.timestamp, numeric)
    return EnhancedInput("usable", entry.value, entry.timestamp, numeric)


def coerce_finite_float(value: object) -> float | None:
    """Coerce a supported scalar to a finite float.

    Args:
        value: Raw bool, number, or numeric string.

    Returns:
        The finite float, or ``None`` for unsupported or non-finite input.
    """
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    try:
        coerced = float(value) if isinstance(value, (int, float, str)) else None
    except ValueError:
        return None
    if coerced is None or not math.isfinite(coerced):
        return None
    return coerced
