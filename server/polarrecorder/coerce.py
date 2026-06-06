"""Module: Coerce - Scalar type coercion helpers.

Documentation: documentation/architecture/persistence.md
Depends: none
"""

from __future__ import annotations


def to_int(value: object) -> int:
    """Coerce an int-compatible scalar to ``int``.

    Args:
        value: A str, bytes, bytearray, int, or float scalar.

    Returns:
        The value converted to ``int``.

    Raises:
        TypeError: If the value is not int-compatible.
    """
    if isinstance(value, (str, bytes, bytearray, int, float)):
        return int(value)
    msg = f"Expected int-compatible value, got {type(value).__name__}"
    raise TypeError(msg)


def to_float(value: object) -> float:
    """Coerce a float-compatible scalar to ``float``.

    Args:
        value: A str, bytes, bytearray, int, or float scalar.

    Returns:
        The value converted to ``float``.

    Raises:
        TypeError: If the value is not float-compatible.
    """
    if isinstance(value, (str, bytes, bytearray, int, float)):
        return float(value)
    msg = f"Expected float-compatible value, got {type(value).__name__}"
    raise TypeError(msg)
