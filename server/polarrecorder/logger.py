"""Module: Logger - Logging protocol for pure modules.

Documentation: documentation/architecture/polar-model.md
Depends: none
"""

from __future__ import annotations

from typing import Protocol


class AvNavLogAPI(Protocol):
    """Duck-typed AvNav logging surface."""

    def log(self, format: str, *param: object) -> None:  # noqa: A002
        """Log an informational message."""
        ...

    def debug(self, format: str, *param: object) -> None:  # noqa: A002
        """Log a debug message."""
        ...

    def error(self, format: str, *param: object) -> None:  # noqa: A002
        """Log an error message."""
        ...


class Logger(Protocol):
    """Minimal logging interface implemented by integration adapters."""

    def info(self, msg: str) -> None:
        """Log an informational message."""
        ...

    def warn(self, msg: str) -> None:
        """Log a warning message."""
        ...

    def debug(self, msg: str) -> None:
        """Log a debug message."""
        ...

    def error(self, msg: str) -> None:
        """Log an error message."""
        ...


class AvNavLogger:
    """Logger adapter delegating to AvNav's plugin API."""

    def __init__(self, api: AvNavLogAPI) -> None:
        """Create an AvNav logger adapter.

        Args:
            api: AvNav API proxy or compatible fake.
        """
        self._api = api

    def info(self, msg: str) -> None:
        """Log an informational message."""
        self._api.log(msg)

    def warn(self, msg: str) -> None:
        """Log a warning message via AvNav's info log."""
        self._api.log(f"[WARN] {msg}")

    def debug(self, msg: str) -> None:
        """Log a debug message."""
        self._api.debug(msg)

    def error(self, msg: str) -> None:
        """Log an error message."""
        self._api.error(msg)
