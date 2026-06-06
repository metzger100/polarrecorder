from __future__ import annotations

import pytest
from polarrecorder.coerce import to_float, to_int


def test_to_int_accepts_int_compatible_scalars() -> None:
    assert to_int(3) == 3
    assert to_int("7") == 7
    assert to_int(4.9) == 4
    assert to_int(b"5") == 5


def test_to_int_rejects_non_scalar() -> None:
    with pytest.raises(TypeError):
        to_int([1])


def test_to_float_accepts_float_compatible_scalars() -> None:
    assert to_float(2) == 2.0
    assert to_float("1.5") == 1.5
    assert to_float(b"3.25") == 3.25


def test_to_float_rejects_non_scalar() -> None:
    with pytest.raises(TypeError):
        to_float({"x": 1})
