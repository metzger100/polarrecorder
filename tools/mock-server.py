#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
PORT = 8080
NOW = 1769940000.0
INITIAL_PRESETS = [
    {
        "name": "windy",
        "builtin": True,
        "twa": [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180],
        "tws": [4, 6, 8, 10, 12, 14, 16, 20, 25],
    },
    {
        "name": "coastal-cruise",
        "builtin": False,
        "twa": [0, 45, 60, 75, 90, 105, 120, 135, 150, 180],
        "tws": [6, 9, 12, 15, 18, 22],
    },
]
COUNTERS = {
    "total_seen": 12480,
    "total_accepted": 7360,
    "total_rejected": 4210,
    "total_quarantined": 910,
    "acceptance_rate": 0.59,
}
EMPTY_COUNTERS = {
    "total_seen": 0,
    "total_accepted": 0,
    "total_rejected": 0,
    "total_quarantined": 0,
    "acceptance_rate": 0.0,
}
NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9 -]{0,29}")


class MockError(ValueError):
    pass


class MockState:
    def __init__(self) -> None:
        self.lock = Lock()
        self.recording = True
        self.reset_model = False
        self.generation = 4527
        self.presets = [copy_preset(preset) for preset in INITIAL_PRESETS]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.serve_api(parsed.path, parse_qs(parsed.query, keep_blank_values=True))
            return
        self.serve_static(parsed.path)

    def serve_api(self, path: str, query: dict[str, list[str]]) -> None:
        endpoint = path.removeprefix("/api/").strip("/")
        try:
            if endpoint == "pause":
                self.send_json(pause_response())
                return
            if endpoint == "resume":
                self.send_json(resume_response())
                return
            if endpoint == "reset":
                self.send_json(reset_response(query))
                return
            if endpoint == "presets/save":
                self.send_json(save_preset_response(query))
                return
            if endpoint == "presets/delete":
                self.send_json(delete_preset_response(query))
                return
            if endpoint == "status":
                self.send_json(status_response())
                return
            if endpoint == "rejections":
                self.send_json(rejections_response())
                return
            if endpoint == "timeline":
                self.send_json(timeline_response(int_arg(query, "minutes", 240)))
                return
            if endpoint == "config":
                self.send_json(config_response())
                return
            if endpoint == "presets":
                self.send_json(presets_response())
                return
            if endpoint == "polar":
                self.send_json(
                    polar_response(scalar(query, "format", "windy"), int_arg(query, "percentile", 65))
                )
                return
            if endpoint == "export/json":
                self.send_json(backup_response())
                return
            if endpoint == "export":
                self.send_json({"status": "OK", "data": {"csv": export_csv(query)}})
                return
        except MockError as exc:
            self.send_json(error_response(str(exc)))
            return
        self.send_error(404)

    def serve_static(self, raw_path: str) -> None:
        path = unquote(raw_path).lstrip("/") or "viewer/viewer.html"
        target = (ROOT / path).resolve()
        if not str(target).startswith(str(ROOT)) or not target.is_file():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_file(target, content_type)

    def send_json(self, body: dict[str, object]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_file(self, path: Path, content_type: str) -> None:
        payload = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def scalar(query: dict[str, list[str]], name: str, default: str) -> str:
    values = query.get(name)
    return values[0] if values else default


def int_arg(query: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int(scalar(query, name, str(default)))
    except ValueError:
        return default


def error_response(message: str) -> dict[str, object]:
    return {"status": "ERROR", "error": message}


def ok_response(data: dict[str, object] | None = None) -> dict[str, object]:
    return {"status": "OK", "data": data or {}}


def copy_preset(preset: dict[str, object]) -> dict[str, object]:
    return {
        "name": str(preset["name"]),
        "builtin": bool(preset["builtin"]),
        "twa": [int(value) for value in preset["twa"]],
        "tws": [int(value) for value in preset["tws"]],
    }


STATE = MockState()


def preset_by_name(name: str) -> dict[str, object]:
    for preset in STATE.presets:
        if preset["name"] == name or (preset["builtin"] and name.lower() == "windy"):
            return preset
    msg = f"Unknown format '{name}'"
    raise MockError(msg)


def parse_grid(query: dict[str, list[str]], name: str, lower: int, upper: int) -> list[int]:
    values = []
    raw = scalar(query, name, "")
    for part in raw.split(","):
        text = part.strip()
        if not text:
            continue
        try:
            value = int(text)
        except ValueError as exc:
            msg = f"Invalid parameter '{name}': expected comma-separated integers"
            raise MockError(msg) from exc
        if not lower <= value <= upper:
            msg = f"Invalid parameter '{name}': expected values {lower}-{upper}"
            raise MockError(msg)
        values.append(value)
    if not values:
        msg = f"Invalid parameter '{name}': expected at least one value"
        raise MockError(msg)
    return sorted(set(values))


def parse_preset_name(query: dict[str, list[str]]) -> str:
    name = scalar(query, "name", "").strip()
    if name.lower() == "windy":
        msg = "Preset name 'windy' is reserved"
        raise MockError(msg)
    if NAME_PATTERN.fullmatch(name) is None:
        msg = "Invalid parameter 'name': expected 1-30 alphanumeric, hyphen, or space chars"
        raise MockError(msg)
    return name


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
            existing for existing in STATE.presets
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
            preset for preset in STATE.presets
            if preset["builtin"] or preset["name"] != name
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
    if 64 <= twa <= 70 and tws >= 15:
        return False
    if 136 <= twa <= 142 and tws <= 9:
        return False
    return True


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
    populated = {tws: False for tws in tws_values}
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
            "record_enabled": True,
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
        return {"accepted": 0, "rejected": 60, "quarantined": 0, "reasons": {"reject_anchored": 60}}
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
    return {
        "status": "OK",
        "data": {
            "record_enabled": True,
            "sample_interval": 1.0,
            "percentile": 65,
            "flush_interval": 300,
            "min_samples_for_export": 10,
            "max_tws": 60,
        },
    }


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
            "config": {"percentile": 65, "max_tws": 60, "twa_bin_size": 1, "tws_bin_size": 1},
            "model": {"bins": bins},
            "counters": counters,
        },
    }


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving Polar Recorder mock UI at http://localhost:{PORT}/viewer/viewer.html")
    server.serve_forever()


if __name__ == "__main__":
    main()
