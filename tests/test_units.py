from __future__ import annotations

import math

from hypothesis import given
from hypothesis import strategies as st
from polarrecorder.units import (
    MPS_TO_KNOTS,
    knots_to_meters_per_second,
    meters_per_second_to_knots,
)

_ROUND_TRIP_RELATIVE_TOLERANCE = 1e-9
_SPEED = st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False)


def test_meters_per_second_to_knots_uses_plan_constant() -> None:
    assert MPS_TO_KNOTS == 1.94384
    assert meters_per_second_to_knots(1.0) == 1.94384


def test_knots_round_trip_to_meters_per_second() -> None:
    speed_ms = knots_to_meters_per_second(meters_per_second_to_knots(2.5))

    assert math.isclose(speed_ms, 2.5)


@given(speed_ms=_SPEED)
def test_meters_per_second_round_trips_through_knots(speed_ms: float) -> None:
    round_tripped = knots_to_meters_per_second(meters_per_second_to_knots(speed_ms))

    assert math.isclose(
        round_tripped,
        speed_ms,
        rel_tol=_ROUND_TRIP_RELATIVE_TOLERANCE,
        abs_tol=_ROUND_TRIP_RELATIVE_TOLERANCE,
    )


@given(speed_kt=_SPEED)
def test_knots_round_trips_through_meters_per_second(speed_kt: float) -> None:
    round_tripped = meters_per_second_to_knots(knots_to_meters_per_second(speed_kt))

    assert math.isclose(
        round_tripped,
        speed_kt,
        rel_tol=_ROUND_TRIP_RELATIVE_TOLERANCE,
        abs_tol=_ROUND_TRIP_RELATIVE_TOLERANCE,
    )
