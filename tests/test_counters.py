from __future__ import annotations

from polarrecorder.counters import Counters


def test_candidate_increments_preserve_counter_invariant() -> None:
    counters = Counters()

    counters.record_accepted()
    counters.record_rejected(["reject_unstable", "reject_stw_roc"])
    counters.record_quarantined("quarantine_engine_suspected")

    assert counters.total_seen == 3
    assert counters.total_accepted == 1
    assert counters.total_rejected == 1
    assert counters.total_quarantined == 1
    assert counters.total_seen == (
        counters.total_accepted + counters.total_rejected + counters.total_quarantined
    )
    assert counters.rejection_histogram == {
        "reject_unstable": 1,
        "reject_stw_roc": 1,
        "quarantine_engine_suspected": 1,
    }


def test_non_candidate_reasons_do_not_change_sailing_totals() -> None:
    counters = Counters()

    counters.record_non_candidate(["reject_low_wind", "reject_low_wind"])

    assert counters.total_seen == 0
    assert counters.total_rejected == 0
    assert counters.rejection_histogram == {"reject_low_wind": 2}


def test_reset_clears_all_counter_state() -> None:
    counters = Counters(total_seen=1, total_accepted=1, rejection_histogram={"reject": 2})

    counters.reset()

    assert counters.to_dict() == {
        "total_seen": 0,
        "total_accepted": 0,
        "total_rejected": 0,
        "total_quarantined": 0,
        "rejection_histogram": {},
    }


def test_counter_dict_round_trip_copies_histogram() -> None:
    counters = Counters()
    counters.record_rejected(["reject_unstable"])

    restored = Counters.from_dict(counters.to_dict())
    counters.rejection_histogram["reject_unstable"] = 99

    assert restored.to_dict() == {
        "total_seen": 1,
        "total_accepted": 0,
        "total_rejected": 1,
        "total_quarantined": 0,
        "rejection_histogram": {"reject_unstable": 1},
    }
