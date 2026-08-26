from __future__ import annotations

import json
from dataclasses import replace
from typing import TYPE_CHECKING

from conftest import FakeAvNavAPI, drive_read_results
from plugin_integration_support import make_plugin
from polarrecorder import reader
from polarrecorder.config import default_config
from polarrecorder.polar_model import PolarModel
from polarrecorder.validation.state import ValidationState
from validation_helpers import make_read_result, make_warmed_state

if TYPE_CHECKING:
    from pathlib import Path


def test_paused_iteration_accounts_for_malformed_core_without_crashing(tmp_path: Path) -> None:
    plugin = make_plugin(tmp_path, FakeAvNavAPI())
    malformed = replace(make_read_result(), twa_raw="bad")

    with plugin._lock:
        plugin._record_suppressed(malformed, "partial", "reject_user_paused")

    assert plugin._counters.rejection_histogram == {"reject_user_paused": 1}
    assert plugin._last_data_status == "partial"
    assert plugin._warming_up


def test_non_candidate_iteration_clears_stability_but_keeps_transition_observation(
    tmp_path: Path,
) -> None:
    api = FakeAvNavAPI()
    api.set_value(reader.TWA_KEY, 90.0, 90.0)
    api.set_value(reader.TWS_KEY, 6.0, 90.0)
    api.set_value(reader.STW_KEY, 3.0, 90.0)
    plugin = make_plugin(tmp_path, api)
    plugin._state = make_warmed_state()

    plugin._run_iteration(plugin.config)

    assert not plugin._state.window
    assert plugin._state.previous_sample is not None
    assert plugin._last_data_status == "partial"
    assert plugin._warming_up


def test_iteration_drops_read_when_config_snapshot_is_superseded(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    api.set_value(reader.TWA_KEY, 90.0, 100.0)
    api.set_value(reader.TWS_KEY, 6.0, 100.0)
    api.set_value(reader.STW_KEY, 3.0, 100.0)
    plugin = make_plugin(tmp_path, api)
    stale_config = plugin.config
    with plugin._lock:
        plugin.config = replace(stale_config, max_stw=10)

    plugin._run_iteration(stale_config)

    assert plugin._counters.total_seen == 0
    assert plugin._last_data_status == "no_data"


def test_superseded_read_emits_explicit_diagnostic_when_enabled(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    api.set_value(reader.TWA_KEY, 90.0, 100.0)
    api.set_value(reader.TWS_KEY, 6.0, 100.0)
    api.set_value(reader.STW_KEY, 3.0, 100.0)
    plugin = make_plugin(tmp_path, api)
    stale_config = replace(plugin.config, debug_logging=True)
    with plugin._lock:
        plugin.config = replace(stale_config, max_stw=10)

    plugin._run_iteration(stale_config)

    diagnostic = next(message for level, message in api.logs if level == "debug")
    payload = json.loads(diagnostic.removeprefix("diagnostic_sample="))
    assert payload["pipeline"]["decision"] == "discarded"
    assert payload["pipeline"]["reason_codes"] == ["config_superseded"]
    assert plugin._counters.total_seen == 0


def test_pause_and_resume_each_clear_stability_history(tmp_path: Path) -> None:
    plugin = make_plugin(tmp_path, FakeAvNavAPI())
    plugin._state = make_warmed_state()

    plugin._handle_request("pause", object(), {})
    assert not plugin._state.window
    assert plugin._warming_up

    plugin._state = make_warmed_state()
    plugin._handle_request("resume", object(), {})
    assert not plugin._state.window
    assert plugin._warming_up


def test_engine_quarantine_breaks_history_before_conditions_clear() -> None:
    config = default_config()
    state = ValidationState()
    model = PolarModel()
    quarantine_reads = [
        make_read_result(now=float(timestamp), tws_kt=4.0, stw_kt=4.0)
        for timestamp in range(85, 101)
    ]

    results = drive_read_results(quarantine_reads, state, config, model)
    recovery = drive_read_results(
        [make_read_result(now=101.0, tws_kt=5.1, stw_kt=4.0)], state, config, model
    )[0][0]

    assert results[-1][0].reason_codes == ("reject_warming_up",)
    assert "quarantine_engine_suspected" in results[-1][0].failed_predicates
    assert not results[-1][0].retain_stability_history
    assert recovery.reason_codes == ("reject_warming_up",)


def test_sog_stw_mismatch_breaks_history_before_mismatch_clears() -> None:
    config = default_config()
    state = ValidationState()
    model = PolarModel()
    mismatch = {"sog_kt": (5.0, 99.5), "current_drift_kt": (0.1, 99.5)}
    mismatch_reads = [
        make_read_result(now=float(timestamp), stw_kt=1.0, enhanced_raw=mismatch)
        for timestamp in range(85, 101)
    ]

    results = drive_read_results(mismatch_reads, state, config, model)
    recovery = drive_read_results([make_read_result(now=101.0, stw_kt=1.0)], state, config, model)[
        0
    ][0]

    assert results[-1][0].reason_codes == ("reject_warming_up",)
    assert "reject_sog_stw_mismatch" in results[-1][0].failed_predicates
    assert not results[-1][0].retain_stability_history
    assert recovery.reason_codes == ("reject_warming_up",)


def test_enhanced_status_applies_boolean_policy_by_signal_role(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    physical_bool: object = True
    engine_bool: object = True
    api.set_value("gps.depthBelowKeel", physical_bool, 99.5)
    api.set_value("engine.state", engine_bool, 99.5)
    plugin = make_plugin(tmp_path, api)
    plugin.config = replace(plugin.config, enh_engine_state_key="engine.state")

    response = plugin._handle_request("enhanced/status", object(), {})
    data = response["data"]
    assert isinstance(data, dict)
    rows = data["rules"]
    assert isinstance(rows, list)
    statuses = {row["rule"]: row["status"] for row in rows if isinstance(row, dict)}

    assert statuses["reject_shallow"] == "inactive_value_invalid"
    assert statuses["reject_engine_on"] == "active"
