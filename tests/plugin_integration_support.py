from __future__ import annotations

from typing import TYPE_CHECKING, Literal, cast

from conftest import FakeAvNavAPI, FakeClock
from polarrecorder import reader
from polarrecorder.sample import ReadResult, Sample, build_sample
from polarrecorder.timeline import Timeline
from polarrecorder.units import knots_to_meters_per_second

import plugin as plugin_module

if TYPE_CHECKING:
    from pathlib import Path


class LoopAvNavAPI(FakeAvNavAPI):
    """Fake AvNav loop source with deterministic clock and data behavior."""

    def __init__(
        self,
        max_fetches: int,
        monotonic: FakeClock,
        wall: FakeClock,
        data_mode: Literal["receiving", "partial", "no_data"] = "receiving",
        restart_on_fetch: int | None = None,
        fail_read_at_fetch: int | None = None,
    ) -> None:
        """Initialize deterministic loop controls."""
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
        filter_values: str | list[str] | None = None,
    ) -> tuple[int, list[str]]:
        """Advance clocks and publish the configured core values."""
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
        return super().fetchFromQueue(sequence, number, includeSource, waitTime, filter_values)

    def shouldStopMainThread(self) -> bool:
        """Stop after the configured fetch count."""
        return self.fetches >= self.max_fetches

    def getSingleValue(self, key: str, includeInfo: bool = False) -> object | None:
        """Inject one optional store read failure."""
        if self.fetches == self.fail_read_at_fetch and self.failed_reads == 0:
            self.failed_reads += 1
            msg = "store read failed"
            raise RuntimeError(msg)
        return super().getSingleValue(key, includeInfo)


def make_plugin(tmp_path: Path, api: FakeAvNavAPI) -> plugin_module.Plugin:
    """Build a plugin wired to deterministic clocks and temporary persistence."""
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


def assert_all_mvp_routes(
    plugin: plugin_module.Plugin,
    monotonic: FakeClock,
    wall: FakeClock,
) -> None:
    _populate_route_model(plugin, monotonic, wall)
    _assert_read_routes(plugin)
    _assert_export_routes(plugin)
    _assert_mutation_routes(plugin)


def response_data(response: dict[str, object]) -> dict[str, object]:
    assert response["status"] == "OK"
    return cast("dict[str, object]", response["data"])


def sample_at(timestamp: float, wall_time: float, stw_kt: float = 6.0) -> Sample | None:
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


def _populate_route_model(
    plugin: plugin_module.Plugin,
    monotonic: FakeClock,
    wall: FakeClock,
) -> None:
    for _ in range(5):
        sample = sample_at(monotonic(), wall())
        assert sample is not None
        plugin._model.update_accepted(sample)
        plugin._counters.record_accepted()
        monotonic.advance(1.0)
        wall.advance(1.0)
    rejected = sample_at(monotonic(), wall())
    assert rejected is not None
    plugin._model.record_rejection(rejected, ["reject_unstable"])
    plugin._counters.record_rejected(["reject_unstable"])
    plugin._timeline.record("rejected", ["reject_unstable"])


def _assert_read_routes(plugin: plugin_module.Plugin) -> None:
    status = response_data(plugin._handle_request("status", object(), {}))
    polar_first = plugin._handle_request("polar", object(), {"format": ["windy"]})
    polar_second = plugin._handle_request("polar", object(), {"format": ["windy"]})
    polar_inline = plugin._handle_request("polar", object(), {"twa": ["90"], "tws": ["12"]})
    polar_mixed = plugin._handle_request(
        "polar",
        object(),
        {"format": ["windy"], "twa": ["90"], "tws": ["12"]},
    )
    rejections = response_data(plugin._handle_request("rejections", object(), {}))
    timeline = response_data(plugin._handle_request("timeline", object(), {"minutes": ["30"]}))
    invalid_timeline = plugin._handle_request("timeline", object(), {"minutes": ["bad"]})
    config = response_data(plugin._handle_request("config", object(), {}))
    backup = response_data(plugin._handle_request("export/json", object(), {}))
    unknown = plugin._handle_request("unknown", object(), {})

    assert status["generation"] == 5
    assert polar_first == polar_second
    assert polar_first["status"] == "OK"
    assert polar_inline["status"] == "ERROR"
    assert polar_mixed["status"] == "ERROR"
    assert "does not accept inline" in str(polar_inline["error"])
    assert cast("dict[str, object]", rejections["per_bin"])["90_12"] == {"reject_unstable": 1}
    assert timeline["buckets"]
    assert invalid_timeline["status"] == "ERROR"
    assert config["percentile"] == 65
    assert backup["bins"]
    assert unknown["status"] == "ERROR"


def _assert_export_routes(plugin: plugin_module.Plugin) -> None:
    windy_csv = _csv(plugin._handle_request("export", object(), {"format": ["windy"]}))
    save = plugin._handle_request(
        "presets/save",
        object(),
        {"name": ["route preset"], "twa": ["90"], "tws": ["12"]},
    )
    preset_csv = _csv(plugin._handle_request("export", object(), {"format": ["route preset"]}))
    inline_csv = _csv(plugin._handle_request("export", object(), {"twa": ["90"], "tws": ["12"]}))
    repeat_csv = _csv(plugin._handle_request("export", object(), {"twa": ["90"], "tws": ["12"]}))
    high_csv = _csv(
        plugin._handle_request(
            "export",
            object(),
            {"twa": ["90"], "tws": ["12"], "high_confidence": ["yes"]},
        )
    )
    mixed = plugin._handle_request(
        "export",
        object(),
        {"format": ["windy"], "twa": ["90"], "tws": ["12"]},
    )
    one_sided = plugin._handle_request("export", object(), {"twa": ["90"]})
    presets = response_data(plugin._handle_request("presets", object(), {}))
    delete_windy = plugin._handle_request(
        "presets/delete",
        object(),
        {"name": ["windy"], "confirm": ["yes"]},
    )
    delete_preset = plugin._handle_request(
        "presets/delete",
        object(),
        {"name": ["route preset"], "confirm": ["yes"]},
    )

    assert windy_csv.startswith("TWA\\TWS;4;6;8;10;12")
    assert "6.0" in windy_csv
    assert save["status"] == "OK"
    assert preset_csv == "TWA\\TWS;12\r\n90;6.0\r\n"
    assert inline_csv == repeat_csv == preset_csv
    assert high_csv == "TWA\\TWS;12\r\n90;\r\n"
    assert mixed["status"] == "ERROR"
    assert one_sided["status"] == "ERROR"
    assert "route preset" in [preset["name"] for preset in _preset_items(presets)]
    assert delete_windy["status"] == "ERROR"
    assert delete_preset["status"] == "OK"


def _assert_mutation_routes(plugin: plugin_module.Plugin) -> None:
    reset_denied = plugin._handle_request("reset", object(), {})
    pause = plugin._handle_request("pause", object(), {})
    resume = plugin._handle_request("resume", object(), {})
    reset = plugin._handle_request("reset", object(), {"confirm": ["yes"]})
    backup = response_data(plugin._handle_request("export/json", object(), {}))

    assert reset_denied["status"] == "ERROR"
    assert pause == {"status": "OK", "data": {"recording": False}}
    assert resume == {"status": "OK", "data": {"recording": True}}
    assert reset["status"] == "OK"
    assert plugin._model.snapshot_bins() == {}
    assert plugin._counters.total_seen == 0
    assert plugin._flush_requested is True
    assert backup["bins"] == {}


def _csv(response: dict[str, object]) -> str:
    data = response_data(response)
    csv = data["csv"]
    assert isinstance(csv, str)
    return csv


def _preset_items(data: dict[str, object]) -> list[dict[str, object]]:
    return cast("list[dict[str, object]]", data["presets"])
