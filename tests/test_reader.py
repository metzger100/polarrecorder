from __future__ import annotations

from typing import TYPE_CHECKING

from conftest import FakeClock, FakeDataEntry, FakeLogger

from polarrecorder.config import default_config
from polarrecorder.reader import STW_KEY, TWA_KEY, TWS_KEY, StoreReader, read_store
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
