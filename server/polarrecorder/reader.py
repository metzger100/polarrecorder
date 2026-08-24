"""Module: Reader - AvNav store value reader.

Documentation: documentation/avnav/keys-and-units.md
Depends: polarrecorder.config, polarrecorder.enhanced_input, polarrecorder.logger,
polarrecorder.sample, polarrecorder.source_params
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Protocol

from polarrecorder.enhanced_input import EnhancedInput, assess_enhanced_input, coerce_finite_float
from polarrecorder.sample import ENHANCED_SIGNAL_SPECS, ClockFn, ReadResult, WallClockFn
from polarrecorder.source_params import STW_KEY_DEFAULT, TWA_KEY_DEFAULT, TWS_KEY_DEFAULT

if TYPE_CHECKING:
    from polarrecorder.config import Config
    from polarrecorder.logger import Logger

TWA_KEY = TWA_KEY_DEFAULT
TWS_KEY = TWS_KEY_DEFAULT
STW_KEY = STW_KEY_DEFAULT


class DataEntryLike(Protocol):
    """Store entry shape returned by AvNav with includeInfo enabled."""

    @property
    def value(self) -> object:
        """Return the raw store value."""
        ...

    @property
    def timestamp(self) -> object:
        """Return the monotonic store timestamp."""
        ...


class StoreAPI(Protocol):
    """Duck-typed subset of the AvNav store API used by the reader."""

    def get_single_value(
        self,
        key: str,
        include_info: bool = False,
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
        config = self._config
        twa_key = TWA_KEY if config is None else config.twa_key
        tws_key = TWS_KEY if config is None else config.tws_key
        stw_key = STW_KEY if config is None else config.stw_key
        twa_entry = self._read_entry(twa_key)
        tws_entry = self._read_entry(tws_key)
        stw_entry = self._read_entry(stw_key)
        enhanced_raw, enhanced_inputs = self._read_enhanced(now_monotonic)
        return ReadResult(
            timestamp_monotonic=now_monotonic,
            timestamp_wall=self._wall_clock(),
            twa_raw=_entry_value(twa_entry),
            tws_raw=_entry_value(tws_entry),
            stw_raw=_entry_value(stw_entry),
            twa_timestamp=_entry_timestamp(twa_entry),
            tws_timestamp=_entry_timestamp(tws_entry),
            stw_timestamp=_entry_timestamp(stw_entry),
            enhanced_raw=enhanced_raw,
            enhanced_inputs=enhanced_inputs,
        )

    def _read_entry(self, key: str) -> DataEntryLike | None:
        return self._api.get_single_value(key, include_info=True)

    def _read_enhanced(
        self, now_monotonic: float
    ) -> tuple[dict[str, tuple[float, float]] | None, dict[str, EnhancedInput] | None]:
        config = self._config
        if config is None:
            return None, None
        enhanced_raw: dict[str, tuple[float, float]] = {}
        enhanced_inputs: dict[str, EnhancedInput] = {}
        for spec in ENHANCED_SIGNAL_SPECS:
            if spec.enable_fields and not any(
                getattr(config, field) for field in spec.enable_fields
            ):
                continue
            key = getattr(config, spec.key_field)
            if not key:
                continue
            acquisition = assess_enhanced_input(
                self._read_entry(key),
                now_monotonic,
                config.stale_threshold,
                accepts_bool=spec.accepts_bool,
            )
            enhanced_inputs[spec.role] = acquisition
            if acquisition.state == "invalid":
                self._log_invalid(spec.role, key, acquisition)
            if acquisition.state == "usable":
                assert acquisition.numeric_value is not None
                assert acquisition.timestamp is not None
                enhanced_raw[spec.role] = (
                    acquisition.numeric_value,
                    acquisition.timestamp,
                )
        return enhanced_raw or None, enhanced_inputs or None

    def _log_invalid(self, role: str, key: str, acquisition: EnhancedInput) -> None:
        if self._logger is not None:
            message = (
                f"enhanced signal {role} key {key!r} has invalid "
                f"{acquisition.invalid_cause}; omitting"
            )
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


def _coerce_float(value: object, *, accepts_bool: bool = False) -> float | None:
    """Coerce a raw store value to a finite float, or ``None`` if not numeric.

    Args:
        value: Raw store value (bool, int, float, or string).
        accepts_bool: Whether boolean input maps to zero or one.

    Returns:
        The coerced finite float, or ``None`` for non-numeric or non-finite input.
    """
    return coerce_finite_float(value, accepts_bool=accepts_bool)


def _entry_value(entry: DataEntryLike | None) -> object | None:
    if entry is None:
        return None
    return entry.value


def _entry_timestamp(entry: DataEntryLike | None) -> object | None:
    if entry is None:
        return None
    return entry.timestamp
