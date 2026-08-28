from __future__ import annotations

import math
from typing import TYPE_CHECKING, cast

from conftest import FakeClock, FakeDataEntry, FakeLogger
from polarrecorder.config import default_config, parse_config_values
from polarrecorder.reader import STW_KEY, TWA_KEY, TWS_KEY, StoreReader, _coerce_float, read_store
from polarrecorder.sample import build_sample
from polarrecorder.source_params import HEEL_KEY_DEFAULT
from polarrecorder.validation import pipeline
from polarrecorder.validation.state import ValidationState

if TYPE_CHECKING:
    from polarrecorder.reader import DataEntryLike


class FakeStoreAPI:
    def __init__(self) -> None:
        self.entries: dict[str, FakeDataEntry] = {}
        self.calls: list[tuple[str, bool]] = []

    def set_entry(self, key: str, value: object, timestamp: float) -> None:
        self.entries[key] = FakeDataEntry(value, timestamp)

    def get_single_value(self, key: str, include_info: bool = False) -> DataEntryLike | None:
        self.calls.append((key, include_info))
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


def test_reader_uses_configured_core_source_keys() -> None:
    api = FakeStoreAPI()
    config = parse_config_values(
        {
            "twa_key": "custom.twa",
            "tws_key": "custom.tws",
            "stw_key": "custom.stw",
        }
    )
    api.set_entry("custom.twa", 75.0, 99.5)
    api.set_entry("custom.tws", 7.0, 99.4)
    api.set_entry("custom.stw", 4.0, 99.3)

    read_result = StoreReader(
        api,
        FakeClock(100.0),
        FakeClock(1000.0),
        config=config,
    ).read()

    assert read_result.twa_raw == 75.0
    assert read_result.tws_raw == 7.0
    assert read_result.stw_raw == 4.0
    assert api.calls[:3] == [
        ("custom.twa", True),
        ("custom.tws", True),
        ("custom.stw", True),
    ]


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
    assert pipeline_result.reason_codes == (
        "reject_stale_twa",
        "reject_stale_tws",
        "reject_stale_stw",
    )


def _set_core(api: FakeStoreAPI, timestamp: float = 99.5) -> None:
    api.set_entry(TWA_KEY, 90.0, timestamp)
    api.set_entry(TWS_KEY, 6.0, timestamp)
    api.set_entry(STW_KEY, 3.0, timestamp)


def test_reader_without_config_omits_enhanced_signals() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", 5.0, 99.5)

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0)).read()

    assert read_result.enhanced_values is None
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
    assert "heel_deg" not in enhanced


def test_reader_converts_default_heel_key_from_radians_to_degrees() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry(HEEL_KEY_DEFAULT, math.radians(18.0), 99.5)

    read_result = StoreReader(
        api, FakeClock(100.0), FakeClock(1000.0), config=default_config()
    ).read()
    sample = build_sample(read_result)

    assert sample is not None
    assert sample.enhanced is not None
    assert math.isclose(sample.enhanced["heel_deg"], 18.0)


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
    assert "sog_kt" in enhanced
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
    assert off_sample.enhanced == {"sog_kt": 5.0 * 1.94384}


def test_r10_receives_fresh_sog_when_r20_is_disabled() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry(STW_KEY, 0.1, 99.5)
    api.set_entry("gps.speed", 2.0, 99.5)
    config = parse_config_values({"enh_slip_enabled": "false"})

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=config).read()
    result, sample = pipeline.run(read_result, ValidationState(), config)

    assert sample is not None
    assert sample.enhanced == {"sog_kt": 2.0 * 1.94384}
    assert "reject_anchored" not in result.reason_codes


def test_reader_omits_non_numeric_string_signal_and_debug_logs() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("engine.rpm", cast("float", "off"), 99.5)
    config = parse_config_values({"enh_rpm_key": "engine.rpm"})
    logger = FakeLogger()

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), logger, config).read()
    sample = build_sample(read_result)

    assert sample is not None
    assert sample.enhanced is None
    assert read_result.enhanced_inputs is not None
    assert read_result.enhanced_inputs["rpm"].state == "invalid"
    assert logger.messages == [
        (
            "debug",
            "enhanced signal rpm key 'engine.rpm' has invalid value; omitting",
        )
    ]


def test_reader_logs_invalid_timestamp_cause_without_blame_on_numeric_value() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("engine.rpm", 1200.0, math.nan)
    config = parse_config_values({"enh_rpm_key": "engine.rpm"})
    logger = FakeLogger()

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), logger, config).read()

    assert read_result.enhanced_inputs is not None
    assert read_result.enhanced_inputs["rpm"].invalid_cause == "timestamp"
    assert logger.messages == [
        (
            "debug",
            "enhanced signal rpm key 'engine.rpm' has invalid timestamp; omitting",
        )
    ]


def test_reader_retains_missing_stale_and_usable_acquisition_states() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", cast("float", "2.5"), 99.5)
    api.set_entry("gps.depthBelowKeel", 3.0, 90.0)

    read_result = StoreReader(
        api,
        FakeClock(100.0),
        FakeClock(1000.0),
        config=default_config(),
    ).read()

    assert read_result.enhanced_inputs is not None
    assert read_result.enhanced_inputs["sog_kt"].state == "usable"
    assert read_result.enhanced_inputs["sog_kt"].numeric_value == 2.5 * 1.94384
    assert read_result.enhanced_inputs["depth_m"].state == "stale"
    assert read_result.enhanced_inputs["awa_deg"].state == "missing"


def test_coerce_float_rejects_booleans_and_is_total() -> None:
    true_value: object = True
    false_value: object = False
    assert _coerce_float(true_value) is None
    assert _coerce_float(false_value) is None
    assert _coerce_float(50) == 50.0
    assert _coerce_float(13.2) == 13.2
    assert _coerce_float("47.5") == 47.5
    assert _coerce_float(" 12 ") == 12.0
    assert _coerce_float("off") is None
    assert _coerce_float(None) is None
    assert _coerce_float(math.nan) is None
    assert _coerce_float(math.inf) is None
    assert _coerce_float(10**10_000) is None


def test_reader_rejects_boolean_enhanced_signals() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    physical_bool: object = True
    api.set_entry("gps.depthBelowKeel", physical_bool, 99.5)
    api.set_entry("engine.rpm", physical_bool, 99.5)
    config = parse_config_values({"enh_rpm_key": "engine.rpm"})

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=config).read()

    assert read_result.enhanced_inputs is not None
    assert read_result.enhanced_inputs["depth_m"].state == "invalid"
    assert read_result.enhanced_inputs["rpm"].state == "invalid"


def test_reader_rejects_negative_unsigned_enhanced_signals() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    keys = {
        "rpm": "engine.rpm",
        "depth_m": "gps.depthBelowKeel",
        "sog_kt": "gps.speed",
        "current_drift_kt": "gps.currentDrift",
        "aws_kt": "gps.windSpeed",
    }
    for key in keys.values():
        api.set_entry(key, -1.0, 99.5)
    api.set_entry("gps.windAngle", -30.0, 99.5)
    api.set_entry("heel.angle", math.radians(-12.0), 99.5)
    config = parse_config_values(
        {
            "enh_rpm_key": "engine.rpm",
            "enh_heel_key": "heel.angle",
        }
    )

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=config).read()

    assert read_result.enhanced_inputs is not None
    for role in keys:
        acquisition = read_result.enhanced_inputs[role]
        assert acquisition.state == "invalid"
        assert acquisition.invalid_cause == "range"
    assert read_result.enhanced_inputs["awa_deg"].state == "usable"
    assert read_result.enhanced_inputs["heel_deg"].state == "usable"
    assert read_result.enhanced_values is not None
    assert read_result.enhanced_values["awa_deg"] == (-30.0, 99.5)
    heel_value, heel_timestamp = read_result.enhanced_values["heel_deg"]
    assert math.isclose(heel_value, -12.0)
    assert heel_timestamp == 99.5


def test_reader_rejects_values_that_overflow_during_unit_normalization() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", 1e308, 99.5)
    api.set_entry("gps.currentDrift", 1e308, 99.5)

    read_result = StoreReader(
        api, FakeClock(100.0), FakeClock(1000.0), config=default_config()
    ).read()

    assert read_result.enhanced_inputs is not None
    assert read_result.enhanced_inputs["sog_kt"].state == "invalid"
    assert read_result.enhanced_inputs["current_drift_kt"].state == "invalid"
    assert read_result.enhanced_values is None or "sog_kt" not in read_result.enhanced_values
    assert (
        read_result.enhanced_values is None or "current_drift_kt" not in read_result.enhanced_values
    )


def test_reader_rejects_finite_value_above_canonical_role_ceiling() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry("gps.speed", 60.0, 99.5)

    read_result = StoreReader(
        api, FakeClock(100.0), FakeClock(1000.0), config=default_config()
    ).read()

    assert read_result.enhanced_inputs is not None
    acquisition = read_result.enhanced_inputs["sog_kt"]
    assert acquisition.state == "invalid"
    assert acquisition.invalid_cause == "range"


def test_overflowing_sog_cannot_bypass_anchored_rejection() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry(STW_KEY, 0.2 / 1.94384, 99.5)
    api.set_entry("gps.speed", 1e308, 99.5)
    config = default_config()

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=config).read()
    result, sample = pipeline.run(read_result, ValidationState(), config)

    assert sample is not None
    assert sample.enhanced is None
    assert result.reason_codes == ("reject_anchored",)


def test_invalid_current_drift_cannot_explain_sog_stw_mismatch() -> None:
    api = FakeStoreAPI()
    _set_core(api)
    api.set_entry(STW_KEY, 1.0 / 1.94384, 99.5)
    api.set_entry("gps.speed", 5.0 / 1.94384, 99.5)
    api.set_entry("gps.currentDrift", 1e308, 99.5)
    config = default_config()
    state = ValidationState()
    for timestamp in range(85, 100):
        sample = build_sample(
            StoreReader(api, FakeClock(float(timestamp)), FakeClock(1000.0), config=config).read()
        )
        assert sample is not None
        state.observe(sample, window_seconds=config.stability_window_seconds)

    read_result = StoreReader(api, FakeClock(100.0), FakeClock(1000.0), config=config).read()
    result, sample = pipeline.run(read_result, state, config)

    assert sample is not None
    assert "current_drift_kt" in sample.invalid_enhanced_roles
    assert result.reason_codes == ("reject_sog_stw_mismatch",)
