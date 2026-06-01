from __future__ import annotations

import math
from typing import TYPE_CHECKING, cast

from conftest import FakeAvNavAPI
from polarrecorder import api_handlers, export
from polarrecorder.config import default_config
from polarrecorder.sample import ReadResult, build_sample
from polarrecorder.units import knots_to_meters_per_second

import plugin as plugin_module

if TYPE_CHECKING:
    from pathlib import Path


def test_format_status_includes_counters_top_rejections_and_stale_flags() -> None:
    snapshot = api_handlers.StatusSnapshot(
        record_enabled=True,
        recording=True,
        data_status="receiving",
        warming_up=False,
        uptime_seconds=12.0,
        current_values=api_handlers.CurrentValuesSnapshot(90.0, 12.0, 6.0, 9.0, 5.0, 7.0),
        current_decision={"state": "accepted", "reason_codes": []},
        counters={
            "total_seen": 4,
            "total_accepted": 3,
            "total_rejected": 1,
            "total_quarantined": 0,
        },
        top_rejections=[{"reason": "reject_low_wind", "count": 2}],
        last_flush_wall=1000.0,
        file_size_bytes=123,
        bins_with_data=2,
        bins_total=21960,
        generation=5,
        now_monotonic=10.0,
        stale_threshold=3.0,
    )

    data = _data(api_handlers.format_status(snapshot))
    values = cast("dict[str, object]", data["current_values"])

    assert data["recording"] is True
    assert cast("dict[str, object]", data["counters"])["acceptance_rate"] == 0.75
    assert data["top_rejections"] == [{"reason": "reject_low_wind", "count": 2}]
    assert values["twa_age_s"] == 1.0
    assert values["tws_stale"] is True
    assert values["stw_stale"] is False


def test_format_status_nulls_before_first_values_and_decision() -> None:
    snapshot = api_handlers.StatusSnapshot(
        record_enabled=True,
        recording=False,
        data_status="no_data",
        warming_up=True,
        uptime_seconds=0.0,
        current_values=None,
        current_decision=None,
        counters={
            "total_seen": 0,
            "total_accepted": 0,
            "total_rejected": 0,
            "total_quarantined": 0,
        },
        top_rejections=[],
        last_flush_wall=0.0,
        file_size_bytes=0,
        bins_with_data=0,
        bins_total=21960,
        generation=0,
        now_monotonic=1.0,
        stale_threshold=3.0,
    )

    data = _data(api_handlers.format_status(snapshot))

    assert data["current_values"] is None
    assert data["current_decision"] is None
    assert cast("dict[str, object]", data["counters"])["acceptance_rate"] == 0.0


def test_format_polar_and_export_reuse_projection() -> None:
    bins = {(90, 12): {"histogram": {60: 3}}}

    polar = _data(api_handlers.format_polar(bins, [12], 65, 7, "windy"))
    export_response = _data(api_handlers.format_export(bins, [90], [12], 65, 3))
    curves = cast("dict[str, list[dict[str, object] | None]]", polar["curves"])

    assert polar["tws_bands"] == [12]
    assert curves["12"][90] == {"stw": 6.0, "samples": 3}
    assert export_response["csv"] == "TWA\\TWS;12\r\n90;6.0\r\n"


def test_other_read_formatters_wrap_detached_data() -> None:
    config = default_config()
    preset = export.Preset("mine", builtin=False, twa=[0, 90], tws=[4, 8])

    rejections = _data(
        api_handlers.format_rejections(
            {"reject_low_wind": 2},
            {(90, 12): {"reject_unstable": 1}},
        )
    )
    timeline = _data(api_handlers.format_timeline([{"t": 60.0, "accepted": 1}]))
    config_data = _data(api_handlers.format_config(config))
    presets = _data(api_handlers.format_presets([export.builtin_preset(), preset]))
    backup = _data(api_handlers.export_json({"schema_version": 1}))

    assert rejections["per_bin"] == {"90_12": {"reject_unstable": 1}}
    assert timeline == {"buckets": [{"t": 60.0, "accepted": 1}]}
    assert config_data["percentile"] == 65
    preset_items = cast("list[dict[str, object]]", presets["presets"])
    assert preset_items[1]["name"] == "mine"
    assert backup == {"schema_version": 1}


def test_invalid_percentile_returns_error_envelope_through_dispatch(tmp_path: Path) -> None:
    plugin = plugin_module.Plugin(FakeAvNavAPI())
    plugin._data_dir = str(tmp_path)

    response = plugin._handle_request("polar", object(), {"percentile": ["abc"]})

    assert response["status"] == "ERROR"
    assert "percentile" in str(response["error"])


def test_non_finite_read_keeps_status_current_values_frozen(tmp_path: Path) -> None:
    plugin = plugin_module.Plugin(FakeAvNavAPI())
    plugin._data_dir = str(tmp_path)
    finite = _read_result(100.0, 90.0, 12.0, 6.0)
    plugin._write_status_scalars(finite, build_sample(finite), "receiving", warming_up=False)
    non_finite = _read_result(101.0, math.nan, 12.0, 7.0)

    plugin._write_status_scalars(
        non_finite,
        build_sample(non_finite),
        "receiving",
        warming_up=False,
    )
    response = plugin._handle_request("status", object(), {})
    values = cast("dict[str, object]", _data(response)["current_values"])

    assert values["twa_deg"] == 90.0
    assert values["stw_kt"] == 6.0
    for key in ("twa_deg", "tws_kt", "stw_kt"):
        value = values[key]
        assert isinstance(value, (float, int))
        assert math.isfinite(float(value))


def _read_result(timestamp: float, twa: float, tws_kt: float, stw_kt: float) -> ReadResult:
    return ReadResult(
        timestamp_monotonic=timestamp,
        timestamp_wall=1000.0,
        twa_raw=twa,
        tws_raw=knots_to_meters_per_second(tws_kt),
        stw_raw=knots_to_meters_per_second(stw_kt),
        twa_timestamp=timestamp,
        tws_timestamp=timestamp,
        stw_timestamp=timestamp,
    )


def _data(response: dict[str, object]) -> dict[str, object]:
    assert response["status"] == "OK"
    return cast("dict[str, object]", response["data"])
