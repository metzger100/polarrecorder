"""Module: Validation State - Rolling validation state for pure rules.

Documentation: documentation/architecture/data-pipeline.md
Depends: polarrecorder.sample
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from polarrecorder.sample import enhanced_value

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
    heading_deg: float | None = None
    cog_deg: float | None = None


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
        """Observe a sample for both transition and stability rules.

        Args:
            sample: Built sample to add after the pipeline has returned.
        """
        self.observe_transition(sample)
        self.observe_stability(sample)

    def observe_iteration(self, sample: Sample | None, *, eligible: bool) -> None:
        """Apply post-pipeline transition and R15-history observation policy."""
        if sample is not None:
            self.observe_transition(sample)
        if sample is not None and eligible:
            self.observe_stability(sample)
        else:
            self.reset_stability()

    def observe_transition(self, sample: Sample) -> None:
        """Retain a valid numeric observation for transition-rate rules."""
        self.previous_sample = entry_from_sample(sample)

    def observe_stability(self, sample: Sample) -> None:
        """Append a sailing-eligible observation to the R15 window."""
        self.prune(sample.timestamp_monotonic)
        self.window.append(entry_from_sample(sample))

    def reset_stability(self) -> None:
        """Discard R15 history after a break in sailing eligibility."""
        self.window.clear()

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
        heading_deg=enhanced_value(sample, "heading_deg"),
        cog_deg=enhanced_value(sample, "cog_deg"),
    )
