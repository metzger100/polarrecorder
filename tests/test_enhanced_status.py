from __future__ import annotations

from dataclasses import replace

from polarrecorder.config import Config, default_config
from polarrecorder.enhanced_input import EnhancedInput
from polarrecorder.enhanced_status import ENHANCED_RULE_SPECS, compute_enhanced_status
from polarrecorder.sample import ENHANCED_SIGNAL_BY_ROLE


def _status(config: Config, probes: dict[str, EnhancedInput], rule: str) -> str:
    rows = compute_enhanced_status(config, probes)
    return next(str(row["status"]) for row in rows if row["rule"] == rule)


def _availability(config: Config, probes: dict[str, EnhancedInput], rule: str) -> str:
    rows = compute_enhanced_status(config, probes)
    return next(str(row["availability"]) for row in rows if row["rule"] == rule)


_FRESH = EnhancedInput("usable", 1.0, 99.5, 1.0)
_STALE = EnhancedInput("stale", 1.0, 90.0, 1.0)
_INVALID = EnhancedInput("invalid", "bad", 99.5, None)
_MISSING = EnhancedInput("missing", None, None, None)

_ENABLE_FIELDS = {
    "reject_engine_rpm": "enh_rpm_enabled",
    "reject_engine_on": "enh_engine_state_enabled",
    "reject_shallow": "enh_depth_enabled",
    "reject_sog_stw_mismatch": "enh_slip_enabled",
    "reject_true_wind_crosscheck": "enh_tw_crosscheck_enabled",
    "reject_heel_out_of_band": "enh_heel_enabled",
    "turn_confirm": "enh_turnconfirm_enabled",
}


def test_every_rule_source_role_has_one_canonical_signal_spec() -> None:
    roles = {role for spec in ENHANCED_RULE_SPECS for role in spec.source_roles}

    assert roles <= ENHANCED_SIGNAL_BY_ROLE.keys()


def test_each_row_carries_its_enable_field() -> None:
    rows = compute_enhanced_status(default_config(), {})

    actual = {str(row["rule"]): row["enable_field"] for row in rows}
    assert actual == _ENABLE_FIELDS


def test_disabled_when_switch_off() -> None:
    config = replace(default_config(), enh_depth_enabled=False)

    assert _status(config, {}, "reject_shallow") == "disabled"
    assert _availability(config, {}, "reject_shallow") == "disabled"


def test_inactive_key_not_configured_for_empty_required_key() -> None:
    config = default_config()  # enh_rpm_key defaults to ""

    assert _status(config, {}, "reject_engine_rpm") == "inactive_key_not_configured"
    assert _availability(config, {}, "reject_engine_rpm") == "unavailable"


def test_inactive_key_not_configured_for_any_combinator_all_empty() -> None:
    config = replace(default_config(), enh_heading_key="", enh_cog_key="")

    assert _status(config, {}, "turn_confirm") == "inactive_key_not_configured"


def test_active_single_key_when_fresh() -> None:
    config = default_config()
    probes = {"depth_m": _FRESH}

    assert _status(config, probes, "reject_shallow") == "active"
    assert _availability(config, probes, "reject_shallow") == "active"


def test_inactive_key_missing_when_read_returns_none() -> None:
    config = default_config()
    probes = {"depth_m": _MISSING}

    assert _status(config, probes, "reject_shallow") == "inactive_key_missing"


def test_inactive_value_missing_when_read_is_stale() -> None:
    config = default_config()
    probes = {"depth_m": _STALE}

    assert _status(config, probes, "reject_shallow") == "inactive_value_missing"


def test_inactive_value_invalid_is_never_active() -> None:
    config = default_config()
    probes = {"depth_m": _INVALID}

    assert _status(config, probes, "reject_shallow") == "inactive_value_invalid"
    assert _availability(config, probes, "reject_shallow") == "unavailable"


def test_all_combinator_requires_both_keys_fresh() -> None:
    config = default_config()
    one_fresh = {"sog_kt": _FRESH, "current_drift_kt": _MISSING}
    one_stale = {"sog_kt": _STALE, "current_drift_kt": _MISSING}
    both_fresh = {"sog_kt": _FRESH, "current_drift_kt": _FRESH}

    assert _status(config, one_fresh, "reject_sog_stw_mismatch") == "inactive_key_missing"
    assert _status(config, one_stale, "reject_sog_stw_mismatch") == "inactive_key_missing"
    assert _status(config, both_fresh, "reject_sog_stw_mismatch") == "active"


def test_all_combinator_key_missing_when_drift_key_unconfigured() -> None:
    config = replace(default_config(), enh_current_drift_key="")

    assert _status(config, {}, "reject_sog_stw_mismatch").startswith("inactive_key")


def test_r21_inactive_key_when_one_of_awa_aws_unconfigured() -> None:
    config = replace(default_config(), enh_aws_key="")

    assert _status(config, {}, "reject_true_wind_crosscheck").startswith("inactive_key")


def test_any_combinator_active_with_one_fresh_key() -> None:
    config = default_config()
    probes = {"heading_deg": _FRESH, "cog_deg": _MISSING}

    assert _status(config, probes, "turn_confirm") == "active"


def test_any_combinator_remains_active_with_one_usable_and_one_invalid_key() -> None:
    config = default_config()
    probes = {"heading_deg": _FRESH, "cog_deg": _INVALID}

    assert _status(config, probes, "turn_confirm") == "active"


def test_any_combinator_reports_missing_before_stale_when_none_are_fresh() -> None:
    config = default_config()
    probes = {"heading_deg": _STALE, "cog_deg": _MISSING}

    assert _status(config, probes, "turn_confirm") == "inactive_key_missing"


def test_all_combinator_reports_stale_only_when_no_source_is_missing() -> None:
    config = default_config()
    probes = {"sog_kt": _STALE, "current_drift_kt": _STALE}

    assert _status(config, probes, "reject_sog_stw_mismatch") == "inactive_value_missing"
