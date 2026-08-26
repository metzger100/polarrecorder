from __future__ import annotations

import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable

from mock_server.state import (
    COUNTERS,
    EMPTY_COUNTERS,
    NOW,
    STATE,
    MockError,
    copy_preset,
    int_arg,
    ok_response,
    parse_grid,
    parse_preset_name,
    preset_by_name,
    scalar,
)

ROUTING_TWA = (30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180)
ROUTING_TWS = (4, 6, 8, 10, 12, 14, 16, 20, 25)


def pause_response() -> dict[str, object]:
    with STATE.lock:
        STATE.recording = False
    return ok_response({"recording": False})


def resume_response() -> dict[str, object]:
    with STATE.lock:
        STATE.recording = True
    return ok_response({"recording": True})


def reset_response(query: dict[str, list[str]]) -> dict[str, object]:
    if scalar(query, "confirm", "") != "yes":
        msg = "Invalid parameter 'confirm': expected 'yes'"
        raise MockError(msg)
    with STATE.lock:
        STATE.reset_model = True
        STATE.generation += 1
    return ok_response({})


def save_preset_response(query: dict[str, list[str]]) -> dict[str, object]:
    preset = {
        "name": parse_preset_name(query),
        "builtin": False,
        "twa": parse_grid(query, "twa", 0, 180),
        "tws": parse_grid(query, "tws", 1, 60),
    }
    with STATE.lock:
        STATE.presets = [
            existing
            for existing in STATE.presets
            if existing["builtin"] or existing["name"] != preset["name"]
        ]
        STATE.presets.append(preset)
        STATE.generation += 1
    return ok_response({"preset": copy_preset(preset)})


def delete_preset_response(query: dict[str, list[str]]) -> dict[str, object]:
    if scalar(query, "confirm", "") != "yes":
        msg = "Invalid parameter 'confirm': expected 'yes'"
        raise MockError(msg)
    name = scalar(query, "name", "").strip()
    if name.lower() == "windy":
        msg = "Preset 'windy' is built in and cannot be deleted"
        raise MockError(msg)
    with STATE.lock:
        before = len(STATE.presets)
        STATE.presets = [
            preset for preset in STATE.presets if preset["builtin"] or preset["name"] != name
        ]
        if len(STATE.presets) == before:
            msg = f"Unknown preset '{name}'"
            raise MockError(msg)
        STATE.generation += 1
    return ok_response({})


def presets_response() -> dict[str, object]:
    with STATE.lock:
        presets = [copy_preset(preset) for preset in STATE.presets]
    return ok_response({"presets": presets})


def speed(twa: int, tws: int, percentile: int) -> float:
    if twa == 0:
        return 0.0
    angle = math.sin(math.radians(max(0, min(180, twa))))
    shape = max(0.1, angle) ** 0.45
    percentile_factor = 1 + (percentile - 65) * 0.003
    return round((1.35 + tws * 0.31 + shape * (2.35 + tws * 0.055)) * percentile_factor, 1)


def samples(twa: int, tws: int) -> int:
    edge_penalty = 9 if twa < 45 or twa > 155 else 0
    return max(3, 24 + tws + (twa % 7) * 3 - edge_penalty)


def has_data(twa: int, tws: int) -> bool:
    if twa in {0, 180}:
        return True
    if twa < 28 or twa > 166:
        return False
    return not (64 <= twa <= 70 and tws >= 15) and not (136 <= twa <= 142 and tws <= 9)


def polar_response(format_name: str, percentile: int) -> dict[str, object]:
    with STATE.lock:
        preset = copy_preset(preset_by_name(format_name))
        generation = STATE.generation
        reset_model = STATE.reset_model
    bands = [int(value) for value in preset["tws"]]
    twa_points = {int(value) for value in preset["twa"]}
    curves = {}
    if reset_model:
        bands = []
    for tws in bands:
        curve = []
        for twa in range(181):
            if twa in twa_points and has_data(twa, tws):
                curve.append({"stw": speed(twa, tws, percentile), "samples": samples(twa, tws)})
            else:
                curve.append(None)
        if any(entry is not None for entry in curve) and curve[0] is None:
            curve[0] = {"stw": 0.0, "samples": 0}
        curves[str(tws)] = curve
    return {
        "status": "OK",
        "data": {
            "format": preset["name"],
            "percentile": percentile,
            "generation": generation,
            "tws_bands": bands,
            "curves": curves,
        },
    }


def export_csv(query: dict[str, list[str]]) -> str:
    percentile = int_arg(query, "percentile", 65)
    high_confidence = scalar(query, "high_confidence", "").lower() in {"yes", "true", "1"}
    with STATE.lock:
        reset_model = STATE.reset_model
    if "format" in query and ("twa" in query or "tws" in query):
        msg = "Invalid parameters: 'format' cannot be combined with 'twa' or 'tws'"
        raise MockError(msg)
    if ("twa" in query) != ("tws" in query):
        msg = "Invalid parameters: 'twa' and 'tws' must be supplied together"
        raise MockError(msg)
    if "twa" in query and "tws" in query:
        twa_values = parse_grid(query, "twa", 0, 180)
        tws_values = parse_grid(query, "tws", 1, 60)
    else:
        with STATE.lock:
            preset = copy_preset(preset_by_name(scalar(query, "format", "windy")))
        twa_values = [int(value) for value in preset["twa"]]
        tws_values = [int(value) for value in preset["tws"]]
    rows = [["TWA\\TWS"] + [str(value) for value in tws_values]]
    populated = dict.fromkeys(tws_values, False)
    for twa in twa_values:
        row = [str(twa)]
        for tws in tws_values:
            enough = samples(twa, tws) >= 10 if high_confidence else has_data(twa, tws)
            enough = enough and not reset_model
            cell = str(speed(twa, tws, percentile)) if enough and has_data(twa, tws) else ""
            if cell:
                populated[tws] = True
            row.append(cell)
        rows.append(row)
    if 0 in twa_values:
        zero_row = rows[twa_values.index(0) + 1]
        for index, tws in enumerate(tws_values):
            if populated[tws] and zero_row[index + 1] == "":
                zero_row[index + 1] = "0.0"
    return "\r\n".join(";".join(row) for row in rows) + "\r\n"


def status_response() -> dict[str, object]:
    with STATE.lock:
        counters = dict(EMPTY_COUNTERS if STATE.reset_model else COUNTERS)
        recording = STATE.recording
        reset_model = STATE.reset_model
        generation = STATE.generation
    return {
        "status": "OK",
        "data": {
            "recording": recording,
            "data_status": "receiving",
            "warming_up": True,
            "uptime_seconds": 1840,
            "current_values": {
                "twa_deg": 127.3,
                "tws_kt": 14.2,
                "stw_kt": 6.1,
                "twa_age_s": 0.4,
                "tws_age_s": 0.5,
                "stw_age_s": 0.4,
                "twa_stale": False,
                "tws_stale": False,
                "stw_stale": False,
            },
            "current_decision": {"state": "rejected", "reason_codes": ["reject_warming_up"]},
            "counters": counters,
            "top_rejections": [] if reset_model else top_rejections(),
            "persistence": {
                "last_flush_wall": NOW - 420,
                "file_size_bytes": 1024 if reset_model else 58264,
                "bins_with_data": 0 if reset_model else 386,
                "bins_total": 21960,
            },
            "generation": generation,
        },
    }


def top_rejections() -> list[dict[str, object]]:
    return [
        {"reason": "reject_anchored", "count": 1220},
        {"reason": "reject_low_wind", "count": 940},
        {"reason": "reject_unstable", "count": 710},
        {"reason": "reject_warming_up", "count": 530},
        {"reason": "quarantine_engine_suspected", "count": 260},
    ]


def rejections_response() -> dict[str, object]:
    with STATE.lock:
        reset_model = STATE.reset_model
    if reset_model:
        return {"status": "OK", "data": {"global": {}, "per_bin": {}}}
    return {
        "status": "OK",
        "data": {
            "global": {entry["reason"]: entry["count"] for entry in top_rejections()},
            "per_bin": {
                "90_12": {"reject_unstable": 15, "reject_stw_roc": 8},
                "120_14": {"quarantine_engine_suspected": 3},
            },
        },
    }


def timeline_response(minutes: int) -> dict[str, object]:
    buckets = []
    for index in range(max(1, min(240, minutes))):
        if index in {17, 18, 95, 161}:
            continue
        t = NOW - (minutes - 1 - index) * 60
        buckets.append(bucket_for(index))
        buckets[-1]["t"] = t
    return {"status": "OK", "data": {"buckets": buckets}}


def bucket_for(index: int) -> dict[str, object]:
    if 42 <= index <= 70:
        return {
            "accepted": 0,
            "rejected": 60,
            "quarantined": 0,
            "reasons": {"reject_anchored": 60},
        }
    if 130 <= index <= 145:
        return {
            "accepted": 22,
            "rejected": 16,
            "quarantined": 22,
            "reasons": {"reject_unstable": 16, "quarantine_engine_suspected": 22},
        }
    return {
        "accepted": 48,
        "rejected": 9,
        "quarantined": 3,
        "reasons": {"reject_low_wind": 5, "reject_unstable": 4, "quarantine_engine_suspected": 3},
    }


def config_response() -> dict[str, object]:
    with STATE.lock:
        source_config = dict(STATE.source_config)
    return {
        "status": "OK",
        "data": {
            **source_config,
            "sample_interval": 1.0,
            "percentile": 65,
            "flush_interval": 300,
            "min_samples_for_export": 10,
            "max_tws": 60,
        },
    }


def _store_keys_response() -> dict[str, object]:
    return ok_response(
        {
            "keys": [
                "gps.trueWindAngle",
                "gps.trueWindSpeed",
                "gps.waterSpeed",
                "gps.signalk.environment.wind.angleTrueWater",
                "gps.signalk.environment.wind.speedTrue",
                "gps.signalk.navigation.speedThroughWater",
            ]
        }
    )


def _save_settings_response(query: dict[str, list[str]]) -> dict[str, object]:
    source_fields = ("twa_key", "tws_key", "stw_key")
    updates = {field: scalar(query, field, "").strip() for field in source_fields if field in query}
    if updates and any(not value for value in updates.values()):
        raise MockError("Select a store key for every core data source")
    with STATE.lock:
        STATE.source_config.update(updates)
    return ok_response({"config": updates})


def _polar_endpoint(query: dict[str, list[str]]) -> dict[str, object]:
    return polar_response(scalar(query, "format", "windy"), int_arg(query, "percentile", 65))


def _export_endpoint(query: dict[str, list[str]]) -> dict[str, object]:
    return {"status": "OK", "data": {"csv": export_csv(query)}}


def _routing_pol_endpoint(query: dict[str, list[str]]) -> dict[str, object]:
    if any(name in query for name in ("format", "twa", "tws")):
        msg = "Invalid parameters: 'export/pol' uses its fixed routing grid"
        raise MockError(msg)
    percentile = int_arg(query, "percentile", 65)
    with STATE.lock:
        reset_model = STATE.reset_model
    if reset_model:
        msg = "NavimetriX export is incomplete: 108 of 108 polar cells lack sufficient data."
        raise MockError(msg)
    rows = ["TWA\\TWS\t" + "\t".join(str(tws) for tws in ROUTING_TWS)]
    for twa in ROUTING_TWA:
        values = [str(twa)]
        values.extend(str(speed(twa, tws, percentile)) for tws in ROUTING_TWS)
        rows.append("\t".join(values))
    return ok_response({"pol": "\r\n".join(rows) + "\r\n"})


ROUTES: dict[str, Callable[[dict[str, list[str]]], dict[str, object]]] = {
    "pause": lambda _query: pause_response(),
    "resume": lambda _query: resume_response(),
    "reset": reset_response,
    "presets/save": save_preset_response,
    "presets/delete": delete_preset_response,
    "status": lambda _query: status_response(),
    "rejections": lambda _query: rejections_response(),
    "timeline": lambda query: timeline_response(int_arg(query, "minutes", 240)),
    "config": lambda _query: config_response(),
    "enhanced/keys": lambda _query: _store_keys_response(),
    "advanced/save": _save_settings_response,
    "presets": lambda _query: presets_response(),
    "polar": _polar_endpoint,
    "export/json": lambda _query: backup_response(),
    "export": _export_endpoint,
    "export/pol": _routing_pol_endpoint,
}


def dispatch(endpoint: str, query: dict[str, list[str]]) -> dict[str, object] | None:
    """Route a mock `/api/<endpoint>` request to its handler, or return None for a 404."""
    handler = ROUTES.get(endpoint)
    if handler is None:
        return None
    return handler(query)


def backup_response() -> dict[str, object]:
    with STATE.lock:
        reset_model = STATE.reset_model
        counters = dict(EMPTY_COUNTERS if reset_model else COUNTERS)
    bins = {} if reset_model else {"90_12": {"histogram": {"61": 3, "62": 8, "63": 6}}}
    return {
        "status": "OK",
        "data": {
            "schema_version": 1,
            "plugin_version": "0.0.0-dev",
            "created_wall": NOW - 86400,
            "last_flush_wall": NOW - 420,
            "config": {
                "percentile": 65,
                "max_tws": 60,
                "twa_bin_size": 1,
                "tws_bin_size": 1,
            },
            "model": {"bins": bins},
            "counters": counters,
        },
    }
