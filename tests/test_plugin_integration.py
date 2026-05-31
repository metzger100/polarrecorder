from __future__ import annotations

import json
import sys
import threading
from typing import TYPE_CHECKING, Any

from conftest import FakeAvNavAPI, FakeClock

import plugin as plugin_module
from polarrecorder import persistence, reader
from polarrecorder.counters import Counters
from polarrecorder.polar_model import PolarModel
from polarrecorder.sample import ReadResult, Sample, build_sample
from polarrecorder.timeline import Timeline
from polarrecorder.units import knots_to_meters_per_second

if TYPE_CHECKING:
    from pathlib import Path

    from polarrecorder.polar_model import SnapshotBin


class LoopAvNavAPI(FakeAvNavAPI):
    def __init__(self, max_fetches: int, monotonic: FakeClock, wall: FakeClock) -> None:
        super().__init__()
        self.max_fetches = max_fetches
        self.fetches = 0
        self.monotonic = monotonic
        self.wall = wall

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
        self.set_value(reader.TWA_KEY, 90.0, self.monotonic())
        self.set_value(reader.TWS_KEY, knots_to_meters_per_second(12.0), self.monotonic())
        self.set_value(reader.STW_KEY, knots_to_meters_per_second(6.0), self.monotonic())
        return super().fetchFromQueue(sequence, number, includeSource, waitTime, filter)

    def shouldStopMainThread(self) -> bool:
        return self.fetches >= self.max_fetches


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


def test_handle_request_normalizes_args_and_returns_minimal_status(tmp_path: Path) -> None:
    api = FakeAvNavAPI()
    plugin = make_plugin(tmp_path, api)

    status = plugin._handle_request("status", object(), {"minutes": ["30"], "empty": []})
    unknown = plugin._handle_request("polar", object(), {"format": ["windy"]})

    assert status["status"] == "OK"
    assert isinstance(status["data"], dict)
    assert unknown == {"status": "ERROR", "error": "not implemented"}


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
    sample = _sample_at(monotonic() + 1.0, wall() + 1.0, stw_kt=6.5)
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


def test_plugin_info_falls_back_when_plugin_json_is_missing(
    monkeypatch: Any,
    tmp_path: Path,
    caplog: Any,
) -> None:
    monkeypatch.setattr(plugin_module, "_plugin_dir", str(tmp_path))

    info = plugin_module.Plugin.pluginInfo()

    assert info["version"] == "1.0.0"
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


def _sample_at(timestamp: float, wall_time: float, stw_kt: float = 6.0) -> Sample | None:
    read_result = ReadResult(
        timestamp_monotonic=timestamp,
        timestamp_wall=wall_time,
        twa_raw=90.0,
        tws_raw=knots_to_meters_per_second(12.0),
        stw_raw=knots_to_meters_per_second(stw_kt),
        twa_timestamp=timestamp,
        tws_timestamp=timestamp,
        stw_timestamp=timestamp,
    )
    return build_sample(read_result)
