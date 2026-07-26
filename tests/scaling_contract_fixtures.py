"""Shared raw-bin fixture builder for the projection/formatter scaling contracts.

Used by `tests/test_projection_scaling_contract.py` and
`tests/test_api_handlers_scaling_contract.py` so both count raw-bin reads against the
exact same deterministic, collision-free bin layout.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from counting_dict import CountingDict
from polarrecorder import export

if TYPE_CHECKING:
    from collections.abc import Mapping

# A fixed, production-equivalent starboard grid (matches the DefaultStarboard180
# preset). Kept constant wherever only the raw-bin count should vary.
FIXED_TWA_GRID = list(export.DEFAULT_TWA_STARBOARD180)
FIXED_TWS_GRID = list(export.WINDY_TWS)


def build_model_bins(
    count: int, counter: list[int] | None
) -> dict[tuple[int, int], Mapping[str, object]]:
    """Build `count` distinct, collision-free raw bins over the 360x61 TWA/TWS space.

    Args:
        count: Number of distinct raw bins to create.
        counter: Shared counter to wrap each bin's data mapping with, or `None` for a
            plain, uninstrumented mapping (a correctness-comparison baseline).

    Returns:
        A `SnapshotBins`-shaped mapping with `count` entries.
    """
    model_bins: dict[tuple[int, int], Mapping[str, object]] = {}
    for index in range(count):
        twa = index % 360
        tws = index // 360
        histogram = {50 + (index % 10): 1}
        if counter is None:
            model_bins[(twa, tws)] = {"histogram": histogram}
        else:
            value = CountingDict(counter)
            value["histogram"] = histogram
            model_bins[(twa, tws)] = value
    return model_bins
