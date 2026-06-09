from __future__ import annotations

from dataclasses import replace

from polarrecorder.config import Config, default_config
from polarrecorder.enhanced_status import KeyProbe, compute_enhanced_status


def _status(config: Config, probes: dict[str, KeyProbe], rule: str) -> str:
    rows = compute_enhanced_status(config, probes)
    return next(str(row["status"]) for row in rows if row["rule"] == rule)


_FRESH = KeyProbe(present=True, fresh=True)
_STALE = KeyProbe(present=True, fresh=False)
_MISSING = KeyProbe(present=False, fresh=False)

_ENABLE_FIELDS = {
    "reject_engine_rpm": "enh_rpm_enabled",
    "reject_engine_on": "enh_engine_state_enabled",
    "reject_shallow": "enh_depth_enabled",
    "reject_sog_stw_mismatch": "enh_slip_enabled",
    "reject_true_wind_crosscheck": "enh_tw_crosscheck_enabled",
    "reject_heel_out_of_band": "enh_heel_enabled",
    "turn_confirm": "enh_turnconfirm_enabled",
}


def test_each_row_carries_its_enable_field() -> None:
    rows = compute_enhanced_status(default_config(), {})

    actual = {str(row["rule"]): row["enable_field"] for row in rows}
    assert actual == _ENABLE_FIELDS


def test_disabled_when_switch_off() -> None:
    config = replace(default_config(), enh_depth_enabled=False)

    assert _status(config, {}, "reject_shallow") == "disabled"


def test_inactive_key_not_configured_for_empty_required_key() -> None:
    config = default_config()  # enh_rpm_key defaults to ""

    assert _status(config, {}, "reject_engine_rpm") == "inactive_key_not_configured"


def test_inactive_key_not_configured_for_any_combinator_all_empty() -> None:
    config = replace(default_config(), enh_heading_key="", enh_cog_key="")

    assert _status(config, {}, "turn_confirm") == "inactive_key_not_configured"


def test_active_single_key_when_fresh() -> None:
    config = default_config()
    probes = {config.enh_depth_key: _FRESH}

    assert _status(config, probes, "reject_shallow") == "active"


def test_inactive_key_missing_when_read_returns_none() -> None:
    config = default_config()
    probes = {config.enh_depth_key: _MISSING}

    assert _status(config, probes, "reject_shallow") == "inactive_key_missing"


def test_inactive_value_missing_when_read_is_stale() -> None:
    config = default_config()
    probes = {config.enh_depth_key: _STALE}

    assert _status(config, probes, "reject_shallow") == "inactive_value_missing"


def test_all_combinator_requires_both_keys_fresh() -> None:
    config = default_config()
    one_fresh = {config.enh_sog_key: _FRESH, config.enh_current_drift_key: _MISSING}
    one_stale = {config.enh_sog_key: _STALE, config.enh_current_drift_key: _MISSING}
    both_fresh = {config.enh_sog_key: _FRESH, config.enh_current_drift_key: _FRESH}

    assert _status(config, one_fresh, "reject_sog_stw_mismatch") == "inactive_value_missing"
    assert _status(config, one_stale, "reject_sog_stw_mismatch") == "inactive_value_missing"
    assert _status(config, both_fresh, "reject_sog_stw_mismatch") == "active"


def test_all_combinator_key_missing_when_drift_key_unconfigured() -> None:
    config = replace(default_config(), enh_current_drift_key="")

    assert _status(config, {}, "reject_sog_stw_mismatch").startswith("inactive_key")


def test_r21_inactive_key_when_one_of_awa_aws_unconfigured() -> None:
    config = replace(default_config(), enh_aws_key="")

    assert _status(config, {}, "reject_true_wind_crosscheck").startswith("inactive_key")


def test_any_combinator_active_with_one_fresh_key() -> None:
    config = default_config()
    probes = {config.enh_heading_key: _FRESH, config.enh_cog_key: _MISSING}

    assert _status(config, probes, "turn_confirm") == "active"
