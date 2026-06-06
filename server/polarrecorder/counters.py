"""Module: Counters - Aggregated rejection counter storage.

Documentation: documentation/architecture/persistence.md
Depends: polarrecorder.coerce
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TypedDict, cast

from polarrecorder.coerce import to_int


class CountersDict(TypedDict):
    """Serialized global counter shape."""

    total_seen: int
    total_accepted: int
    total_rejected: int
    total_quarantined: int
    rejection_histogram: dict[str, int]


@dataclass
class Counters:
    """Global counters for accepted, rejected, and quarantined samples."""

    total_seen: int = 0
    total_accepted: int = 0
    total_rejected: int = 0
    total_quarantined: int = 0
    rejection_histogram: dict[str, int] = field(default_factory=dict)

    def record_accepted(self) -> None:
        """Record one accepted sailing candidate."""
        self.total_seen += 1
        self.total_accepted += 1

    def record_rejected(self, reason_codes: list[str]) -> None:
        """Record one rejected sailing candidate and its reason codes."""
        self.total_seen += 1
        self.total_rejected += 1
        self.record_reasons(reason_codes)

    def record_quarantined(self, reason_code: str) -> None:
        """Record one quarantined sailing candidate and its reason code."""
        self.total_seen += 1
        self.total_quarantined += 1
        self.record_reasons([reason_code])

    def record_non_candidate(self, reason_codes: list[str]) -> None:
        """Record non-candidate diagnostics without changing sailing totals."""
        self.record_reasons(reason_codes)

    def record_reasons(self, reason_codes: list[str]) -> None:
        """Add reason codes to the diagnostic histogram."""
        for reason_code in reason_codes:
            self.rejection_histogram[reason_code] = self.rejection_histogram.get(reason_code, 0) + 1

    def reset(self) -> None:
        """Clear all counters and rejection diagnostics."""
        self.total_seen = 0
        self.total_accepted = 0
        self.total_rejected = 0
        self.total_quarantined = 0
        self.rejection_histogram.clear()

    def to_dict(self) -> CountersDict:
        """Serialize counters to the persistence schema block."""
        return {
            "total_seen": self.total_seen,
            "total_accepted": self.total_accepted,
            "total_rejected": self.total_rejected,
            "total_quarantined": self.total_quarantined,
            "rejection_histogram": dict(self.rejection_histogram),
        }

    @classmethod
    def from_dict(cls, data: object) -> Counters:
        """Deserialize counters from the persistence schema block."""
        if not isinstance(data, dict):
            return cls()
        histogram = data.get("rejection_histogram", {})
        if not isinstance(histogram, dict):
            histogram = {}
        return cls(
            total_seen=_int_field(data, "total_seen"),
            total_accepted=_int_field(data, "total_accepted"),
            total_rejected=_int_field(data, "total_rejected"),
            total_quarantined=_int_field(data, "total_quarantined"),
            rejection_histogram={
                str(key): to_int(value)
                for key, value in cast("dict[object, object]", histogram).items()
            },
        )


def _int_field(data: dict[object, object], key: str) -> int:
    return to_int(data.get(key, 0))
