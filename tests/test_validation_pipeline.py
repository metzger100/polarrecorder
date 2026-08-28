from __future__ import annotations

from dataclasses import replace
from typing import cast

from conftest import FakeLogger
from polarrecorder.config import default_config, parse_config_values
from polarrecorder.sample import ReadResult
from polarrecorder.validation.pipeline import run
from polarrecorder.validation.state import ValidationState
from validation_helpers import make_read_result, make_warmed_state


def test_runner_returns_none_sample_for_r1_and_r2_rejections() -> None:
    state = make_warmed_state()
    config = default_config()

    non_finite, non_finite_sample = run(
        make_read_result(twa_raw=float("nan")),
        state,
        config,
    )
    missing, missing_sample = run(make_read_result(twa_raw=None), state, config)

    assert non_finite.reason_codes == ("reject_non_finite_twa",)
    assert non_finite.failed_predicates == ("reject_non_finite_twa",)
    assert non_finite.decision == "rejected"
    assert not non_finite.is_sailing_candidate
    assert non_finite_sample is None
    assert missing.reason_codes == ("reject_missing_twa",)
    assert not missing.is_sailing_candidate
    assert missing_sample is None


def test_runner_rejects_finite_core_speeds_that_overflow_during_normalization() -> None:
    tws_read = make_read_result(tws_kt=None)
    tws_result, tws_sample = run(
        replace(tws_read, tws_raw=1e308, tws_timestamp=99.5),
        ValidationState(),
        default_config(),
    )
    stw_read = make_read_result(stw_kt=None)
    stw_result, stw_sample = run(
        replace(stw_read, stw_raw=1e308, stw_timestamp=99.5),
        ValidationState(),
        default_config(),
    )

    assert tws_result.reason_codes == ("reject_non_finite_tws",)
    assert tws_sample is None
    assert stw_result.reason_codes == ("reject_non_finite_stw",)
    assert stw_sample is None


def test_non_finite_config_text_cannot_disable_r3_r10_r15_or_r20() -> None:
    config = parse_config_values(
        {
            "stale_threshold": "nan",
            "anchored_stw_threshold": "nan",
            "sample_interval": "nan",
            "enh_slip_ratio": "nan",
        }
    )

    stale, _ = run(make_read_result(ages=(100.0, 100.0, 100.0)), make_warmed_state(), config)
    anchored, _ = run(make_read_result(stw_kt=0.2), make_warmed_state(), config)
    warming, _ = run(make_read_result(), ValidationState(), config)
    mismatch, _ = run(
        make_read_result(
            stw_kt=1.0,
            enhanced_values={"sog_kt": (5.0, 99.5), "current_drift_kt": (0.1, 99.5)},
        ),
        make_warmed_state(stw_values=(1.0, 1.0, 1.0)),
        config,
    )

    assert stale.reason_codes == ("reject_stale_twa", "reject_stale_tws", "reject_stale_stw")
    assert anchored.reason_codes == ("reject_anchored",)
    assert warming.reason_codes == ("reject_warming_up",)
    assert mismatch.reason_codes == ("reject_sog_stw_mismatch",)


def test_runner_emits_optional_debug_hook_after_decision() -> None:
    logger = FakeLogger()

    result, sample = run(make_read_result(), make_warmed_state(), default_config(), logger=logger)

    assert result.decision == "accepted"
    assert sample is not None
    assert logger.messages == [("debug", "validation pipeline decision=accepted")]


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
    assert result.reason_codes == (
        "reject_non_finite_tws",
        "reject_non_finite_stw",
        "reject_missing_twa",
    )


def test_runner_rejects_r3_to_r10_as_non_candidates_with_sample() -> None:
    result, sample = run(
        make_read_result(ages=(4.0, 0.5, 0.5)),
        make_warmed_state(),
        default_config(),
    )

    assert result.decision == "rejected"
    assert result.reason_codes == ("reject_stale_twa",)
    assert not result.is_sailing_candidate
    assert sample is not None


def test_runner_retains_same_phase_predicates_in_rule_order() -> None:
    result, sample = run(
        make_read_result(ages=(4.0, 0.5, 0.5)),
        make_warmed_state(),
        default_config(),
    )

    assert result.reason_codes == ("reject_stale_twa",)
    assert result.failed_predicates == ("reject_stale_twa", "reject_age_skew")
    assert result.decision == "rejected"
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
        assert result.reason_codes == (code,)
        assert result.is_sailing_candidate
        assert sample is not None


def test_runner_rejects_cooldown_as_candidate() -> None:
    state = make_warmed_state()
    state.cooldown_expires = 110.0

    result, sample = run(make_read_result(), state, default_config())

    assert result.reason_codes == ("reject_maneuver_cooldown",)
    assert result.is_sailing_candidate
    assert sample is not None


def test_runner_maps_warming_up_to_non_candidate() -> None:
    state = ValidationState()

    result, sample = run(make_read_result(), state, default_config())

    assert result.decision == "rejected"
    assert result.reason_codes == ("reject_warming_up",)
    assert not result.is_sailing_candidate
    assert result.retain_stability_history
    assert sample is not None


def test_runner_maps_unstable_and_quarantine_to_candidates() -> None:
    unstable_state = make_warmed_state(twa_values=(90.0, 120.0, 90.0))
    unstable, unstable_sample = run(make_read_result(), unstable_state, default_config())
    quarantine, quarantine_sample = run(
        make_read_result(tws_kt=4.0, stw_kt=4.0),
        make_warmed_state(),
        default_config(),
    )

    assert unstable.reason_codes == ("reject_unstable",)
    assert unstable.is_sailing_candidate
    assert unstable_sample is not None
    assert quarantine.decision == "quarantined"
    assert quarantine.reason_codes == ("quarantine_engine_suspected",)
    assert not quarantine.retain_stability_history
    assert quarantine.is_sailing_candidate
    assert quarantine_sample is not None


def test_runner_accepts_stable_candidate_and_does_not_observe() -> None:
    state = make_warmed_state()
    prior_length = len(state.window)
    previous_before = state.previous_sample

    result, sample = run(make_read_result(), state, default_config())

    assert result.decision == "accepted"
    assert result.reason_codes == ()
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
        assert result.reason_codes == ()
        assert result.is_sailing_candidate
        assert sample is not None


def test_enhanced_pre_candidate_rejects_are_non_candidates() -> None:
    cases = [
        (make_read_result(enhanced_values={"rpm": (1500.0, 99.5)}), "reject_engine_rpm"),
        (make_read_result(enhanced_values={"depth_m": (0.4, 99.5)}), "reject_shallow"),
    ]
    for read_result, code in cases:
        result, sample = run(read_result, make_warmed_state(), default_config())

        assert result.decision == "rejected"
        assert result.reason_codes == (code,)
        assert not result.is_sailing_candidate
        assert not result.retain_stability_history
        assert sample is not None


def test_enhanced_quality_gate_rejects_are_candidates() -> None:
    cases = [
        (
            make_read_result(
                stw_kt=1.0,
                enhanced_values={"sog_kt": (5.0, 99.5), "current_drift_kt": (0.5, 99.5)},
            ),
            "reject_sog_stw_mismatch",
            make_warmed_state(stw_values=(1.0, 1.0, 1.0)),
        ),
        (
            make_read_result(enhanced_values={"heel_deg": (60.0, 99.5)}),
            "reject_heel_out_of_band",
            make_warmed_state(),
        ),
    ]
    for read_result, code, state in cases:
        result, sample = run(read_result, state, default_config())

        assert result.decision == "rejected"
        assert result.reason_codes == (code,)
        assert not result.retain_stability_history
        assert result.is_sailing_candidate
        assert sample is not None


def test_enhanced_quality_gate_reject_precedes_r16_quarantine() -> None:
    read_result = make_read_result(
        tws_kt=4.0, stw_kt=4.0, enhanced_values={"heel_deg": (60.0, 99.5)}
    )

    result, sample = run(read_result, make_warmed_state(), default_config())

    assert result.decision == "rejected"
    assert result.reason_codes == ("reject_heel_out_of_band",)
    assert sample is not None


def test_secondary_quality_predicates_break_stability_history() -> None:
    cases = (
        (
            make_read_result(
                stw_kt=0.5,
                enhanced_values={"sog_kt": (5.0, 99.5), "current_drift_kt": (0.1, 99.5)},
            ),
            make_warmed_state(stw_values=(5.0, 5.0, 5.0)),
            "reject_sog_stw_mismatch",
        ),
        (
            make_read_result(
                twa_raw=120.0,
                enhanced_values={"awa_deg": (0.0, 99.5), "aws_kt": (12.0, 99.5)},
            ),
            make_warmed_state(),
            "reject_true_wind_crosscheck",
        ),
        (
            make_read_result(twa_raw=120.0, enhanced_values={"heel_deg": (60.0, 99.5)}),
            make_warmed_state(),
            "reject_heel_out_of_band",
        ),
        (
            make_read_result(tws_kt=4.0, stw_kt=4.0),
            make_warmed_state(stw_values=(9.0, 9.0, 9.0)),
            "quarantine_engine_suspected",
        ),
    )
    for read_result, state, poison_code in cases:
        current = run(read_result, ValidationState(), default_config())[1]
        assert current is not None
        state.observe_transition(current)

        result, sample = run(read_result, state, default_config())

        assert result.reason_codes == ("reject_unstable",)
        assert poison_code in result.failed_predicates
        assert not result.retain_stability_history
        assert sample is not None


def test_rate_rejections_with_secondary_r20_break_stability_history() -> None:
    mismatch = {"sog_kt": (5.0, 99.5), "current_drift_kt": (0.1, 99.5)}
    cases = (
        (make_read_result(twa_raw=120.0, stw_kt=1.0, enhanced_values=mismatch), "reject_twa_roc"),
        (make_read_result(tws_kt=30.0, stw_kt=1.0, enhanced_values=mismatch), "reject_tws_roc"),
        (make_read_result(stw_kt=1.0, enhanced_values=mismatch), "reject_stw_roc"),
    )
    for read_result, primary_code in cases:
        state = make_warmed_state()
        previous = state.previous_sample
        assert previous is not None
        state.previous_sample = replace(previous, timestamp_monotonic=99.0)

        result, sample = run(read_result, state, default_config())

        assert result.reason_codes == (primary_code,)
        assert "reject_sog_stw_mismatch" in result.failed_predicates
        assert not result.retain_stability_history
        assert sample is not None


def test_wind_shift_with_steady_heading_reaches_r15_end_to_end() -> None:
    state = make_warmed_state(now=100.0)
    previous = state.previous_sample
    assert previous is not None
    state.previous_sample = replace(previous, heading_deg=90.0)

    read_result = make_read_result(twa_raw=200.0, enhanced_values={"heading_deg": (92.0, 99.5)})
    result, sample = run(read_result, state, default_config())

    assert result.decision == "rejected"
    assert result.reason_codes == ("reject_unstable",)
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
        assert result.reason_codes == ("reject_unstable",)
        assert result.is_sailing_candidate
        assert sample is not None
