"""Module: Logger - Logging protocol for pure modules.

Documentation: documentation/architecture/polar-model.md
Depends: none
"""

from __future__ import annotations

from typing import Protocol


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
