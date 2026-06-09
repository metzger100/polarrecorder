"""Module: Reader - AvNav store value reader.

Documentation: documentation/avnav/keys-and-units.md
Depends: polarrecorder.config, polarrecorder.logger, polarrecorder.sample
"""

from __future__ import annotations

import math
import time
from typing import TYPE_CHECKING, Protocol

from polarrecorder.sample import ENHANCED_SIGNAL_SPECS, ClockFn, ReadResult, WallClockFn

if TYPE_CHECKING:
    from polarrecorder.config import Config
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
        config: Config | None = None,
    ) -> None:
        """Create a store reader.

        Args:
            api: Store API implementation.
            clock: Monotonic clock used for read timestamps.
            wall_clock: Wall clock used for display timestamps.
            logger: Optional diagnostics hook reserved for reader warnings.
            config: Optional runtime config; enables optional-signal reads.
        """
        self._api = api
        self._clock = clock
        self._wall_clock = wall_clock
        self._logger = logger
        self._config = config

    def read(self) -> ReadResult:
        """Read the core values, plus any configured optional signals."""
        now_monotonic = self._clock()
        twa_entry = self._read_entry(TWA_KEY)
        tws_entry = self._read_entry(TWS_KEY)
        stw_entry = self._read_entry(STW_KEY)
        return ReadResult(
            timestamp_monotonic=now_monotonic,
            timestamp_wall=self._wall_clock(),
            twa_raw=_entry_value(twa_entry),
            tws_raw=_entry_value(tws_entry),
            stw_raw=_entry_value(stw_entry),
            twa_timestamp=_entry_timestamp(twa_entry),
            tws_timestamp=_entry_timestamp(tws_entry),
            stw_timestamp=_entry_timestamp(stw_entry),
            enhanced_raw=self._read_enhanced(now_monotonic),
        )

    def _read_entry(self, key: str) -> DataEntryLike | None:
        return self._api.getSingleValue(key, includeInfo=True)

    def _read_enhanced(self, now_monotonic: float) -> dict[str, tuple[float, float]] | None:
        config = self._config
        if config is None:
            return None
        enhanced_raw: dict[str, tuple[float, float]] = {}
        for spec in ENHANCED_SIGNAL_SPECS:
            if not getattr(config, spec.enable_field):
                continue
            key = getattr(config, spec.key_field)
            if not key:
                continue
            coerced = self._read_enhanced_entry(
                spec.role, key, now_monotonic, config.stale_threshold
            )
            if coerced is not None:
                enhanced_raw[spec.role] = coerced
        return enhanced_raw or None

    def _read_enhanced_entry(
        self,
        role: str,
        key: str,
        now_monotonic: float,
        stale_threshold: float,
    ) -> tuple[float, float] | None:
        entry = self._read_entry(key)
        if entry is None:
            return None
        coerced = _coerce_float(entry.value)
        if coerced is None:
            self._log_uncoercible(role, key, entry.value)
            return None
        timestamp = entry.timestamp
        if now_monotonic - timestamp > stale_threshold:
            return None
        return coerced, timestamp

    def _log_uncoercible(self, role: str, key: str, value: object) -> None:
        if self._logger is not None:
            message = f"enhanced signal {role} key {key!r} value {value!r} is not numeric; omitting"
            self._logger.debug(message)


def read_store(
    api: StoreAPI,
    clock: ClockFn = time.monotonic,
    wall_clock: WallClockFn = time.time,
    logger: Logger | None = None,
    config: Config | None = None,
) -> ReadResult:
    """Read the core store values without explicitly constructing a reader.

    Args:
        api: Store API implementation.
        clock: Monotonic clock used for read timestamps.
        wall_clock: Wall clock used for display timestamps.
        logger: Optional diagnostics hook reserved for reader warnings.
        config: Optional runtime config; enables optional-signal reads.

    Returns:
        Raw read result with missing/expired values represented as ``None``.
    """
    return StoreReader(api, clock, wall_clock, logger, config).read()


def _coerce_float(value: object) -> float | None:
    """Coerce a raw store value to a finite float, or ``None`` if not numeric.

    Args:
        value: Raw store value (bool, int, float, or string).

    Returns:
        The coerced finite float, or ``None`` for non-numeric or non-finite input.
    """
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    coerced: float | None
    if isinstance(value, (int, float)):
        coerced = float(value)
    elif isinstance(value, str):
        coerced = _parse_float_string(value)
    else:
        coerced = None
    if coerced is None or not math.isfinite(coerced):
        return None
    return coerced


def _parse_float_string(value: str) -> float | None:
    try:
        return float(value.strip())
    except ValueError:
        return None


def _entry_value(entry: DataEntryLike | None) -> float | None:
    if entry is None:
        return None
    return entry.value


def _entry_timestamp(entry: DataEntryLike | None) -> float | None:
    if entry is None:
        return None
    return entry.timestamp
