from __future__ import annotations

import re
from threading import Lock

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


def copy_preset(preset: dict[str, object]) -> dict[str, object]:
    return {
        "name": str(preset["name"]),
        "builtin": bool(preset["builtin"]),
        "twa": [int(value) for value in preset["twa"]],
        "tws": [int(value) for value in preset["tws"]],
    }


class MockState:
    def __init__(self) -> None:
        self.lock = Lock()
        self.recording = True
        self.reset_model = False
        self.generation = 4527
        self.presets = [copy_preset(preset) for preset in INITIAL_PRESETS]
        self.source_config = {
            "twa_key": "gps.trueWindAngle",
            "tws_key": "gps.trueWindSpeed",
            "stw_key": "gps.waterSpeed",
        }


STATE = MockState()


def preset_by_name(name: str) -> dict[str, object]:
    for preset in STATE.presets:
        if preset["name"] == name or (preset["builtin"] and name.lower() == "windy"):
            return preset
    msg = f"Unknown format '{name}'"
    raise MockError(msg)


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
