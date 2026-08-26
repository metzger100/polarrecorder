"""Module: Routing POL - Tack-folded routing polar selection and serialization.

Documentation: documentation/user/export-import.md
Depends: polarrecorder.projection
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from polarrecorder.projection import (
    ORIGIN_TWA,
    ProjectedCell,
    SnapshotBins,
    project_folded_grid,
)

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

ROUTING_TWA = [30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]
ROUTING_TWS = [4, 6, 8, 10, 12, 14, 16, 20, 25]
FIRST_CELL = "TWA/TWS"

# Projection carries a head-to-wind point the file never serializes. Without it the
# first exported angle's midpoint interval would reach down to 0 deg, so samples
# nearer the bow than any sailing angle would set the 30 deg boat speed.
PROJECTION_TWA = [ORIGIN_TWA, *ROUTING_TWA]


class RoutingPolError(ValueError):
    """Raised when a routing POL cannot be serialized safely."""


def pol_from_projection(
    projected: Mapping[tuple[int, int], ProjectedCell],
    twa_grid: Sequence[int],
    tws_grid: Sequence[int],
) -> str:
    """Format a complete projection as tab-separated routing POL text."""
    total = len(twa_grid) * len(tws_grid)
    missing = total - sum((twa, tws) in projected for twa in twa_grid for tws in tws_grid)
    if missing:
        msg = (
            f"NavimetriX export is incomplete: {missing} of {total} polar cells "
            "lack sufficient data."
        )
        raise RoutingPolError(msg)
    rows = [FIRST_CELL + "\t" + "\t".join(str(tws) for tws in tws_grid)]
    for twa in twa_grid:
        values = [str(twa)]
        values.extend(f"{projected[(twa, tws)].stw:.1f}" for tws in tws_grid)
        rows.append("\t".join(values))
    return "\r\n".join(rows) + "\r\n"


def routing_tws_grid(max_tws: int) -> list[int]:
    """Return the routing TWS columns the active wind ceiling can populate.

    Recording rejects true wind above ``max_tws``, so a fixed column above that
    ceiling could never fill and would fail every export. ``max_tws`` is clamped
    to 20-60 knots, so the 4-20 knot columns always survive.

    Args:
        max_tws: Active maximum plausible true wind speed in knots.

    Returns:
        The routing TWS columns at or below ``max_tws``.
    """
    return [tws for tws in ROUTING_TWS if tws <= max_tws]


def routing_pol_export(
    model_bins: SnapshotBins,
    percentile: int,
    min_samples: int,
    max_tws: int,
) -> str:
    """Project the fixed routing grid and return a complete POL file."""
    tws_grid = routing_tws_grid(max_tws)
    projected = project_folded_grid(
        model_bins,
        PROJECTION_TWA,
        tws_grid,
        percentile,
        min_samples,
    )
    return pol_from_projection(projected, ROUTING_TWA, tws_grid)
