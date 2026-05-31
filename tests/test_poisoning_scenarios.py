from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING

from conftest import drive_read_results

from polarrecorder import histogram
from polarrecorder.config import default_config
from polarrecorder.polar_model import PolarModel
from polarrecorder.sample import ReadResult
from polarrecorder.units import knots_to_meters_per_second
from polarrecorder.validation.state import ValidationState

if TYPE_CHECKING:
    from polarrecorder.sample import Sample
    from polarrecorder.validation.pipeline import PipelineResult

POLAR_BIN = (90, 12)
MANEUVER_PORT_BIN = (60, 12)
MANEUVER_STARBOARD_BIN = (120, 12)
WARMUP_SECONDS = 15


def test_1000_valid_samples_learn_expected_p65() -> None:
    valid_speeds = _valid_distribution()
    results, model = _drive(_warmup_reads() + _speed_reads(valid_speeds, start=WARMUP_SECONDS))

    assert _decision_count(results, "accepted") == 1000
    assert _reason_count(results, "reject_warming_up") == WARMUP_SECONDS
    assert model.query(65)[POLAR_BIN] == _expected_percentile(valid_speeds)


def test_slow_samples_do_not_significantly_drag_down_p65() -> None:
    valid_speeds = _valid_distribution()
    slow_speeds = [4.5 for _ in range(200)]
    baseline_results, baseline_model = _drive(
        _warmup_reads() + _speed_reads(valid_speeds, start=WARMUP_SECONDS)
    )
    poisoned_results, poisoned_model = _drive(
        _warmup_reads() + _speed_reads(valid_speeds + slow_speeds, start=WARMUP_SECONDS)
    )

    assert _decision_count(baseline_results, "accepted") == 1000
    assert _decision_count(poisoned_results, "accepted") >= 1190
    assert abs(poisoned_model.query(65)[POLAR_BIN] - baseline_model.query(65)[POLAR_BIN]) <= 0.2


def test_anchored_zero_stw_burst_is_rejected_and_polar_unchanged() -> None:
    state = ValidationState()
    config = default_config()
    model = PolarModel()
    drive_read_results(
        _warmup_reads() + _speed_reads([6.0 for _ in range(20)], WARMUP_SECONDS),
        state,
        config,
        model,
    )
    before = model.snapshot_bins()

    results = drive_read_results(_speed_reads([0.0 for _ in range(10)], 35), state, config, model)

    assert _reason_count(results, "reject_anchored") == 10
    assert model.snapshot_bins() == before


def test_sensor_spikes_are_rejected_and_polar_unchanged() -> None:
    state = ValidationState()
    config = default_config()
    model = PolarModel()
    drive_read_results(
        _warmup_reads() + _speed_reads([6.0 for _ in range(20)], WARMUP_SECONDS),
        state,
        config,
        model,
    )
    before_histogram = dict(model.bins[POLAR_BIN].histogram)
    before_p65 = model.query(65)[POLAR_BIN]

    spike_speeds = [12.0, 6.0, 12.0, 6.0, 12.0, 6.0]
    results = drive_read_results(_speed_reads(spike_speeds, 35), state, config, model)

    assert _reason_count(results, "reject_stw_roc") == len(spike_speeds)
    assert model.bins[POLAR_BIN].histogram == before_histogram
    assert model.query(65)[POLAR_BIN] == before_p65
    assert model.bins[POLAR_BIN].total_rejected == len(spike_speeds)


def test_gradual_instrument_drift_is_absorbed_without_catastrophic_shift() -> None:
    baseline = [6.0 for _ in range(100)]
    drift = [6.0 + (0.9 * index / 299.0) for index in range(300)]
    baseline_results, baseline_model = _drive(
        _warmup_reads() + _speed_reads(baseline, start=WARMUP_SECONDS)
    )
    drift_results, drift_model = _drive(
        _warmup_reads() + _speed_reads(baseline + drift, start=WARMUP_SECONDS)
    )

    assert _decision_count(baseline_results, "accepted") == len(baseline)
    assert _decision_count(drift_results, "accepted") == len(baseline) + len(drift)
    assert _reason_count(drift_results, "reject_stw_roc") == 0
    assert drift_model.query(65)[POLAR_BIN] - baseline_model.query(65)[POLAR_BIN] <= 0.5


def test_only_low_wind_samples_populate_no_bins() -> None:
    results, model = _drive(
        [_read_result(float(index), tws_kt=2.0, stw_kt=1.0) for index in range(40)]
    )

    assert _reason_count(results, "reject_low_wind") == 40
    assert model.bins == {}


def test_maneuver_rich_sequence_learns_only_stable_between_tack_segments() -> None:
    reads: list[ReadResult] = []
    timestamp = 0.0
    for segment_index, twa in enumerate((60.0, 120.0, 60.0, 120.0)):
        for _ in range(45):
            reads.append(
                _read_result(timestamp, twa_deg=twa, stw_kt=6.0 + 0.1 * (segment_index % 2))
            )
            timestamp += 1.0

    results, model = _drive(reads)

    assert _reason_count(results, "reject_twa_roc") == 3
    assert _reason_count(results, "reject_maneuver_cooldown") == 87
    assert _reason_count(results, "reject_warming_up") == WARMUP_SECONDS
    assert _decision_count(results, "accepted") == 75
    assert model.bins[MANEUVER_PORT_BIN].total_accepted == 45
    assert model.bins[MANEUVER_STARBOARD_BIN].total_accepted == 30


def _drive(
    reads: list[ReadResult],
) -> tuple[list[tuple[PipelineResult, Sample | None]], PolarModel]:
    state = ValidationState()
    config = default_config()
    model = PolarModel()
    return drive_read_results(reads, state, config, model), model


def _warmup_reads() -> list[ReadResult]:
    return [_read_result(float(index)) for index in range(WARMUP_SECONDS)]


def _speed_reads(
    speeds: list[float],
    start: int,
    twa_deg: float = 90.0,
    tws_kt: float = 12.0,
) -> list[ReadResult]:
    return [
        _read_result(float(start + index), twa_deg=twa_deg, tws_kt=tws_kt, stw_kt=speed)
        for index, speed in enumerate(speeds)
    ]


def _read_result(
    timestamp: float,
    twa_deg: float = 90.0,
    tws_kt: float = 12.0,
    stw_kt: float = 6.0,
    age_s: float = 0.1,
) -> ReadResult:
    return ReadResult(
        timestamp_monotonic=timestamp,
        timestamp_wall=1000.0 + timestamp,
        twa_raw=twa_deg,
        tws_raw=knots_to_meters_per_second(tws_kt),
        stw_raw=knots_to_meters_per_second(stw_kt),
        twa_timestamp=timestamp - age_s,
        tws_timestamp=timestamp - age_s,
        stw_timestamp=timestamp - age_s,
    )


def _valid_distribution() -> list[float]:
    return [5.8 + 0.1 * (index % 10) for index in range(1000)]


def _expected_percentile(speeds: list[float]) -> float:
    speed_histogram: dict[int, int] = {}
    for speed in speeds:
        key = histogram.speed_key(speed)
        speed_histogram[key] = speed_histogram.get(key, 0) + 1
    value = histogram.percentile(speed_histogram, 65)
    assert value is not None
    return value


def _decision_count(results: list[tuple[PipelineResult, Sample | None]], decision: str) -> int:
    return sum(1 for pipeline_result, _ in results if pipeline_result.decision == decision)


def _reason_count(results: list[tuple[PipelineResult, Sample | None]], reason_code: str) -> int:
    counter: Counter[str] = Counter()
    for pipeline_result, _ in results:
        counter.update(pipeline_result.reason_codes)
    return counter[reason_code]
