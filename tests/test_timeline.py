from __future__ import annotations

from conftest import FakeClock
from polarrecorder.timeline import Timeline


def test_multiple_decisions_in_one_minute_roll_into_one_bucket() -> None:
    clock = FakeClock(1000.0)
    timeline = Timeline(clock)

    timeline.record("rejected", ["reject_low_wind"])
    timeline.record("rejected", ["reject_low_wind", "reject_stale_twa"])
    timeline.record("accepted", [])

    assert timeline.query(240) == [
        {
            "t": 960.0,
            "accepted": 1,
            "rejected": 2,
            "quarantined": 0,
            "reasons": {"reject_low_wind": 2, "reject_stale_twa": 1},
        }
    ]


def test_minute_boundary_rollover_creates_distinct_buckets() -> None:
    clock = FakeClock(1019.0)
    timeline = Timeline(clock)

    timeline.record("accepted", [])
    clock.advance(1.0)
    timeline.record("quarantined", ["quarantine_engine_suspected"])

    assert timeline.query(240) == [
        {"t": 960.0, "accepted": 1, "rejected": 0, "quarantined": 0, "reasons": {}},
        {
            "t": 1020.0,
            "accepted": 0,
            "rejected": 0,
            "quarantined": 1,
            "reasons": {"quarantine_engine_suspected": 1},
        },
    ]


def test_query_filters_window_oldest_first_and_returns_detached_buckets() -> None:
    clock = FakeClock(0.0)
    timeline = Timeline(clock)
    for index in range(5):
        clock.time = float(index * 60)
        timeline.record("rejected", [f"reason_{index}"])

    result = timeline.query(3)
    result[0]["reasons"]["mutated"] = 1

    assert [bucket["t"] for bucket in result] == [120.0, 180.0, 240.0]
    assert "mutated" not in timeline.query(3)[0]["reasons"]


def test_four_hour_eviction_keeps_only_recent_240_buckets() -> None:
    clock = FakeClock(0.0)
    timeline = Timeline(clock)
    for index in range(241):
        clock.time = float(index * 60)
        timeline.record("accepted", [])

    buckets = timeline.query(240)

    assert len(buckets) == 240
    assert buckets[0]["t"] == 60.0
    assert buckets[-1]["t"] == 14400.0
