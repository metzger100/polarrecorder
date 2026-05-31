"""Module: Timeline - In-memory rejection timeline buckets.

Documentation: documentation/architecture/api.md
Depends: polarrecorder.sample
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal, TypedDict

if TYPE_CHECKING:
    from polarrecorder.sample import WallClockFn

Decision = Literal["accepted", "rejected", "quarantined"]
BUCKET_SECONDS = 60
MAX_BUCKETS = 240


class TimelineBucketDict(TypedDict):
    """Serialized timeline bucket shape."""

    t: float
    accepted: int
    rejected: int
    quarantined: int
    reasons: dict[str, int]


@dataclass
class _Bucket:
    start_wall: float
    accepted: int = 0
    rejected: int = 0
    quarantined: int = 0
    reasons: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> TimelineBucketDict:
        return {
            "t": self.start_wall,
            "accepted": self.accepted,
            "rejected": self.rejected,
            "quarantined": self.quarantined,
            "reasons": dict(self.reasons),
        }


class Timeline:
    """Four-hour timeline of one-minute decision buckets."""

    def __init__(self, wall_clock: WallClockFn = time.time) -> None:
        """Create an empty timeline.

        Args:
            wall_clock: Wall-clock callable used for minute boundaries.
        """
        self._wall_clock = wall_clock
        self._buckets: dict[float, _Bucket] = {}

    def record(self, decision: Decision, reason_codes: list[str]) -> None:
        """Record one loop iteration in the current minute bucket.

        Args:
            decision: Final decision category for the iteration.
            reason_codes: Rejection or quarantine reasons for this iteration.
        """
        now = self._wall_clock()
        bucket_start = _minute_start(now)
        bucket = self._buckets.setdefault(bucket_start, _Bucket(start_wall=bucket_start))
        if decision == "accepted":
            bucket.accepted += 1
        elif decision == "rejected":
            bucket.rejected += 1
        else:
            bucket.quarantined += 1
        for reason_code in reason_codes:
            bucket.reasons[reason_code] = bucket.reasons.get(reason_code, 0) + 1
        self._evict(bucket_start)

    def query(self, minutes: int) -> list[TimelineBucketDict]:
        """Return recent buckets oldest-first.

        Args:
            minutes: Number of one-minute buckets to include, clamped to 1-240.

        Returns:
            Detached bucket dictionaries ordered from oldest to newest.
        """
        bounded_minutes = min(max(minutes, 1), MAX_BUCKETS)
        newest = _minute_start(self._wall_clock())
        oldest = newest - ((bounded_minutes - 1) * BUCKET_SECONDS)
        self._evict(newest)
        return [
            bucket.to_dict() for start, bucket in sorted(self._buckets.items()) if start >= oldest
        ]

    def _evict(self, newest_bucket_start: float) -> None:
        oldest = newest_bucket_start - ((MAX_BUCKETS - 1) * BUCKET_SECONDS)
        for start in list(self._buckets):
            if start < oldest:
                del self._buckets[start]


def _minute_start(wall_time: float) -> float:
    return float((int(wall_time) // BUCKET_SECONDS) * BUCKET_SECONDS)
