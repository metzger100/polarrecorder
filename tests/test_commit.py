from __future__ import annotations

from validation_helpers import make_sample

from polarrecorder.commit import commit_sample
from polarrecorder.polar_model import PolarModel
from polarrecorder.validation.pipeline import PipelineResult


def test_accepted_sample_updates_histogram_and_generation() -> None:
    model = PolarModel()
    sample = make_sample(stw_kt=6.2)
    result = PipelineResult(decision="accepted", reason_codes=[], is_sailing_candidate=True)

    commit_sample(result, sample, model)

    model_bin = model.bins[(90, 12)]
    assert model_bin.histogram == {62: 1}
    assert model_bin.total_accepted == 1
    assert model.generation == 1


def test_quality_gate_rejection_records_per_bin_rejection() -> None:
    model = PolarModel()
    sample = make_sample()
    result = PipelineResult(
        decision="rejected",
        reason_codes=["reject_unstable", "reject_stw_roc"],
        is_sailing_candidate=True,
    )

    commit_sample(result, sample, model)

    model_bin = model.bins[(90, 12)]
    assert model_bin.total_rejected == 1
    assert model_bin.rejection_histogram == {"reject_unstable": 1, "reject_stw_roc": 1}
    assert model_bin.histogram == {}
    assert model.generation == 0


def test_quarantine_records_single_per_bin_reason() -> None:
    model = PolarModel()
    sample = make_sample()
    result = PipelineResult(
        decision="quarantined",
        reason_codes=["quarantine_engine_suspected"],
        is_sailing_candidate=True,
    )

    commit_sample(result, sample, model)

    model_bin = model.bins[(90, 12)]
    assert model_bin.total_quarantined == 1
    assert model_bin.rejection_histogram == {"quarantine_engine_suspected": 1}
    assert model_bin.histogram == {}
    assert model.generation == 0


def test_quarantine_requires_one_reason_code() -> None:
    model = PolarModel()
    sample = make_sample()
    result = PipelineResult(
        decision="quarantined",
        reason_codes=[],
        is_sailing_candidate=True,
    )

    error_message = ""
    try:
        commit_sample(result, sample, model)
    except ValueError as error:
        error_message = str(error)

    assert "exactly one reason code" in error_message
    assert model.bins == {}


def test_none_sample_touches_no_bin() -> None:
    model = PolarModel()
    result = PipelineResult(
        decision="rejected",
        reason_codes=["reject_missing_twa"],
        is_sailing_candidate=False,
    )

    commit_sample(result, None, model)

    assert model.bins == {}
    assert model.generation == 0


def test_r1_to_r10_non_candidate_rejection_touches_no_bin() -> None:
    model = PolarModel()
    sample = make_sample(ages=(4.0, 0.5, 0.5))
    result = PipelineResult(
        decision="rejected",
        reason_codes=["reject_stale_twa"],
        is_sailing_candidate=False,
    )

    commit_sample(result, sample, model)

    assert model.bins == {}
    assert model.generation == 0


def test_warming_up_rejection_touches_no_bin() -> None:
    model = PolarModel()
    sample = make_sample()
    result = PipelineResult(
        decision="rejected",
        reason_codes=["reject_warming_up"],
        is_sailing_candidate=False,
    )

    commit_sample(result, sample, model)

    assert model.bins == {}
    assert model.generation == 0
