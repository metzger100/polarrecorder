from __future__ import annotations

import math
from typing import TYPE_CHECKING, cast

from conftest import FakeClock, FakeDataEntry, FakeLogger
from polarrecorder.config import default_config, parse_config_values
from polarrecorder.reader import STW_KEY, TWA_KEY, TWS_KEY, StoreReader, _coerce_float, read_store
from polarrecorder.sample import build_sample
from polarrecorder.validation import pipeline
from polarrecorder.validation.state import ValidationState

if TYPE_CHECKING:
    from polarrecorder.reader import DataEntryLike


class FakeStoreAPI:
    def __init__(self) -> None:
        self.entries: dict[str, FakeDataEntry] = {}
        self.calls: list[tuple[str, bool]] = []

    def set_entry(self, key: str, value: float, timestamp: float) -> None:
        self.entries[key] = FakeDataEntry(value, timestamp)

    def getSingleValue(self, key: str, includeInfo: bool = False) -> DataEntryLike | None:
        self.calls.append((key, includeInfo))
        return self.entries.get(key)


def test_reader_extracts_values_timestamps_and_uses_include_info() -> None:
    clock = FakeClock(100.0)
    wall_clock = FakeClock(1000.0)
    api = FakeStoreAPI()
    api.set_entry(TWA_KEY, 90.0, 99.5)
    api.set_entry(TWS_KEY, 6.0, 99.0)
    api.set_entry(STW_KEY, 3.0, 98.5)

    read_result = StoreReader(api, clock, wall_clock).read()

    assert read_result.timestamp_monotonic == 100.0
    assert read_result.timestamp_wall == 1000.0
    assert read_result.twa_raw == 90.0
    assert read_result.tws_raw == 6.0
    assert read_result.stw_raw == 3.0
    assert read_result.twa_timestamp == 99.5
    assert read_result.tws_timestamp == 99.0
    assert read_result.stw_timestamp == 98.5
    assert api.calls == [(TWA_KEY, True), (TWS_KEY, True), (STW_KEY, True)]


def test_reader_maps_missing_or_expired_entries_to_none() -> None:
    api = FakeStoreAPI()
    api.set_entry(TWA_KEY, 90.0, 99.5)

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0)).read()

    assert read_result.twa_raw == 90.0
    assert read_result.tws_raw is None
    assert read_result.stw_raw is None
    assert read_result.twa_timestamp == 99.5
    assert read_result.tws_timestamp is None
    assert read_result.stw_timestamp is None


def test_reader_accepts_optional_logger_hook() -> None:
    api = FakeStoreAPI()
    logger = FakeLogger()

    read_result = read_store(api, FakeClock(100.0), FakeClock(1000.0), logger)

    assert read_result.timestamp_monotonic == 100.0
    assert logger.messages == []


def test_reader_timestamps_drive_freshness_and_stale_rejection() -> None:
    api = FakeStoreAPI()
    api.set_entry(TWA_KEY, 90.0, 95.0)
    api.set_entry(TWS_KEY, 6.0, 95.0)
    api.set_entry(STW_KEY, 3.0, 95.0)
    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0)).read()

    sample = build_sample(read_result)
    pipeline_result, pipeline_sample = pipeline.run(
        read_result,
        ValidationState(),
        default_config(),
    )

    assert sample is not None
    assert sample.freshness.max_age_s == 5.0
    assert pipeline_sample is not None
    assert pipeline_result.decision == "rejected"
    assert pipeline_result.reason_codes == [
        "reject_stale_twa",
        "reject_stale_tws",
        "reject_stale_stw",
    ]


def _set_core(api: FakeStoreAPI, timestamp: float = 99.5) -> None:
    api.set_entry(TWA_KEY, 90.0, timestamp)
    api.set_entry(TWS_KEY, 6.0, timestamp)
    api.set_entry(STW_KEY, 3.0, timestamp)


def test_reader_without_config_omits_enhanced_signals() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", 5.0, 99.5)

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0)).read()

    assert read_result.enhanced_raw is None
    sample = build_sample(read_result)
    assert sample is not None
    assert sample.enhanced is None


def test_reader_populates_enhanced_from_configured_fresh_keys() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", 5.0, 99.5)
    api.set_entry("gps.depthBelowKeel", 3.0, 99.5)
    api.set_entry("gps.windAngle", 30.0, 99.5)
    api.set_entry("gps.windSpeed", 4.0, 99.5)
    api.set_entry("gps.currentDrift", 0.5, 99.5)
    api.set_entry("gps.headingTrue", 100.0, 99.5)
    api.set_entry("gps.track", 105.0, 99.5)

    read_result = StoreReader(
        api, FakeClock(100.0), FakeClock(1000.0), config=default_config()
    ).read()
    sample = build_sample(read_result)

    assert sample is not None
    enhanced = sample.enhanced
    assert enhanced is not None
    assert math.isclose(enhanced["sog_kt"], 5.0 * 1.94384)
    assert math.isclose(enhanced["aws_kt"], 4.0 * 1.94384)
    assert math.isclose(enhanced["current_drift_kt"], 0.5 * 1.94384)
    assert enhanced["depth_m"] == 3.0
    assert enhanced["awa_deg"] == 30.0
    assert enhanced["heading_deg"] == 100.0
    assert enhanced["cog_deg"] == 105.0
    assert "rpm" not in enhanced
    assert "engine_signal" not in enhanced
    assert "heel_deg" not in enhanced


def test_reader_omits_disabled_unconfigured_missing_and_stale_signals() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", 5.0, 99.5)
    api.set_entry("gps.currentDrift", 0.5, 99.5)
    api.set_entry("gps.depthBelowKeel", 3.0, 90.0)
    api.set_entry("gps.windAngle", 30.0, 99.5)
    api.set_entry("n2k.rpm", 800.0, 99.5)
    config = parse_config_values({"enh_slip_enabled": "false", "enh_rpm_key": "n2k.rpm"})

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=config).read()
    sample = build_sample(read_result)

    assert sample is not None
    enhanced = sample.enhanced
    assert enhanced is not None
    assert "sog_kt" not in enhanced
    assert "current_drift_kt" not in enhanced
    assert "depth_m" not in enhanced
    assert "aws_kt" not in enhanced
    assert "heading_deg" not in enhanced
    assert enhanced["rpm"] == 800.0
    assert enhanced["awa_deg"] == 30.0


def test_reader_current_drift_follows_slip_enable() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", 5.0, 99.5)
    api.set_entry("gps.currentDrift", 0.5, 99.5)

    on_sample = build_sample(
        StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=default_config()).read()
    )
    off_config = parse_config_values({"enh_slip_enabled": "false"})
    off_sample = build_sample(
        StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=off_config).read()
    )

    assert on_sample is not None
    assert on_sample.enhanced is not None
    assert "current_drift_kt" in on_sample.enhanced
    assert off_sample is not None
    assert off_sample.enhanced is None


def test_reader_engine_state_coerces_bool_rpm_and_voltage() -> None:
    config = parse_config_values({"enh_engine_state_key": "engine.state"})
    for raw, expected in ((True, 1.0), (50, 50.0), (13.2, 13.2)):
        api = FakeStoreAPI()
        _set_core(api)
        api.set_entry("engine.state", cast("float", raw), 99.5)
        sample = build_sample(
            StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=config).read()
        )
        assert sample is not None
        assert sample.enhanced is not None
        assert sample.enhanced["engine_signal"] == expected


def test_reader_omits_non_numeric_string_signal_and_debug_logs() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("engine.state", cast("float", "off"), 99.5)
    config = parse_config_values({"enh_engine_state_key": "engine.state"})
    logger = FakeLogger()

    sample = build_sample(
        StoreReader(api, FakeClock(100.0), FakeClock(1000.0), logger, config).read()
    )

    assert sample is not None
    assert sample.enhanced is None
    assert any(level == "debug" for level, _ in logger.messages)


def test_coerce_float_handles_bool_number_string_and_non_numeric() -> None:
    true_value: object = True
    false_value: object = False
    assert _coerce_float(true_value) == 1.0
    assert _coerce_float(false_value) == 0.0
    assert _coerce_float(50) == 50.0
    assert _coerce_float(13.2) == 13.2
    assert _coerce_float("47.5") == 47.5
    assert _coerce_float(" 12 ") == 12.0
    assert _coerce_float("off") is None
    assert _coerce_float(None) is None
    assert _coerce_float(math.nan) is None
    assert _coerce_float(math.inf) is None
