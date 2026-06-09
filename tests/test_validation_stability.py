from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from polarrecorder.config import default_config
from polarrecorder.validation import rules_stability
from polarrecorder.validation.state import ValidationState, WindowEntry
from validation_helpers import make_sample, make_warmed_state

if TYPE_CHECKING:
    from polarrecorder.sample import Sample


def _turn_state(
    prev_heading: float | None = None,
    prev_cog: float | None = None,
) -> ValidationState:
    state = make_warmed_state(now=100.0)
    state.previous_sample = WindowEntry(
        timestamp_monotonic=99.0,
        twa_deg_raw=90.0,
        tws_kt=12.0,
        stw_kt=6.0,
        heading_deg=prev_heading,
        cog_deg=prev_cog,
    )
    return state


def _spike_sample(enhanced: dict[str, float] | None) -> Sample:
    return replace(make_sample(twa_raw=200.0, now=100.0), enhanced=enhanced)


def test_r11_sets_cooldown_on_twa_rate_of_change() -> None:
    config = default_config()
    state = make_warmed_state(now=100.0)
    result = rules_stability.twa_rate_of_change(make_sample(twa_raw=200.0), state, config)

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_twa_roc"]
    assert state.cooldown_expires == 130.0


def test_turn_confirm_steady_heading_suppresses_reject_and_cooldown() -> None:
    state = _turn_state(prev_heading=90.0)
    result = rules_stability.twa_rate_of_change(
        _spike_sample({"heading_deg": 90.5}), state, default_config()
    )

    assert result.decision == "pass"
    assert state.cooldown_expires == 0.0


def test_turn_confirm_turning_heading_still_rejects_and_cools_down() -> None:
    state = _turn_state(prev_heading=90.0)
    result = rules_stability.twa_rate_of_change(
        _spike_sample({"heading_deg": 120.0}), state, default_config()
    )

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_twa_roc"]
    assert state.cooldown_expires == 130.0


def test_turn_confirm_both_heading_and_cog_steady_passes() -> None:
    state = _turn_state(prev_heading=90.0, prev_cog=88.0)
    result = rules_stability.twa_rate_of_change(
        _spike_sample({"heading_deg": 90.5, "cog_deg": 88.5}), state, default_config()
    )

    assert result.decision == "pass"
    assert state.cooldown_expires == 0.0


def test_turn_confirm_disagreeing_signals_reject_via_max_of_rates() -> None:
    state = _turn_state(prev_heading=90.0, prev_cog=88.0)
    result = rules_stability.twa_rate_of_change(
        _spike_sample({"heading_deg": 90.5, "cog_deg": 140.0}), state, default_config()
    )

    assert result.decision == "reject"
    assert state.cooldown_expires == 130.0


def test_turn_confirm_heading_only_and_cog_only_variants() -> None:
    heading_only = rules_stability.twa_rate_of_change(
        _spike_sample({"heading_deg": 90.5}), _turn_state(prev_heading=90.0), default_config()
    )
    cog_only = rules_stability.twa_rate_of_change(
        _spike_sample({"cog_deg": 88.5}), _turn_state(prev_cog=88.0), default_config()
    )

    assert heading_only.decision == "pass"
    assert cog_only.decision == "pass"


def test_turn_confirm_disabled_keeps_original_r11() -> None:
    config = replace(default_config(), enh_turnconfirm_enabled=False)
    state = _turn_state(prev_heading=90.0)

    result = rules_stability.twa_rate_of_change(_spike_sample({"heading_deg": 90.5}), state, config)

    assert result.decision == "reject"
    assert state.cooldown_expires == 130.0


def test_turn_confirm_absent_heading_cog_keeps_original_r11() -> None:
    no_enhanced = rules_stability.twa_rate_of_change(
        _spike_sample(None), _turn_state(prev_heading=90.0), default_config()
    )
    no_previous = rules_stability.twa_rate_of_change(
        _spike_sample({"heading_deg": 90.5}), _turn_state(), default_config()
    )

    assert no_enhanced.decision == "reject"
    assert no_previous.decision == "reject"


def test_r11_through_r13_pass_when_no_rate_is_computable() -> None:
    config = default_config()
    empty_state = ValidationState()
    same_time_state = make_warmed_state(now=100.0)
    sample = make_sample(twa_raw=200.0, tws_kt=30.0, stw_kt=20.0, now=95.0)

    assert rules_stability.twa_rate_of_change(sample, empty_state, config).decision == "pass"
    assert rules_stability.twa_rate_of_change(sample, same_time_state, config).decision == "pass"
    assert rules_stability.tws_rate_of_change(sample, same_time_state, config).decision == "pass"
    assert rules_stability.stw_acceleration(sample, same_time_state, config).decision == "pass"


def test_r12_and_r13_reject_current_sample_without_cooldown() -> None:
    config = default_config()
    tws_state = make_warmed_state(now=100.0, tws_values=(12.0, 12.0, 12.0))
    stw_state = make_warmed_state(now=100.0, stw_values=(6.0, 6.0, 6.0))

    tws_result = rules_stability.tws_rate_of_change(make_sample(tws_kt=80.0), tws_state, config)
    stw_result = rules_stability.stw_acceleration(make_sample(stw_kt=20.0), stw_state, config)

    assert tws_result.reason_codes == ["reject_tws_roc"]
    assert stw_result.reason_codes == ["reject_stw_roc"]
    assert tws_state.cooldown_expires == 0.0
    assert stw_state.cooldown_expires == 0.0


def test_r14_reads_maneuver_cooldown() -> None:
    state = make_warmed_state(now=100.0)
    state.cooldown_expires = 110.0
    result = rules_stability.maneuver_cooldown(make_sample(now=100.0), state, default_config())

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_maneuver_cooldown"]


def test_r15_rejects_warming_up_and_matches_state_status() -> None:
    config = default_config()
    state = ValidationState(stability_window_seconds=config.stability_window_seconds)
    state.observe(make_sample(now=90.0))
    sample = make_sample(now=100.0)

    result = rules_stability.stability_window(sample, state, config)

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_warming_up"]
    assert state.is_warming_up(sample.timestamp_monotonic)


def test_r15_rejects_unstable_filled_window() -> None:
    state = make_warmed_state(now=100.0, twa_values=(90.0, 120.0, 90.0))
    result = rules_stability.stability_window(make_sample(now=100.0), state, default_config())

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_unstable"]


def test_r15_passes_stable_filled_window() -> None:
    state = make_warmed_state(now=100.0)
    result = rules_stability.stability_window(make_sample(now=100.0), state, default_config())

    assert result.decision == "pass"
    assert not state.is_warming_up(100.0)


def test_r15_passes_with_jittered_one_second_samples() -> None:
    config = default_config()
    state = ValidationState(stability_window_seconds=config.stability_window_seconds)
    for index in range(15):
        state.observe(make_sample(now=index * 1.01))

    result = rules_stability.stability_window(make_sample(now=15.15), state, config)

    assert result.decision == "pass"
    assert not state.is_warming_up(15.15)


def test_r15_restarts_warmup_after_sample_gap() -> None:
    config = default_config()
    state = make_warmed_state(now=100.0)

    result = rules_stability.stability_window(make_sample(now=130.0), state, config)

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_warming_up"]
    assert state.is_warming_up(130.0)


def test_r15_uses_runtime_config_window_for_warming_up_status() -> None:
    config = replace(default_config(), stability_window_seconds=60)
    state = make_warmed_state(now=100.0)
    result = rules_stability.stability_window(make_sample(now=100.0), state, config)

    assert result.decision == "reject"
    assert result.reason_codes == ["reject_warming_up"]
    assert state.is_warming_up(100.0)


def test_r15_runtime_config_can_shorten_existing_state_window() -> None:
    config = replace(default_config(), stability_window_seconds=5)
    state = ValidationState()
    state.observe(make_sample(now=95.0))
    result = rules_stability.stability_window(make_sample(now=100.0), state, config)

    assert result.decision == "pass"
    assert not state.is_warming_up(100.0)
