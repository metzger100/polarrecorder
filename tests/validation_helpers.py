from __future__ import annotations

from polarrecorder.sample import ReadResult, Sample, build_sample
from polarrecorder.units import knots_to_meters_per_second
from polarrecorder.validation.state import ValidationState


def make_read_result(
    twa_raw: float | None = 90.0,
    tws_kt: float | None = 12.0,
    stw_kt: float | None = 6.0,
    now: float = 100.0,
    ages: tuple[float, float, float] = (0.5, 0.5, 0.5),
    enhanced_raw: dict[str, tuple[float, float]] | None = None,
) -> ReadResult:
    tws_raw = None if tws_kt is None else knots_to_meters_per_second(tws_kt)
    stw_raw = None if stw_kt is None else knots_to_meters_per_second(stw_kt)
    return ReadResult(
        timestamp_monotonic=now,
        timestamp_wall=now + 900.0,
        twa_raw=twa_raw,
        tws_raw=tws_raw,
        stw_raw=stw_raw,
        twa_timestamp=None if twa_raw is None else now - ages[0],
        tws_timestamp=None if tws_raw is None else now - ages[1],
        stw_timestamp=None if stw_raw is None else now - ages[2],
        enhanced_raw=enhanced_raw,
    )


def make_sample(
    twa_raw: float = 90.0,
    tws_kt: float = 12.0,
    stw_kt: float = 6.0,
    now: float = 100.0,
    ages: tuple[float, float, float] = (0.5, 0.5, 0.5),
) -> Sample:
    sample = build_sample(
        make_read_result(
            twa_raw=twa_raw,
            tws_kt=tws_kt,
            stw_kt=stw_kt,
            now=now,
            ages=ages,
        )
    )
    assert sample is not None
    return sample


def make_warmed_state(
    now: float = 100.0,
    twa_values: tuple[float, ...] = (90.0, 90.0, 90.0),
    tws_values: tuple[float, ...] = (12.0, 12.0, 12.0),
    stw_values: tuple[float, ...] = (6.0, 6.0, 6.0),
) -> ValidationState:
    state = ValidationState(stability_window_seconds=15.0)
    timestamps = (now - 15.0, now - 10.0, now - 5.0)
    for index, timestamp in enumerate(timestamps):
        state.observe(
            make_sample(
                twa_raw=twa_values[index],
                tws_kt=tws_values[index],
                stw_kt=stw_values[index],
                now=timestamp,
            )
        )
    return state
