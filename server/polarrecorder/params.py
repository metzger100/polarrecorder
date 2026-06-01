"""Module: Params - AvNav-shaped editable parameter specifications.

Documentation: documentation/user/configuration.md
Depends: none
"""

from __future__ import annotations

EDITABLE_PARAMETERS: list[dict[str, object]] = [
    {
        "name": "record_enabled",
        "type": "BOOLEAN",
        "default": "true",
        "description": "Master recording enable/disable",
    },
    {
        "name": "sample_interval",
        "type": "FLOAT",
        "default": "1.0",
        "rangeOrList": [0.5, 5.0],
        "description": "Seconds between store value reads",
    },
    {
        "name": "percentile",
        "type": "NUMBER",
        "default": "65",
        "rangeOrList": [1, 99],
        "description": "Percentile for polar speed extraction",
    },
    {
        "name": "flush_interval",
        "type": "NUMBER",
        "default": "300",
        "rangeOrList": [60, 3600],
        "description": "Seconds between persistence flushes",
    },
    {
        "name": "stale_threshold",
        "type": "FLOAT",
        "default": "3.0",
        "rangeOrList": [1.0, 30.0],
        "description": "Max age for a store value before it is stale",
    },
    {
        "name": "age_skew_threshold",
        "type": "FLOAT",
        "default": "2.0",
        "rangeOrList": [0.5, 10.0],
        "description": "Max timestamp difference between core values",
    },
    {
        "name": "max_tws",
        "type": "NUMBER",
        "default": "60",
        "rangeOrList": [20, 60],
        "description": "Max plausible true wind speed in knots",
    },
    {
        "name": "max_stw",
        "type": "NUMBER",
        "default": "40",
        "rangeOrList": [10, 80],
        "description": "Max plausible speed through water in knots",
    },
    {
        "name": "low_wind_threshold",
        "type": "FLOAT",
        "default": "3.0",
        "rangeOrList": [0.5, 10.0],
        "description": "TWS below this is rejected",
    },
    {
        "name": "head_to_wind_threshold",
        "type": "NUMBER",
        "default": "10",
        "rangeOrList": [5, 30],
        "description": "TWA abs below this is rejected",
    },
    {
        "name": "anchored_stw_threshold",
        "type": "FLOAT",
        "default": "0.3",
        "rangeOrList": [0.1, 1.0],
        "description": "STW below this with wind is rejected",
    },
    {
        "name": "twa_roc_threshold",
        "type": "FLOAT",
        "default": "15.0",
        "rangeOrList": [5.0, 45.0],
        "description": "Max TWA change in degrees per second",
    },
    {
        "name": "tws_roc_threshold",
        "type": "FLOAT",
        "default": "10.0",
        "rangeOrList": [3.0, 30.0],
        "description": "Max TWS change in knots per second",
    },
    {
        "name": "stw_roc_threshold",
        "type": "FLOAT",
        "default": "2.0",
        "rangeOrList": [0.5, 10.0],
        "description": "Max STW change in knots per second",
    },
    {
        "name": "cooldown_seconds",
        "type": "NUMBER",
        "default": "30",
        "rangeOrList": [5, 120],
        "description": "Seconds to reject after maneuver detection",
    },
    {
        "name": "stability_window_seconds",
        "type": "NUMBER",
        "default": "15",
        "rangeOrList": [5, 60],
        "description": "Seconds of stable values required",
    },
    {
        "name": "stability_twa_range",
        "type": "FLOAT",
        "default": "20.0",
        "rangeOrList": [5.0, 45.0],
        "description": "Max TWA range in stability window",
    },
    {
        "name": "stability_tws_range",
        "type": "FLOAT",
        "default": "10.0",
        "rangeOrList": [3.0, 20.0],
        "description": "Max TWS range in stability window",
    },
    {
        "name": "stability_stw_range",
        "type": "FLOAT",
        "default": "4.0",
        "rangeOrList": [1.0, 10.0],
        "description": "Max STW range in stability window",
    },
    {
        "name": "engine_tws_ceil",
        "type": "FLOAT",
        "default": "5.0",
        "rangeOrList": [2.0, 15.0],
        "description": "TWS ceiling for engine-suspected quarantine",
    },
    {
        "name": "engine_stw_floor",
        "type": "FLOAT",
        "default": "3.0",
        "rangeOrList": [1.0, 10.0],
        "description": "STW floor for engine-suspected quarantine",
    },
    {
        "name": "min_samples_for_export",
        "type": "NUMBER",
        "default": "10",
        "rangeOrList": [3, 100],
        "description": "High-confidence export sample floor",
    },
    {
        "name": "debug_logging",
        "type": "BOOLEAN",
        "default": "false",
        "description": "Enable verbose debug logging of sample decisions",
    },
]
