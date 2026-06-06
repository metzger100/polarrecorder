"""Module: Reader - AvNav store value reader.

Documentation: documentation/avnav/keys-and-units.md
Depends: polarrecorder.logger, polarrecorder.sample
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Protocol

from polarrecorder.sample import ClockFn, ReadResult, WallClockFn

if TYPE_CHECKING:
    from polarrecorder.logger import Logger

TWA_KEY = "gps.trueWindAngle"
TWS_KEY = "gps.trueWindSpeed"
STW_KEY = "gps.waterSpeed"


class DataEntryLike(Protocol):
    """Store entry shape returned by AvNav with includeInfo enabled."""

    value: float
    timestamp: float


class StoreAPI(Protocol):
    """Duck-typed subset of the AvNav store API used by the reader."""

    def getSingleValue(  # noqa: N802  # mirrors AvNav store API method name
        self,
        key: str,
        includeInfo: bool = False,  # noqa: N803  # mirrors AvNav store API parameter name
    ) -> DataEntryLike | None:
        """Return a store value with optional metadata."""
        ...


class StoreReader:
    """Read the three core AvNav store values into a raw result."""

    def __init__(
        self,
        api: StoreAPI,
        clock: ClockFn = time.monotonic,
        wall_clock: WallClockFn = time.time,
        logger: Logger | None = None,
    ) -> None:
        """Create a store reader.

        Args:
            api: Store API implementation.
            clock: Monotonic clock used for read timestamps.
            wall_clock: Wall clock used for display timestamps.
            logger: Optional diagnostics hook reserved for reader warnings.
        """
        self._api = api
        self._clock = clock
        self._wall_clock = wall_clock
        self._logger = logger

    def read(self) -> ReadResult:
        """Read TWA, TWS, and STW from the store."""
        twa_entry = self._read_entry(TWA_KEY)
        tws_entry = self._read_entry(TWS_KEY)
        stw_entry = self._read_entry(STW_KEY)
        return ReadResult(
            timestamp_monotonic=self._clock(),
            timestamp_wall=self._wall_clock(),
            twa_raw=_entry_value(twa_entry),
            tws_raw=_entry_value(tws_entry),
            stw_raw=_entry_value(stw_entry),
            twa_timestamp=_entry_timestamp(twa_entry),
            tws_timestamp=_entry_timestamp(tws_entry),
            stw_timestamp=_entry_timestamp(stw_entry),
        )

    def _read_entry(self, key: str) -> DataEntryLike | None:
        return self._api.getSingleValue(key, includeInfo=True)


def read_store(
    api: StoreAPI,
    clock: ClockFn = time.monotonic,
    wall_clock: WallClockFn = time.time,
    logger: Logger | None = None,
) -> ReadResult:
    """Read the core store values without explicitly constructing a reader.

    Args:
        api: Store API implementation.
        clock: Monotonic clock used for read timestamps.
        wall_clock: Wall clock used for display timestamps.
        logger: Optional diagnostics hook reserved for reader warnings.

    Returns:
        Raw read result with missing/expired values represented as ``None``.
    """
    return StoreReader(api, clock, wall_clock, logger).read()


def _entry_value(entry: DataEntryLike | None) -> float | None:
    if entry is None:
        return None
    return entry.value


def _entry_timestamp(entry: DataEntryLike | None) -> float | None:
    if entry is None:
        return None
    return entry.timestamp
