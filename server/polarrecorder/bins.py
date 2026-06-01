"""Module: Bins - Sparse polar bin addressing and data structure.

Documentation: documentation/architecture/polar-model.md
Depends: none
"""

from __future__ import annotations

from dataclasses import dataclass, field

TWA_BIN_SIZE = 1
TWS_BIN_SIZE = 1
TWS_BIN_MAX = 60


@dataclass
class Bin:
    """One sparse TWA/TWS polar bin."""

    twa_deg: int
    tws_kt: int
    histogram: dict[int, int] = field(default_factory=dict)
    total_accepted: int = 0
    total_rejected: int = 0
    total_quarantined: int = 0
    last_update_wall: float = 0.0
    rejection_histogram: dict[str, int] = field(default_factory=dict)


def twa_bin(twa_deg_raw: float) -> int:
    """Compute the 0-359 degree TWA bin for a raw TWA value."""
    return round(twa_deg_raw / TWA_BIN_SIZE) % 360


def tws_bin(tws_kt: float) -> int:
    """Compute the clamped 0-60 knot TWS bin for a TWS value."""
    rounded = round(tws_kt / TWS_BIN_SIZE)
    return min(max(rounded, 0), TWS_BIN_MAX)


def bin_address(twa_deg_raw: float, tws_kt: float) -> tuple[int, int]:
    """Compute the sparse model bin address for raw TWA and TWS."""
    return twa_bin(twa_deg_raw), tws_bin(tws_kt)
