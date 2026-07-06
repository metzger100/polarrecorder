from __future__ import annotations

import json
import sys
import threading
from typing import TYPE_CHECKING, Any, Literal, cast

from conftest import FakeAvNavAPI, FakeClock, FakeDataEntry
from plugin_integration_support import assert_all_mvp_routes, response_data, sample_at
from polarrecorder import api_dispatch, export, persistence, reader
from polarrecorder.counters import Counters
from polarrecorder.polar_model import PolarModel
from polarrecorder.timeline import Timeline
from polarrecorder.units import knots_to_meters_per_second

import plugin as plugin_module

if TYPE_CHECKING:
    from pathlib import Path

    from polarrecorder.polar_model import SnapshotBin


class LoopAvNavAPI(FakeAvNavAPI):
    def __init__(
        self,
        max_fetches: int,
        monotonic: FakeClock,
        wall: FakeClock,
        data_mode: Literal["receiving", "partial", "no_data"] = "receiving",
        restart_on_fetch: int | None = None,
        fail_read_at_fetch: int | None = None,
    ) -> None:
        super().__init__()
        self.max_fetches = max_fetches
        self.fetches = 0
        self.monotonic = monotonic
        self.wall = wall
        self.data_mode = data_mode
        self.restart_on_fetch = restart_on_fetch
        self.fail_read_at_fetch = fail_read_at_fetch
        self.failed_reads = 0

    def fetchFromQueue(
        self,
        sequence: int,
        number: int = 10,
        includeSource: bool = False,
        waitTime: float = 0.5,
        filter: str | list[str] | None = None,  # noqa: A002
    ) -> tuple[int, list[str]]:
        self.fetches += 1
        self.monotonic.advance(1.0)
        self.wall.advance(1.0)
        self.values.clear()
        if self.data_mode in {"receiving", "partial"}:
            self.set_value(reader.TWA_KEY, 90.0, self.monotonic())
        if self.data_mode == "receiving":
            self.set_value(reader.TWS_KEY, knots_to_meters_per_second(12.0), self.monotonic())
            self.set_value(reader.STW_KEY, knots_to_meters_per_second(6.0), self.monotonic())
        if self.fetches == self.restart_on_fetch and self.restart_callback is not None:
            self.restart_callback()
        return super().fetchFromQueue(sequence, number, includeSource, waitTime, filter)

    def shouldStopMainThread(self) -> bool:
        return self.fetches >= self.max_fetches

    def getSingleValue(self, key: str, includeInfo: bool = False) -> float | FakeDataEntry | None:
        if self.fetches == self.fail_read_at_fetch and self.failed_reads == 0:
            self.failed_reads += 1
            msg = "store read failed"
            raise RuntimeError(msg)
        return super().getSingleValue(key, includeInfo)


def make_plugin(tmp_path: Path, api: FakeAvNavAPI) -> plugin_module.Plugin:
    monotonic = getattr(api, "monotonic", FakeClock(100.0))
    wall = getattr(api, "wall", FakeClock(1000.0))
    plugin = plugin_module.Plugin(api)
    plugin._data_dir = str(tmp_path)
    plugin._clock = monotonic
    plugin._wall_clock = wall
    plugin._timeline = Timeline(wall)
    plugin._run_start_monotonic = monotonic()
    plugin._load_persistence()
    return plugin


def test_plugin_registers_no_avnav_editable_parameters(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    make_plugin(tmp_path, api)

    assert api.editable_parameters == []


def test_run_registers_viewer_user_app_once(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(max_fetches=2, monotonic=monotonic, wall=wall)
    plugin = make_plugin(tmp_path, api)

    plugin.run()
    plugin.run()

    assert api.user_apps == [
        (
            "/plugins/user-polarrecorder/viewer/viewer.html",
            "viewer/icon.svg",
            "Polar Recorder",
        )
    ]


def test_full_fake_avnav_loop_updates_model_and_flushes_to_tmp_data_dir(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(max_fetches=20, monotonic=monotonic, wall=wall)
    plugin = make_plugin(tmp_path, api)

    plugin.run()

    assert plugin._model.query(65)[(90, 12)] == 6.0
    assert plugin._counters.total_accepted > 0
    assert plugin._counters.total_seen == (
        plugin._counters.total_accepted
        + plugin._counters.total_rejected
        + plugin._counters.total_quarantined
    )
    assert (tmp_path / "polar.json").exists()
    assert api.request_handler is not None
    assert ("NMEA", "Recording sailing polar") in api.statuses


def test_handle_request_normalizes_args_and_routes_real_endpoints(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    plugin = make_plugin(tmp_path, api)

    status = plugin._handle_request("status", object(), {"minutes": ["30"], "empty": []})
    polar = plugin._handle_request("polar", object(), {"format": ["windy"]})
    unknown = plugin._handle_request("missing", object(), {})

    assert status["status"] == "OK"
    assert isinstance(status["data"], dict)
    assert polar["status"] == "OK"
    assert unknown["status"] == "ERROR"


def test_enhanced_endpoints_keys_status_and_save(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    api.set_value("gps.speed", 5.0, 99.5)
    api.set_value("gps.windAngle", 30.0, 99.5)
    api.set_value("gps.windSpeed", 4.0, 99.5)
    api.set_value("gps.currentDrift", 0.5, 99.5)
    api.set_value("gps.depthBelowKeel", 3.0, 90.0)
    api.set_value("gps.headingTrue", 100.0, 99.5)
    api.set_value("gps.track", 105.0, 99.5)
    plugin = make_plugin(tmp_path, api)

    keys = response_data(plugin._handle_request("enhanced/keys", object(), {}))
    status = response_data(plugin._handle_request("enhanced/status", object(), {}))
    status_rows = cast("list[dict[str, object]]", status["rules"])
    rules = {cast("str", row["rule"]): cast("str", row["status"]) for row in status_rows}
    enable_fields = {
        cast("str", row["rule"]): cast("str", row["enable_field"]) for row in status_rows
    }

    assert "gps.speed" in cast("list[str]", keys["keys"])
    assert "gps.currentDrift" in cast("list[str]", keys["keys"])
    assert enable_fields["reject_engine_rpm"] == "enh_rpm_enabled"
    assert enable_fields["turn_confirm"] == "enh_turnconfirm_enabled"
    assert rules["reject_engine_rpm"] == "inactive_key_not_configured"
    assert rules["reject_shallow"] == "inactive_value_missing"
    assert rules["reject_sog_stw_mismatch"] == "active"
    assert rules["reject_true_wind_crosscheck"] == "active"
    assert rules["turn_confirm"] == "active"

    unknown = plugin._handle_request("enhanced/save", object(), {"nope": ["1"]})
    saved = response_data(
        plugin._handle_request(
            "enhanced/save",
            object(),
            {"enh_rpm_enabled": ["false"], "enh_rpm_idle_max": ["1200"]},
        )
    )

    assert unknown["status"] == "ERROR"
    assert plugin.config.enh_rpm_enabled is False
    assert plugin.config.enh_rpm_idle_max == 1200
    assert {"enh_rpm_enabled": "false", "enh_rpm_idle_max": "1200"} in api.saved_configs
    assert cast("dict[str, object]", saved["config"])["enh_rpm_idle_max"] == 1200


def test_concurrent_model_update_and_snapshot_read_are_detached(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(max_fetches=25, monotonic=monotonic, wall=wall)
    plugin = make_plugin(tmp_path, api)
    snapshots: list[dict[tuple[int, int], SnapshotBin]] = []

    def read_snapshots() -> None:
        for _ in range(50):
            with plugin._lock:
                snapshots.append(plugin._model.snapshot_bins())

    read_thread = threading.Thread(target=read_snapshots)
    run_thread = threading.Thread(target=plugin.run)
    read_thread.start()
    run_thread.start()
    read_thread.join()
    run_thread.join()

    with plugin._lock:
        snapshot = plugin._model.snapshot_bins()
    sample = sample_at(monotonic() + 1.0, wall() + 1.0, stw_kt=6.5)
    assert sample is not None
    plugin._model.update_accepted(sample)

    assert snapshots
    assert (90, 12) in snapshot
    assert snapshot[(90, 12)]["histogram"] != plugin._model.snapshot_bins()[(90, 12)]["histogram"]


def test_config_hot_swap_replaces_config_without_resetting_validation_state(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(max_fetches=2, monotonic=monotonic, wall=wall)
    plugin = make_plugin(tmp_path, api)
    plugin.run()
    state = plugin._state
    window_length = len(state.window)

    plugin._on_config_change({"percentile": "72", "stability_window_seconds": "30"})

    assert plugin.config.percentile == 72
    assert plugin.config.stability_window_seconds == 30
    assert plugin._state is state
    assert len(plugin._state.window) == window_length


def test_reset_pause_resume_and_export_json_endpoints(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(max_fetches=1, monotonic=monotonic, wall=wall)
    plugin = make_plugin(tmp_path, api)
    sample = sample_at(monotonic(), wall())
    assert sample is not None
    plugin._model.update_accepted(sample)
    plugin._counters.record_accepted()

    denied = plugin._handle_request("reset", object(), {})
    paused = plugin._handle_request("pause", object(), {})
    resumed = plugin._handle_request("resume", object(), {})
    reset = plugin._handle_request("reset", object(), {"confirm": ["yes"]})
    backup = plugin._handle_request("export/json", object(), {})

    assert denied["status"] == "ERROR"
    assert paused == {"status": "OK", "data": {"recording": False}}
    assert resumed == {"status": "OK", "data": {"recording": True}}
    assert reset["status"] == "OK"
    assert plugin._flush_requested is True
    assert plugin._model.snapshot_bins() == {}
    assert plugin._counters.total_seen == 0
    assert backup["status"] == "OK"

    plugin._paused = True
    plugin.run()

    assert plugin._flush_requested is False
    assert (tmp_path / "polar.json").exists()
    assert persistence.load(tmp_path).model.snapshot_bins() == {}


def test_concurrent_preset_saves_are_serialized(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    plugin = make_plugin(tmp_path, api)

    def save(name: str, twa: str, tws: str) -> None:
        response = plugin._handle_request(
            "presets/save",
            object(),
            {"name": [name], "twa": [twa], "tws": [tws]},
        )
        assert response["status"] == "OK"

    first = threading.Thread(target=save, args=("alpha", "0,90", "4,8"))
    second = threading.Thread(target=save, args=("bravo", "30,120", "6,10"))
    first.start()
    second.start()
    first.join()
    second.join()

    names = {preset.name for preset in export.list_presets(tmp_path)}

    assert {"alpha", "bravo"}.issubset(names)


def test_all_mvp_routes_handle_avnav_style_args(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = FakeAvNavAPI()
    plugin = make_plugin(tmp_path, api)
    assert_all_mvp_routes(plugin, monotonic, wall)


def test_plugin_info_reads_plugin_json_version(
    monkeypatch: Any,
    tmp_path: Path,
) -> None:
    plugin_json = tmp_path / "plugin.json"
    plugin_json.write_text(json.dumps({"version": "9.8.7"}), encoding="utf-8")
    monkeypatch.setattr(plugin_module, "_plugin_dir", str(tmp_path))

    info = plugin_module.Plugin.pluginInfo()

    assert info == {
        "description": plugin_module.DESCRIPTION,
        "version": "9.8.7",
    }
    assert "config" not in info


def test_plugin_info_uses_dev_fallback_when_plugin_json_has_no_version(
    monkeypatch: Any,
    tmp_path: Path,
    caplog: Any,
) -> None:
    plugin_json = tmp_path / "plugin.json"
    plugin_json.write_text(json.dumps({"userApps": []}), encoding="utf-8")
    monkeypatch.setattr(plugin_module, "_plugin_dir", str(tmp_path))

    info = plugin_module.Plugin.pluginInfo()

    assert info["version"] == "0.0.0-dev"
    assert "plugin.json version" not in caplog.text


def test_plugin_info_falls_back_when_plugin_json_is_missing(
    monkeypatch: Any,
    tmp_path: Path,
    caplog: Any,
) -> None:
    monkeypatch.setattr(plugin_module, "_plugin_dir", str(tmp_path))

    info = plugin_module.Plugin.pluginInfo()

    assert info["version"] == "0.0.0-dev"
    assert "plugin.json version" in caplog.text


def test_import_path_guard_exposes_package() -> None:
    assert plugin_module._plugin_dir in sys.path
    assert reader.TWA_KEY == "gps.trueWindAngle"


def test_corrupt_persistence_load_sets_error_status(tmp_path: Path) -> None:
    (tmp_path / persistence.PRIMARY_NAME).write_text("{bad", encoding="utf-8")
    (tmp_path / persistence.BACKUP_NAME).write_text("{bad", encoding="utf-8")
    api = FakeAvNavAPI()
    plugin = make_plugin(tmp_path, api)

    assert plugin._startup_error_active is True
    assert api.statuses[-1][0] == "ERROR"
    assert "starting empty" in api.statuses[-1][1]


def test_schema_too_new_error_status_survives_run(tmp_path: Path) -> None:
    payload = persistence.serialize_to_dict(
        PolarModel(),
        Counters(),
        persistence.PersistenceMetadata(),
    )
    payload["schema_version"] = persistence.CURRENT_SCHEMA_VERSION + 1
    (tmp_path / persistence.PRIMARY_NAME).write_text(json.dumps(payload), encoding="utf-8")
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(max_fetches=20, monotonic=monotonic, wall=wall)
    plugin = make_plugin(tmp_path, api)

    plugin.run()

    assert plugin._startup_error_active is True
    assert api.statuses[0][0] == "ERROR"
    assert api.statuses[-1][0] == "ERROR"
    assert all(status not in {"STARTED", "RUNNING", "NMEA"} for status, _ in api.statuses)
    assert plugin._counters.total_accepted > 0


def test_fresh_persistence_startup_can_promote_status_normally(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(max_fetches=20, monotonic=monotonic, wall=wall)
    plugin = make_plugin(tmp_path, api)

    plugin.run()

    assert plugin._startup_error_active is False
    assert ("STARTED", "Polar Recorder started") in api.statuses
    assert ("NMEA", "Recording sailing polar") in api.statuses


def test_loop_survives_iteration_error_and_final_flushes(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(
        max_fetches=20,
        monotonic=monotonic,
        wall=wall,
        fail_read_at_fetch=1,
    )
    plugin = make_plugin(tmp_path, api)

    plugin.run()

    assert api.fetches == api.max_fetches
    assert api.failed_reads == 1
    assert any(
        level == "error" and "Polar Recorder loop error: store read failed" in message
        for level, message in api.logs
    )
    assert plugin._counters.total_accepted > 0
    assert (tmp_path / persistence.PRIMARY_NAME).exists()


def test_incomplete_data_demotes_status_even_when_paused(tmp_path: Path) -> None:
    data_modes: tuple[Literal["partial", "no_data"], ...] = ("partial", "no_data")
    for data_mode in data_modes:
        for paused in (False, True):
            monotonic = FakeClock(100.0)
            wall = FakeClock(1000.0)
            api = LoopAvNavAPI(
                max_fetches=31,
                monotonic=monotonic,
                wall=wall,
                data_mode=data_mode,
            )
            case_dir = tmp_path / f"{data_mode}_{paused}"
            plugin = make_plugin(case_dir, api)
            if paused:
                pause_response = plugin._handle_request("pause", object(), {})
                assert pause_response == {"status": "OK", "data": {"recording": False}}

            plugin.run()

            status = response_data(plugin._handle_request("status", object(), {}))
            assert status["data_status"] == data_mode
            assert status["recording"] is not paused
            assert ("STARTED", "No instrument data") in api.statuses


def test_request_handler_returns_error_for_internal_dispatch_failure(
    monkeypatch: Any,
    tmp_path: Path,
) -> None:
    api = FakeAvNavAPI()
    make_plugin(tmp_path, api)

    def fail_dispatch(
        plugin: object,
        url: str,
        args: dict[str, str],
    ) -> dict[str, object]:
        del plugin, url, args
        msg = "dispatcher failed"
        raise RuntimeError(msg)

    monkeypatch.setattr(api_dispatch, "handle_request", fail_dispatch)
    handler = api.request_handler
    assert handler is not None

    response = handler("status", object(), {"minutes": ["30"]})

    assert response == {"status": "ERROR", "error": "Internal error"}
    assert any(
        level == "error" and "Polar Recorder request error: dispatcher failed" in message
        for level, message in api.logs
    )


def test_restart_callback_stops_loop_and_final_flushes(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    wall = FakeClock(1000.0)
    api = LoopAvNavAPI(
        max_fetches=50,
        monotonic=monotonic,
        wall=wall,
        restart_on_fetch=4,
    )
    plugin = make_plugin(tmp_path, api)
    assert api.restart_callback is not None

    plugin.run()

    assert api.fetches == 4
    assert api.fetches < api.max_fetches
    assert (tmp_path / persistence.PRIMARY_NAME).exists()
