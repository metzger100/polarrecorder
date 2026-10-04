from __future__ import annotations

import json
from typing import TYPE_CHECKING

from conftest import FakeAvNavAPI, FakeClock
from plugin_integration_support import LoopAvNavAPI, make_plugin, response_data, sample_at
from polarrecorder import persistence
from polarrecorder.counters import Counters
from polarrecorder.polar_model import PolarModel

if TYPE_CHECKING:
    from pathlib import Path

    import plugin as plugin_module

FLUSH_INTERVAL_SECONDS = 60
LOOP_FETCHES = 150


def test_schema_too_new_boot_never_rewrites_polar_json(tmp_path: Path) -> None:
    primary = _write_schema_too_new_primary(tmp_path)
    original = primary.read_bytes()
    api = _loop_api()
    plugin = make_plugin(tmp_path, api)

    plugin.run()

    assert api.fetches == LOOP_FETCHES > 2 * FLUSH_INTERVAL_SECONDS
    assert plugin._startup_error_active is True
    assert plugin._counters.total_accepted > 0
    assert plugin._flush_requested is False
    assert primary.read_bytes() == original
    assert not (tmp_path / persistence.BACKUP_NAME).exists()
    assert not (tmp_path / persistence.TMP_NAME).exists()


def test_both_corrupt_boot_never_rewrites_either_file(tmp_path: Path) -> None:
    primary = tmp_path / persistence.PRIMARY_NAME
    backup = tmp_path / persistence.BACKUP_NAME
    primary.write_text("{bad primary", encoding="utf-8")
    backup.write_text("{bad backup", encoding="utf-8")
    api = _loop_api()
    plugin = make_plugin(tmp_path, api)

    plugin.run()

    assert plugin._startup_error_active is True
    assert primary.read_text(encoding="utf-8") == "{bad primary"
    assert backup.read_text(encoding="utf-8") == "{bad backup"


def test_reset_during_startup_error_resumes_writes(tmp_path: Path) -> None:
    primary = _write_schema_too_new_primary(tmp_path)
    api = FakeAvNavAPI()
    plugin = make_plugin(tmp_path, api)
    assert plugin._startup_error_active is True

    reset = plugin._handle_request("reset", object(), {"confirm": ["yes"]})
    plugin._flush()

    assert reset == {"status": "OK", "data": {}}
    assert plugin._startup_error_active is False
    assert api.statuses[-1] == ("STARTED", "Polar Recorder started")
    written = json.loads(primary.read_text(encoding="utf-8"))
    assert written["schema_version"] == persistence.CURRENT_SCHEMA_VERSION
    assert written["bins"] == {}
    assert plugin._flush_requested is False


def test_learned_data_restore_during_startup_error_writes_on_next_flush(tmp_path: Path) -> None:
    primary = _write_schema_too_new_primary(tmp_path)
    plugin = make_plugin(tmp_path, FakeAvNavAPI())

    commit = _restore_learned_data(plugin, _backup_with_one_bin())
    plugin._flush()

    assert commit["status"] == "OK"
    assert plugin._startup_error_active is False
    written = json.loads(primary.read_text(encoding="utf-8"))
    assert written["schema_version"] == persistence.CURRENT_SCHEMA_VERSION
    assert list(written["bins"]) == ["90_12"]


def _loop_api() -> LoopAvNavAPI:
    api = LoopAvNavAPI(
        max_fetches=LOOP_FETCHES,
        monotonic=FakeClock(100.0),
        wall=FakeClock(1000.0),
    )
    api.config["flush_interval"] = str(FLUSH_INTERVAL_SECONDS)
    return api


def _write_schema_too_new_primary(tmp_path: Path) -> Path:
    payload = persistence.serialize_to_dict(
        PolarModel(), Counters(), persistence.PersistenceMetadata()
    )
    payload["schema_version"] = persistence.CURRENT_SCHEMA_VERSION + 1
    primary = tmp_path / persistence.PRIMARY_NAME
    primary.write_text(json.dumps(payload), encoding="utf-8")
    return primary


def _backup_with_one_bin() -> str:
    model = PolarModel()
    sample = sample_at(100.0, 1000.0)
    assert sample is not None
    model.update_accepted(sample)
    payload = persistence.serialize_to_dict(model, Counters(), persistence.PersistenceMetadata())
    return json.dumps(payload)


def _restore_learned_data(plugin: plugin_module.Plugin, raw: str) -> dict[str, object]:
    begin = response_data(
        plugin._handle_request("import/begin", object(), {"kind": ["learned-data"]})
    )
    token = [str(begin["token"])]
    chunk = plugin._handle_request(
        "import/chunk", object(), {"token": token, "seq": ["0"], "data": [raw]}
    )
    assert chunk["status"] == "OK"
    return plugin._handle_request("import/commit", object(), {"token": token, "confirm": ["yes"]})
