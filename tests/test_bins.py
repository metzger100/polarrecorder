from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st
from polarrecorder.bins import (
    TWA_BIN_SIZE,
    TWS_BIN_MAX,
    TWS_BIN_SIZE,
    bin_address,
    twa_bin,
    tws_bin,
)

_TWA = st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False)
_TWS = st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False)


def test_named_grid_constants_are_phase_3_values() -> None:
    assert TWA_BIN_SIZE == 1
    assert TWS_BIN_SIZE == 1
    assert TWS_BIN_MAX == 60


def test_twa_bin_uses_builtin_round_and_wraps() -> None:
    assert round(352.335) == 352
    assert twa_bin(352.335) == 352
    assert twa_bin(359.8) == 0
    assert twa_bin(-1.0) == 359


def test_tws_bin_uses_builtin_round_and_clamps() -> None:
    assert round(12.7) == 13
    assert tws_bin(12.7) == 13
    assert tws_bin(-2.0) == 0
    assert tws_bin(99.0) == TWS_BIN_MAX


def test_bin_address_combines_twa_and_tws() -> None:
    assert bin_address(352.335, 12.7) == (352, 13)


@given(twa=_TWA)
def test_twa_bin_is_bounded(twa: float) -> None:
    result = twa_bin(twa)
    assert 0 <= result < 360


@given(twa=_TWA, turns=st.integers(min_value=-1000, max_value=1000))
def test_twa_bin_is_360_degree_periodic(twa: float, turns: int) -> None:
    assert twa_bin(twa + turns * 360.0) == twa_bin(twa)


@given(tws=_TWS)
def test_tws_bin_is_bounded(tws: float) -> None:
    result = tws_bin(tws)
    assert 0 <= result <= TWS_BIN_MAX
