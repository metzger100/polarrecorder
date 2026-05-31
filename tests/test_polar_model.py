from __future__ import annotations

from polarrecorder.polar_model import PolarModel
from polarrecorder.sample import Freshness, Sample


def make_sample(
    twa_deg_raw: float = 90.0,
    tws_kt: float = 12.0,
    stw_kt: float = 5.8,
    timestamp_wall: float = 1000.0,
) -> Sample:
    return Sample(
        timestamp_monotonic=100.0,
        timestamp_wall=timestamp_wall,
        twa_deg_raw=twa_deg_raw,
        twa_deg_abs=min(twa_deg_raw, 360.0 - twa_deg_raw),
        twa_deg_signed=twa_deg_raw if twa_deg_raw <= 180.0 else twa_deg_raw - 360.0,
        tws_ms=0.0,
        tws_kt=tws_kt,
        stw_ms=0.0,
        stw_kt=stw_kt,
        freshness=Freshness(
            twa_age_s=0.1,
            tws_age_s=0.2,
            stw_age_s=0.3,
            max_age_s=0.3,
            age_skew_s=0.2,
        ),
        enhanced=None,
    )


def test_update_accepted_records_histogram_and_bumps_generation() -> None:
    model = PolarModel()

    model.update_accepted(make_sample(stw_kt=5.8, timestamp_wall=1000.0))
    model.update_accepted(make_sample(stw_kt=6.0, timestamp_wall=1001.0))

    model_bin = model.bins[(90, 12)]
    assert model.generation == 2
    assert model_bin.histogram == {58: 1, 60: 1}
    assert model_bin.total_accepted == 2
    assert model_bin.last_update_wall == 1001.0


def test_rejection_and_quarantine_do_not_bump_generation() -> None:
    model = PolarModel()

    model.record_rejection(make_sample(), ["reject_unstable", "reject_stw_roc"])
    model.record_quarantine(make_sample(), "quarantine_engine_suspected")

    model_bin = model.bins[(90, 12)]
    assert model.generation == 0
    assert model_bin.total_rejected == 1
    assert model_bin.total_quarantined == 1
    assert model_bin.rejection_histogram == {
        "reject_unstable": 1,
        "reject_stw_roc": 1,
        "quarantine_engine_suspected": 1,
    }


def test_query_returns_per_bin_percentile_for_accepted_samples_only() -> None:
    model = PolarModel()
    model.update_accepted(make_sample(stw_kt=5.8))
    model.update_accepted(make_sample(stw_kt=6.0))
    model.record_rejection(make_sample(twa_deg_raw=120.0), ["reject_unstable"])

    assert model.query(50) == {(90, 12): 5.8}


def test_iter_bins_returns_live_sparse_bins() -> None:
    model = PolarModel()
    model.update_accepted(make_sample())

    bins = list(model.iter_bins())

    assert bins[0][0] == (90, 12)
    assert bins[0][1] is model.bins[(90, 12)]


def test_reset_clears_bins_and_bumps_generation() -> None:
    model = PolarModel()
    model.update_accepted(make_sample())

    model.reset()

    assert model.bins == {}
    assert model.generation == 2


def test_snapshot_bins_is_fully_detached_from_live_model() -> None:
    model = PolarModel()
    model.update_accepted(make_sample(stw_kt=5.8))

    snapshot = model.snapshot_bins()
    model.update_accepted(make_sample(stw_kt=6.0))
    model.record_rejection(make_sample(), ["reject_unstable"])

    assert snapshot[(90, 12)]["histogram"] == {58: 1}
    assert snapshot[(90, 12)]["total_accepted"] == 1
    assert snapshot[(90, 12)]["total_rejected"] == 0
    assert snapshot[(90, 12)]["rejection_histogram"] == {}
    assert snapshot[(90, 12)]["histogram"] is not model.bins[(90, 12)].histogram
    assert snapshot[(90, 12)]["rejection_histogram"] is not model.bins[(90, 12)].rejection_histogram
