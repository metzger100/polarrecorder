"""Module: Import Common - Shared strict gates for user backup imports.

Documentation: documentation/architecture/import-restore.md
Depends: none
"""

from __future__ import annotations

import json
from typing import cast

# Maximum decoded size of an uploaded backup, shared by every import kind.
MAX_IMPORT_BYTES = 4_194_304  # 4 MiB


class BackupError(Exception):
    """Raised when an uploaded backup fails a strict, user-safe import gate."""

    def __init__(self, reason: str) -> None:
        """Store a stable, user-readable rejection reason."""
        super().__init__(reason)
        self.reason = reason


def decode_object(raw: str, what: str, max_bytes: int = MAX_IMPORT_BYTES) -> dict[str, object]:
    """Apply the size, JSON, and object gates to a raw backup string.

    Args:
        raw: The assembled backup text.
        what: Human-readable artifact name used in rejection messages.
        max_bytes: Inclusive byte cap for the decoded payload.

    Returns:
        The parsed JSON object.

    Raises:
        BackupError: If the payload is too large, not valid JSON, or not an
            object.
    """
    if len(raw.encode("utf-8")) > max_bytes:
        msg = f"{what} is too large to import"
        raise BackupError(msg)
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as exc:
        msg = f"{what} is not valid JSON"
        raise BackupError(msg) from exc
    if not isinstance(decoded, dict):
        msg = f"This file is not a {what}"
        raise BackupError(msg)
    return cast("dict[str, object]", decoded)


def require_dict(value: object, what: str) -> dict[str, object]:
    """Return ``value`` as a dict or reject with a precise reason.

    Args:
        value: The candidate value pulled from a backup payload.
        what: Human-readable field name used in rejection messages.

    Returns:
        The value narrowed to a dict.

    Raises:
        BackupError: If the value is not a JSON object.
    """
    if not isinstance(value, dict):
        msg = f"{what} is not an object"
        raise BackupError(msg)
    return cast("dict[str, object]", value)


def check_unknown_keys(data: dict[str, object], allowed: frozenset[str], what: str) -> None:
    """Reject a payload carrying top-level keys outside ``allowed``.

    Args:
        data: The parsed backup object.
        allowed: The exact set of permitted top-level keys.
        what: Human-readable artifact name used in rejection messages.

    Raises:
        BackupError: If any unexpected top-level key is present.
    """
    unknown = sorted(set(data) - allowed)
    if unknown:
        msg = f"{what} has unexpected fields: {', '.join(unknown)}"
        raise BackupError(msg)


def is_int(value: object) -> bool:
    """Return True for a real integer, rejecting ``bool`` (an ``int`` subclass)."""
    return isinstance(value, int) and not isinstance(value, bool)
