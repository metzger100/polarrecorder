"""Module: Plugin - Minimal AvNav integration stub.

Documentation: ARCHITECTURE.md
Depends: polarrecorder
"""

from __future__ import annotations

import os
import sys
from typing import TYPE_CHECKING, Any, ClassVar

_plugin_dir = os.path.dirname(os.path.abspath(__file__))
if _plugin_dir not in sys.path:
    sys.path.insert(0, _plugin_dir)

if TYPE_CHECKING:
    from avnav_api import AVNApi


class Plugin:
    """Minimal AvNav plugin shell for Phase 1 bootstrap."""

    _PLUGIN_INFO: ClassVar[dict[str, object]] = {
        "description": "Polar Recorder bootstrap stub",
        "version": "1.0.0",
    }

    @classmethod
    def pluginInfo(cls) -> dict[str, object]:
        """Return static Phase 1 plugin metadata."""
        return dict(cls._PLUGIN_INFO)

    def __init__(self, api: AVNApi) -> None:
        """Store the AvNav API proxy without starting work."""
        self.api: Any = api

    def run(self) -> None:
        """Return immediately until product phases add runtime behavior."""
        return
