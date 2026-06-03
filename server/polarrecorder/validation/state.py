"""Module: Validation State - Rolling validation state for pure rules.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.sample
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from polarrecorder.sample import Sample

MAX_WINDOW_ENTRIES = 300


@dataclass(frozen=True)
class WindowEntry:
    """Compact sample fields retained by validation state."""

    timestamp_monotonic: float
    twa_deg_raw: float
    tws_kt: float
    stw_kt: float


def _new_window() -> deque[WindowEntry]:
    return deque(maxlen=MAX_WINDOW_ENTRIES)


@dataclass
class ValidationState:
    """Mutable rolling state used by stateful validation rules."""

    stability_window_seconds: float = 15.0
    window: deque[WindowEntry] = field(default_factory=_new_window)
    cooldown_expires: float = 0.0
    previous_sample: WindowEntry | None = None

    def observe(self, sample: Sample) -> None:
        """Prune old entries, append the sample, and update the previous sample.

        Args:
            sample: Built sample to add after the pipeline has returned.
        """
        self.prune(sample.timestamp_monotonic)
        entry = entry_from_sample(sample)
        self.window.append(entry)
        self.previous_sample = entry

    def is_warming_up(self, now_monotonic: float) -> bool:
        """Return whether the rolling buffer has not filled a full window.

        Args:
            now_monotonic: Current monotonic timestamp to evaluate against.

        Returns:
            ``True`` when R15 would use its ``reject_warming_up`` branch.
        """
        self.prune(now_monotonic)
        return not self.is_filled(now_monotonic)

    def prune(self, now_monotonic: float) -> None:
        """Trim old entries while retaining one boundary anchor when available.

        Args:
            now_monotonic: Current monotonic timestamp.
        """
        oldest_allowed = now_monotonic - self.stability_window_seconds
        if self.window and self.window[-1].timestamp_monotonic < oldest_allowed:
            self.window.clear()
            return
        while len(self.window) > 1 and self.window[1].timestamp_monotonic <= oldest_allowed:
            self.window.popleft()

    def is_filled(self, now_monotonic: float) -> bool:
        """Return whether the retained buffer spans a full stability window.

        Args:
            now_monotonic: Current monotonic timestamp.

        Returns:
            ``True`` when the buffer is non-empty and spans the configured window.
        """
        if not self.window:
            return False
        return now_monotonic - self.window[0].timestamp_monotonic >= self.stability_window_seconds


def entry_from_sample(sample: Sample) -> WindowEntry:
    """Extract the state-retained fields from a sample.

    Args:
        sample: Built sample.

    Returns:
        Compact window entry using raw TWA degrees and knots.
    """
    return WindowEntry(
        timestamp_monotonic=sample.timestamp_monotonic,
        twa_deg_raw=sample.twa_deg_raw,
        tws_kt=sample.tws_kt,
        stw_kt=sample.stw_kt,
    )
