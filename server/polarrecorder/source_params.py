"""Module: Source Params - Core AvNav store-key parameter specifications.

Documentation: documentation/avnav/keys-and-units.md
Depends: none
"""

from __future__ import annotations

TWA_KEY_DEFAULT = "gps.trueWindAngle"
TWS_KEY_DEFAULT = "gps.trueWindSpeed"
STW_KEY_DEFAULT = "gps.waterSpeed"
HEEL_KEY_DEFAULT = "gps.signalk.navigation.attitude.roll"
CORE_KEY_FIELDS = ("twa_key", "tws_key", "stw_key")

CORE_SOURCE_PARAMETERS: list[dict[str, object]] = [
    {
        "name": "twa_key",
        "type": "STRING",
        "default": TWA_KEY_DEFAULT,
        "description": "Store key for true wind angle in degrees",
    },
    {
        "name": "tws_key",
        "type": "STRING",
        "default": TWS_KEY_DEFAULT,
        "description": "Store key for true wind speed in meters per second",
    },
    {
        "name": "stw_key",
        "type": "STRING",
        "default": STW_KEY_DEFAULT,
        "description": "Store key for speed through water in meters per second",
    },
]
