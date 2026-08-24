from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from conftest import FakeAvNavAPI
from plugin_integration_support import make_plugin
from polarrecorder import reader
from validation_helpers import make_read_result, make_warmed_state

if TYPE_CHECKING:
    from pathlib import Path


def test_paused_iteration_accounts_for_malformed_core_without_crashing(tmp_path: Path) -> None:
    plugin = make_plugin(tmp_path, FakeAvNavAPI())
    malformed = replace(make_read_result(), twa_raw="bad")

    plugin._record_suppressed(malformed, "partial", "reject_user_paused", plugin.config)

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
