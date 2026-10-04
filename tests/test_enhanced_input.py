from __future__ import annotations

import math

from polarrecorder.enhanced_input import coerce_finite_float


def test_coerce_finite_float_rejects_booleans_and_is_total() -> None:
    true_value: object = True
    false_value: object = False
    assert coerce_finite_float(true_value) is None
    assert coerce_finite_float(false_value) is None
    assert coerce_finite_float(50) == 50.0
    assert coerce_finite_float(13.2) == 13.2
    assert coerce_finite_float("47.5") == 47.5
    assert coerce_finite_float(" 12 ") == 12.0
    assert coerce_finite_float("off") is None
    assert coerce_finite_float(None) is None
    assert coerce_finite_float(math.nan) is None
    assert coerce_finite_float(math.inf) is None
    assert coerce_finite_float(10**10_000) is None
