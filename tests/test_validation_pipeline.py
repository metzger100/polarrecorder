from __future__ import annotations

from typing import cast

from validation_helpers import make_read_result, make_warmed_state

from polarrecorder.config import default_config
from polarrecorder.sample import ReadResult
from polarrecorder.validation.pipeline import run
from polarrecorder.validation.state import ValidationState


def test_runner_returns_none_sample_for_r1_and_r2_rejections() -> None:
    state = make_warmed_state()
    config = default_config()

    non_finite, non_finite_sample = run(
        make_read_result(twa_raw=float("nan")),
        state,
        config,
    )
    missing, missing_sample = run(make_read_result(twa_raw=None), state, config)

    assert non_finite.reason_codes == ["reject_non_finite_twa"]
    assert non_finite.decision == "rejected"
    assert not non_finite.is_sailing_candidate
    assert non_finite_sample is None
    assert missing.reason_codes == ["reject_missing_twa"]
    assert not missing.is_sailing_candidate
    assert missing_sample is None


def test_runner_aggregates_mixed_r1_and_r2_codes_in_plan_order() -> None:
    result, sample = run(
        ReadResult(
            timestamp_monotonic=100.0,
            timestamp_wall=1000.0,
            twa_raw=None,
            tws_raw=float("nan"),
            stw_raw=cast("float", "bad"),
            twa_timestamp=None,
            tws_timestamp=99.5,
            stw_timestamp=99.5,
        ),
        make_warmed_state(),
        default_config(),
    )

    assert result.decision == "rejected"
    assert sample is None
    assert not result.is_sailing_candidate
    assert result.reason_codes == [
        "reject_non_finite_tws",
        "reject_non_finite_stw",
        "reject_missing_twa",
    ]


def test_runner_rejects_r3_to_r10_as_non_candidates_with_sample() -> None:
    result, sample = run(
        make_read_result(ages=(4.0, 0.5, 0.5)),
        make_warmed_state(),
        default_config(),
    )

    assert result.decision == "rejected"
    assert result.reason_codes == ["reject_stale_twa"]
    assert not result.is_sailing_candidate
    assert sample is not None


def test_runner_rejects_r11_to_r13_as_candidates() -> None:
    cases = [
        (make_warmed_state(), make_read_result(twa_raw=200.0), "reject_twa_roc"),
        (make_warmed_state(), make_read_result(tws_kt=60.0, now=99.0), "reject_tws_roc"),
        (make_warmed_state(), make_read_result(stw_kt=20.0), "reject_stw_roc"),
    ]
    for state, read_result, code in cases:
        result, sample = run(read_result, state, default_config())

        assert result.decision == "rejected"
        assert result.reason_codes == [code]
        assert result.is_sailing_candidate
        assert sample is not None


def test_runner_rejects_cooldown_as_candidate() -> None:
    state = make_warmed_state()
    state.cooldown_expires = 110.0

    result, sample = run(make_read_result(), state, default_config())

    assert result.reason_codes == ["reject_maneuver_cooldown"]
    assert result.is_sailing_candidate
    assert sample is not None


def test_runner_maps_warming_up_to_non_candidate() -> None:
    state = ValidationState()

    result, sample = run(make_read_result(), state, default_config())

    assert result.decision == "rejected"
    assert result.reason_codes == ["reject_warming_up"]
    assert not result.is_sailing_candidate
    assert sample is not None


def test_runner_maps_unstable_and_quarantine_to_candidates() -> None:
    unstable_state = make_warmed_state(twa_values=(90.0, 120.0, 90.0))
    unstable, unstable_sample = run(make_read_result(), unstable_state, default_config())
    quarantine, quarantine_sample = run(
        make_read_result(tws_kt=4.0, stw_kt=4.0),
        make_warmed_state(),
        default_config(),
    )

    assert unstable.reason_codes == ["reject_unstable"]
    assert unstable.is_sailing_candidate
    assert unstable_sample is not None
    assert quarantine.decision == "quarantined"
    assert quarantine.reason_codes == ["quarantine_engine_suspected"]
    assert quarantine.is_sailing_candidate
    assert quarantine_sample is not None


def test_runner_accepts_stable_candidate_and_does_not_observe() -> None:
    state = make_warmed_state()
    prior_length = len(state.window)
    previous_before = state.previous_sample

    result, sample = run(make_read_result(), state, default_config())

    assert result.decision == "accepted"
    assert result.reason_codes == []
    assert result.is_sailing_candidate
    assert sample is not None
    assert len(state.window) == prior_length
    assert state.previous_sample == previous_before


def test_threats_detectable_with_core_values_emit_expected_codes() -> None:
    cases = [
        (make_read_result(stw_kt=0.2), "reject_anchored"),
        (make_read_result(tws_kt=4.0, stw_kt=4.0), "quarantine_engine_suspected"),
        (make_read_result(twa_raw=200.0), "reject_twa_roc"),
        (make_read_result(stw_kt=20.0), "reject_stw_roc"),
        (make_read_result(ages=(4.0, 0.5, 0.5)), "reject_stale_twa"),
        (make_read_result(ages=(0.5, 4.0, 0.5)), "reject_stale_tws"),
        (make_read_result(ages=(0.5, 0.5, 4.0)), "reject_stale_stw"),
        (make_read_result(ages=(0.5, 0.5, 3.0)), "reject_age_skew"),
        (make_read_result(twa_raw=None), "reject_missing_twa"),
        (make_read_result(tws_kt=None), "reject_missing_tws"),
        (make_read_result(stw_kt=None), "reject_missing_stw"),
        (make_read_result(tws_kt=80.0), "reject_tws_range"),
        (make_read_result(stw_kt=45.0), "reject_stw_range"),
        (make_read_result(tws_kt=2.0), "reject_low_wind"),
        (make_read_result(twa_raw=5.0), "reject_head_to_wind"),
    ]
    for read_result, code in cases:
        state = make_warmed_state()
        result, sample = run(read_result, state, default_config())

        assert code in result.reason_codes
        if code.startswith("quarantine"):
            assert result.decision == "quarantined"
        else:
            assert result.decision == "rejected"
        if sample is None:
            assert not result.is_sailing_candidate


def test_threats_not_detectable_in_mvp_pass_by_design() -> None:
    for threat_id in ("T3", "T5", "T6", "T7", "T8", "T9", "T10", "T22", "T26"):
        result, sample = run(make_read_result(), make_warmed_state(), default_config())

        assert threat_id
        assert result.decision == "accepted"
        assert result.reason_codes == []
        assert result.is_sailing_candidate
        assert sample is not None


def test_unstable_threats_emit_expected_code() -> None:
    for state, read_result in (
        (make_warmed_state(twa_values=(90.0, 120.0, 90.0)), make_read_result()),
        (
            make_warmed_state(twa_values=(170.0, 190.0, 170.0)),
            make_read_result(twa_raw=170.0),
        ),
    ):
        result, sample = run(read_result, state, default_config())

        assert result.decision == "rejected"
        assert result.reason_codes == ["reject_unstable"]
        assert result.is_sailing_candidate
        assert sample is not None
