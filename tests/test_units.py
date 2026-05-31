from __future__ import annotations

import math

from polarrecorder.units import (
    MPS_TO_KNOTS,
    knots_to_meters_per_second,
    meters_per_second_to_knots,
)


def test_meters_per_second_to_knots_uses_plan_constant() -> None:
    assert MPS_TO_KNOTS == 1.94384
    assert meters_per_second_to_knots(1.0) == 1.94384


def test_knots_round_trip_to_meters_per_second() -> None:
    speed_ms = knots_to_meters_per_second(meters_per_second_to_knots(2.5))

    assert math.isclose(speed_ms, 2.5)
