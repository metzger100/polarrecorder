"""Module: Plugin - Thin AvNav integration shell.

Documentation: documentation/architecture/plugin-lifecycle.md
Depends: polarrecorder
"""

from __future__ import annotations

import json
import logging
import sys
import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, ClassVar, NamedTuple

_plugin_path = Path(__file__).resolve().parent
_plugin_dir = str(_plugin_path)
_server_dir = str(_plugin_path / "server")
if _server_dir not in sys.path:
    sys.path.insert(0, _server_dir)

from polarrecorder import api_dispatch, commit, export, persistence, preset_backup, reader, restore
from polarrecorder.config import Config, parse_config_values
from polarrecorder.counters import Counters
from polarrecorder.logger import AvNavLogger
from polarrecorder.params import CONFIG_PARAMETERS, EDITABLE_PARAMETERS
from polarrecorder.polar_model import PolarModel
from polarrecorder.sample import ReadResult, Sample, build_sample
from polarrecorder.timeline import Timeline
from polarrecorder.validation import pipeline
from polarrecorder.validation.state import ValidationState

if TYPE_CHECKING:
    from collections.abc import Mapping
    from os import PathLike

    from avnav_api import AVNApi
    from polarrecorder.validation.pipeline import PipelineResult

DESCRIPTION = (
    "Polar Recorder: automatically learns your boat's sailing polar "
    "(TWA/TWS → boat speed) from live NMEA data with no user interaction."
)
FALLBACK_VERSION = "0.0.0-dev"
INCOMPLETE_DEMOTE_COUNT = 30
QUEUE_WAIT_SECONDS = 0.5
USER_APP_URL = "viewer/viewer.html"
USER_APP_ICON = "viewer/icon.svg"
USER_APP_TITLE = "Polar Recorder"


class _CurrentValues(NamedTuple):
    twa_deg: float
    tws_kt: float
    stw_kt: float
    twa_timestamp: float
    tws_timestamp: float
    stw_timestamp: float


class Plugin:
    """AvNav plugin entry point."""

    _description: ClassVar[str] = DESCRIPTION
    MAX_IMPORT_CHUNKS: ClassVar[int] = 4096
    IMPORT_IDLE_TIMEOUT_SECONDS: ClassVar[float] = 120.0

    @classmethod
    def pluginInfo(cls) -> dict[str, object]:
        """Return AvNav plugin metadata."""
        return {"description": cls._description, "version": _read_plugin_version()}

    def __init__(self, api: AVNApi) -> None:
        """Register AvNav callbacks and initialize in-memory state."""
        self.api: Any = api
        self._clock = time.monotonic
        self._wall_clock = time.time
        self._lock = threading.Lock()
        self._logger = AvNavLogger(api)
        self._status_value = ""
        self._status_info = ""
        self._startup_error_active = False
        self._stop_requested = False
        self._flush_requested = False
        self._paused = False
        self._incomplete_reads = 0
        self._run_start_monotonic = self._clock()
        self._data_dir: str | PathLike[str] = _plugin_path / "data"
        api.registerEditableParameters(EDITABLE_PARAMETERS, self._on_config_change)
        self.config = self._load_initial_config()
        self._state = ValidationState(float(self.config.stability_window_seconds))
        self._timeline = Timeline(self._wall_clock)
        self._last_current_values: _CurrentValues | None = None
        self._last_decision: dict[str, object] | None = None
        self._warming_up = True
        self._last_data_status = "no_data"
        self._last_flush_wall = 0.0
        self._last_flush_size_bytes = 0
        self._created_wall: float | None = None
        self._pending_flush_wall = 0.0
        self._pending_created_wall = 0.0
        self._model = PolarModel()
        self._counters = Counters()
        self._import_token: str | None = None
        self._import_kind: str | None = None
        self._import_parts: list[str] = []
        self._import_bytes = 0
        self._import_last_activity = 0.0
        self._user_app_registered = False
        api.registerRequestHandler(self._handle_request)
        api.registerRestart(self._restart)
        self._load_persistence()

    def run(self) -> None:
        """Run the AvNav sampling loop until AvNav requests shutdown."""
        self._stop_requested = False
        self._run_start_monotonic = self._clock()
        self._register_user_app()
        if not self._startup_error_active:
            self._set_status("STARTED", "Polar Recorder started")
        sequence = 0
        last_sample_monotonic = self._run_start_monotonic - self.config.sample_interval
        last_flush_monotonic = self._run_start_monotonic
        while not self.api.shouldStopMainThread() and not self._stop_requested:
            sequence, _data = self.api.fetchFromQueue(sequence, waitTime=QUEUE_WAIT_SECONDS)
            now = self._clock()
            config = self.config
            if now - last_sample_monotonic < config.sample_interval:
                continue
            last_sample_monotonic = now
            try:
                self._run_iteration(config)
                if now - last_flush_monotonic >= config.flush_interval or self._flush_requested:
                    self._flush()
                    last_flush_monotonic = now
            except Exception as exc:
                self.api.error("Polar Recorder loop error: %s", exc)
        self._flush()

    def _register_user_app(self) -> None:
        """Publish the viewer as an AvNav user app through the Python plugin API.

        This is the registration path every AvNav core honors, including cores
        that neither read ``plugin.json`` nor load ``plugin.mjs``. Cores that do
        load ``plugin.mjs`` de-duplicate against this AddOn, and older cores
        without the API skip registration instead of failing.
        """
        if self._user_app_registered:
            return
        register = getattr(self.api, "registerUserApp", None)
        if register is None:
            return
        base_url = self.api.getBaseUrl()
        register(f"{base_url}/{USER_APP_URL}", USER_APP_ICON, USER_APP_TITLE)
        self._user_app_registered = True

    def _run_iteration(self, config: Config) -> None:
        store_reader = reader.StoreReader(
            self.api, self._clock, self._wall_clock, self._logger, config
        )
        read_result = store_reader.read()
        data_status = _data_status(read_result)
        if self._paused:
            self._record_suppressed(read_result, data_status, "reject_user_paused")
            return
        pipeline_result, sample = pipeline.run(read_result, self._state, config)
        warming_now = sample.timestamp_monotonic if sample is not None else self._clock()
        warming_up = self._state.is_warming_up(warming_now)
        if sample is not None:
            self._state.observe(sample)
        if config.debug_logging:
            message = (
                f"sample decision={pipeline_result.decision} "
                f"reasons={','.join(pipeline_result.reason_codes)}"
            )
            self._logger.debug(message)
        with self._lock:
            commit.commit_sample(pipeline_result, sample, self._model)
            self._record_counters(pipeline_result)
            self._timeline.record(pipeline_result.decision, pipeline_result.reason_codes)
            self._write_status_scalars(read_result, sample, data_status, warming_up)
            self._last_decision = {
                "state": pipeline_result.decision,
                "reason_codes": list(pipeline_result.reason_codes),
            }
        self._update_avnav_status(data_status, pipeline_result)

    def _record_suppressed(self, read_result: ReadResult, data_status: str, reason: str) -> None:
        sample = build_sample(read_result)
        warming_now = sample.timestamp_monotonic if sample is not None else self._clock()
        warming_up = self._state.is_warming_up(warming_now)
        if sample is not None:
            self._state.observe(sample)
        with self._lock:
            self._counters.record_non_candidate([reason])
            self._timeline.record("rejected", [reason])
            self._write_status_scalars(read_result, sample, data_status, warming_up)
        self._update_avnav_status(data_status, None)

    def _record_counters(self, pipeline_result: PipelineResult) -> None:
        if pipeline_result.decision == "accepted":
            self._counters.record_accepted()
        elif pipeline_result.decision == "quarantined":
            self._counters.record_quarantined(pipeline_result.reason_codes[0])
        elif pipeline_result.is_sailing_candidate:
            self._counters.record_rejected(pipeline_result.reason_codes)
        else:
            self._counters.record_non_candidate(pipeline_result.reason_codes)

    def _write_status_scalars(
        self,
        read_result: ReadResult,
        sample: Sample | None,
        data_status: str,
        warming_up: bool,
    ) -> None:
        if sample is not None:
            assert read_result.twa_timestamp is not None
            assert read_result.tws_timestamp is not None
            assert read_result.stw_timestamp is not None
            self._last_current_values = _CurrentValues(
                twa_deg=sample.twa_deg_raw,
                tws_kt=sample.tws_kt,
                stw_kt=sample.stw_kt,
                twa_timestamp=read_result.twa_timestamp,
                tws_timestamp=read_result.tws_timestamp,
                stw_timestamp=read_result.stw_timestamp,
            )
        self._last_data_status = data_status
        self._warming_up = warming_up

    def _update_avnav_status(
        self,
        data_status: str,
        pipeline_result: PipelineResult | None,
    ) -> None:
        if self._startup_error_active:
            return
        if data_status == "receiving":
            self._incomplete_reads = 0
            if self._status_value == "STARTED":
                self._set_status("RUNNING", "Receiving instrument data")
        else:
            self._incomplete_reads += 1
            if self._incomplete_reads >= INCOMPLETE_DEMOTE_COUNT:
                self._set_status("STARTED", "No instrument data")
        if pipeline_result is not None and pipeline_result.decision == "accepted":
            self._set_status("NMEA", "Recording sailing polar")

    def _flush(self) -> None:
        payload = self._flush_payload()
        size = persistence.save(self._data_dir, payload, logger=self._logger)
        with self._lock:
            if size is not None:
                self._last_flush_size_bytes = size
                self._last_flush_wall = self._pending_flush_wall
                self._created_wall = self._pending_created_wall
            self._flush_requested = False

    def _flush_payload(self) -> persistence.SerializedDict:
        flush_wall = self._wall_clock()
        with self._lock:
            created_wall = self._created_wall if self._created_wall is not None else flush_wall
            self._pending_flush_wall = flush_wall
            self._pending_created_wall = created_wall
            metadata = persistence.PersistenceMetadata(
                plugin_version=_read_plugin_version(),
                created_wall=created_wall,
                last_flush_wall=flush_wall,
                percentile=self.config.percentile,
                max_tws=self.config.max_tws,
            )
            return persistence.serialize_to_dict(self._model, self._counters, metadata)

    def _load_initial_config(self) -> Config:
        raw_values = {
            str(spec["name"]): str(self.api.getConfigValue(str(spec["name"]), str(spec["default"])))
            for spec in CONFIG_PARAMETERS
        }
        return parse_config_values(raw_values, self._logger)

    def _load_persistence(self) -> None:
        result = persistence.load(self._data_dir, self._logger)
        self._model = result.model
        self._counters = result.counters
        self._created_wall = result.created_wall
        self._last_flush_wall = result.last_flush_wall
        self._last_flush_size_bytes = result.file_size_bytes
        if result.status in {"corrupt_empty", "schema_too_new"}:
            self._startup_error_active = True
            self._set_status("ERROR", result.status_message)
        else:
            self._startup_error_active = False

    def _reset_import_staging(self) -> None:
        self._import_token = None
        self._import_kind = None
        self._import_parts = []
        self._import_bytes = 0
        self._import_last_activity = 0.0

    def _apply_learned_data_restore(self, assembled: str) -> dict[str, object]:
        result = restore.validate_and_build(assembled)
        with self._lock:
            result.model.generation = self._model.generation + 1
            self._model = result.model
            self._counters = result.counters
            self._created_wall = result.created_wall
            self._flush_requested = True
            recovered = self._startup_error_active
            self._startup_error_active = False
        if recovered:
            self._set_status("STARTED", "Polar Recorder started")
        return {
            "kind": "learned-data",
            "bins_restored": result.bins_restored,
            "total_accepted": result.total_accepted,
            "migrated_from_version": result.migrated_from_version,
        }

    def _apply_presets_restore(self, assembled: str) -> dict[str, object]:
        presets = preset_backup.validate_presets(assembled, self.config.max_tws)
        with self._lock:
            export.replace_user_presets(self._data_dir, presets, self._logger)
        return {"kind": "presets", "presets_restored": len(presets)}

    def _on_config_change(self, changed: Mapping[str, str]) -> None:
        with self._lock:
            self.config = parse_config_values(changed, self._logger, self.config)
            self._state.stability_window_seconds = float(self.config.stability_window_seconds)

    def _handle_request(
        self,
        url: str,
        handler: object,
        args: Mapping[str, object],
    ) -> dict[str, object]:
        del handler
        try:
            return api_dispatch.handle_request(self, url, _normalize_args(args))
        except Exception as exc:
            self.api.error("Polar Recorder request error: %s", exc)
            return {"status": "ERROR", "error": "Internal error"}

    def _restart(self) -> None:
        self._stop_requested = True

    def _set_status(self, value: str, info: str) -> None:
        if self._status_value != value or self._status_info != info:
            self.api.setStatus(value, info)
            self._status_value = value
            self._status_info = info


def _read_plugin_version() -> str:
    plugin_json = Path(_plugin_dir) / "plugin.json"
    fallback = FALLBACK_VERSION
    try:
        with plugin_json.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        logging.warning("Could not read polarrecorder plugin.json version: %s", exc)
        return fallback
    if not isinstance(data, dict):
        logging.warning("Could not read polarrecorder plugin.json version")
        return fallback
    version = data.get("version")
    if version is None:
        version = fallback
    elif not isinstance(version, str):
        logging.warning("Could not read polarrecorder plugin.json version")
        version = fallback
    return version


def _normalize_args(args: Mapping[str, object]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in args.items():
        if isinstance(value, list):
            normalized[key] = str(value[0]) if value else ""
        else:
            normalized[key] = str(value)
    return normalized


def _data_status(read_result: ReadResult) -> str:
    present = [
        read_result.twa_raw is not None,
        read_result.tws_raw is not None,
        read_result.stw_raw is not None,
    ]
    if all(present):
        return "receiving"
    if any(present):
        return "partial"
    return "no_data"
