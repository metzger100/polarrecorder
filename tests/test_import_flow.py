from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from conftest import FakeAvNavAPI, FakeClock
from plugin_integration_support import response_data
from polarrecorder import import_common, persistence
from polarrecorder.bins import Bin
from polarrecorder.counters import Counters
from polarrecorder.polar_model import PolarModel
from polarrecorder.timeline import Timeline

import plugin as plugin_module

if TYPE_CHECKING:
    from pathlib import Path

CHUNK_CHARS = 4000


def make_plugin(
    tmp_path: Path,
    monotonic: FakeClock | None = None,
    wall: FakeClock | None = None,
) -> tuple[plugin_module.Plugin, FakeAvNavAPI]:
    monotonic = monotonic if monotonic is not None else FakeClock(100.0)
    wall = wall if wall is not None else FakeClock(1000.0)
    api = FakeAvNavAPI()
    plugin = plugin_module.Plugin(api)
    plugin._data_dir = str(tmp_path)
    plugin._clock = monotonic
    plugin._wall_clock = wall
    plugin._timeline = Timeline(wall)
    plugin._run_start_monotonic = monotonic()
    plugin._load_persistence()
    return plugin, api


def request(plugin: plugin_module.Plugin, url: str, **args: str) -> dict[str, object]:
    return plugin._handle_request(url, object(), {key: [value] for key, value in args.items()})


def upload(
    plugin: plugin_module.Plugin,
    kind: str,
    raw: str,
    confirm: str = "yes",
) -> dict[str, object]:
    begin = response_data(request(plugin, "import/begin", kind=kind))
    token = str(begin["token"])
    for seq, start in enumerate(range(0, len(raw), CHUNK_CHARS)):
        chunk = request(
            plugin,
            "import/chunk",
            token=token,
            seq=str(seq),
            data=raw[start : start + CHUNK_CHARS],
        )
        assert chunk["status"] == "OK"
    return request(plugin, "import/commit", token=token, confirm=confirm)


def polar_backup() -> str:
    model = PolarModel()
    model.bins[(90, 12)] = Bin(
        twa_deg=90, tws_kt=12, histogram={58: 3}, total_accepted=3, last_update_wall=1000.0
    )
    counters = Counters(total_seen=5, total_accepted=3)
    payload = persistence.serialize_to_dict(
        model,
        counters,
        persistence.PersistenceMetadata(created_wall=500.0, last_flush_wall=1500.0),
    )
    return json.dumps(payload)


def test_polar_restore_replaces_model_and_flushes(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)

    commit = response_data(upload(plugin, "learned-data", polar_backup()))

    assert commit == {
        "kind": "learned-data",
        "bins_restored": 1,
        "total_accepted": 3,
        "migrated_from_version": persistence.CURRENT_SCHEMA_VERSION,
    }
    assert plugin._model.bins[(90, 12)].total_accepted == 3
    assert plugin._model.generation == 1
    assert plugin._counters.total_accepted == 3
    assert plugin._flush_requested is True

    plugin._flush()

    assert plugin._flush_requested is False
    assert persistence.load(tmp_path).model.bins[(90, 12)].total_accepted == 3


def test_presets_restore_replaces_user_presets_without_flush(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)
    assert request(plugin, "presets/save", name="coastal", twa="0,45,90", tws="6,12")["status"] == (
        "OK"
    )
    backup = json.dumps(response_data(request(plugin, "export/presets")))
    assert request(plugin, "presets/save", name="temp", twa="0,90", tws="8")["status"] == "OK"

    commit = response_data(upload(plugin, "presets", backup))

    assert commit == {"kind": "presets", "presets_restored": 1}
    assert plugin._flush_requested is False
    names = {preset["name"] for preset in _presets(plugin)}
    assert "coastal" in names
    assert "temp" not in names
    assert {"DefaultStarboard180", "windy"}.issubset(names)
    assert (tmp_path / "presets.json").exists()


def test_unknown_or_absent_kind_is_rejected(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)

    assert request(plugin, "import/begin", kind="bogus")["status"] == "ERROR"
    assert plugin._handle_request("import/begin", object(), {})["status"] == "ERROR"


def test_chunk_without_active_import_is_rejected(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)

    response = request(plugin, "import/chunk", token="x", seq="0", data="{}")  # noqa: S106  # synthetic test token

    assert response["status"] == "ERROR"
    assert "No import is in progress" in str(response["error"])


def test_token_mismatch_clears_staging(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)
    response_data(request(plugin, "import/begin", kind="learned-data"))

    mismatch = request(plugin, "import/chunk", token="wrong", seq="0", data="{}")  # noqa: S106  # synthetic test token

    assert mismatch["status"] == "ERROR"
    assert plugin._import_token is None


def test_post_abort_use_is_rejected(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)
    begin = response_data(request(plugin, "import/begin", kind="learned-data"))
    token = str(begin["token"])
    assert request(plugin, "import/abort")["status"] == "OK"

    response = request(plugin, "import/chunk", token=token, seq="0", data="{}")

    assert response["status"] == "ERROR"


def test_seq_gap_is_rejected(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)
    begin = response_data(request(plugin, "import/begin", kind="learned-data"))
    token = str(begin["token"])

    response = request(plugin, "import/chunk", token=token, seq="1", data="{}")

    assert response["status"] == "ERROR"
    assert "out of order" in str(response["error"])


def test_byte_cap_overflow_is_rejected(tmp_path: Path, monkeypatch: Any) -> None:
    monkeypatch.setattr(import_common, "MAX_IMPORT_BYTES", 8)
    plugin, _api = make_plugin(tmp_path)
    begin = response_data(request(plugin, "import/begin", kind="learned-data"))
    token = str(begin["token"])

    response = request(plugin, "import/chunk", token=token, seq="0", data="0123456789")

    assert response["status"] == "ERROR"
    assert "size limit" in str(response["error"])
    assert plugin._import_token is None


def test_chunk_cap_overflow_is_rejected(tmp_path: Path, monkeypatch: Any) -> None:
    monkeypatch.setattr(plugin_module.Plugin, "MAX_IMPORT_CHUNKS", 1)
    plugin, _api = make_plugin(tmp_path)
    begin = response_data(request(plugin, "import/begin", kind="learned-data"))
    token = str(begin["token"])

    assert request(plugin, "import/chunk", token=token, seq="0", data="a")["status"] == "OK"
    overflow = request(plugin, "import/chunk", token=token, seq="1", data="b")

    assert overflow["status"] == "ERROR"
    assert "too many chunks" in str(overflow["error"])


def test_idle_expiry_is_rejected(tmp_path: Path) -> None:
    monotonic = FakeClock(100.0)
    plugin, _api = make_plugin(tmp_path, monotonic=monotonic)
    begin = response_data(request(plugin, "import/begin", kind="learned-data"))
    token = str(begin["token"])
    monotonic.advance(plugin_module.Plugin.IMPORT_IDLE_TIMEOUT_SECONDS + 1.0)

    response = request(plugin, "import/chunk", token=token, seq="0", data="{}")

    assert response["status"] == "ERROR"
    assert "expired" in str(response["error"])


def test_commit_without_confirm_keeps_staging(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)
    raw = polar_backup()
    begin = response_data(request(plugin, "import/begin", kind="learned-data"))
    token = str(begin["token"])
    assert request(plugin, "import/chunk", token=token, seq="0", data=raw)["status"] == "OK"

    denied = request(plugin, "import/commit", token=token, confirm="no")
    assert denied["status"] == "ERROR"
    assert plugin._import_token == token

    confirmed = request(plugin, "import/commit", token=token, confirm="yes")
    assert confirmed["status"] == "OK"


def test_malformed_polar_leaves_model_intact(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)
    plugin._model.bins[(45, 8)] = Bin(twa_deg=45, tws_kt=8, total_accepted=7)

    response = upload(plugin, "learned-data", "not a backup")

    assert response["status"] == "ERROR"
    assert plugin._model.bins[(45, 8)].total_accepted == 7
    assert plugin._import_token is None


def test_malformed_presets_leaves_presets_intact(tmp_path: Path) -> None:
    plugin, _api = make_plugin(tmp_path)
    request(plugin, "presets/save", name="keep", twa="0,90", tws="6")

    response = upload(plugin, "presets", '{"schema_version": 1, "presets": "oops"}')

    assert response["status"] == "ERROR"
    assert "keep" in {preset["name"] for preset in _presets(plugin)}


def test_boot_error_recovers_on_valid_polar_restore(tmp_path: Path) -> None:
    payload = persistence.serialize_to_dict(
        PolarModel(), Counters(), persistence.PersistenceMetadata()
    )
    payload["schema_version"] = persistence.CURRENT_SCHEMA_VERSION + 1
    (tmp_path / persistence.PRIMARY_NAME).write_text(json.dumps(payload), encoding="utf-8")
    plugin, api = make_plugin(tmp_path)
    assert plugin._startup_error_active is True

    commit = upload(plugin, "learned-data", polar_backup())

    assert commit["status"] == "OK"
    assert plugin._startup_error_active is False
    assert api.statuses[-1] == ("STARTED", "Polar Recorder started")


def _presets(plugin: plugin_module.Plugin) -> list[dict[str, object]]:
    data = response_data(request(plugin, "presets"))
    presets = data["presets"]
    assert isinstance(presets, list)
    return presets
