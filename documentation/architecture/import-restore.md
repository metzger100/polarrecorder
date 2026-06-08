# Import and Restore

**Status:** Current.

## Overview

Polar Recorder can restore two JSON backups from the Settings tab: the learned
polar model (`export/json`) and the user export presets (`export/presets`). Both
restores are strict, fail-closed, all-or-nothing, and **replace** their target.
Backups arrive over multiple GET requests because AvNav plugins cannot receive
POST and a single GET URL cannot carry a realistic backup; the bytes are staged
under the `plugin.py` lock, validated by pure domain modules, and applied only
when validation fully succeeds.

## Key Details

### Strict validation (vs. the tolerant startup loader)

Startup loading (`persistence.load`, `export._load_user_presets`) is deliberately
corruption-tolerant: it coerces values and skips bad entries. User import is the
opposite. `restore.validate_and_build` (polar) and `preset_backup.validate_presets`
(presets) are pure functions of the assembled backup string. They never coerce a
bad value; the first failure raises with a stable, user-readable reason and no
external state is touched.

Learned-data validation order (`server/polarrecorder/restore.py`):

1. Size gate — decoded bytes `<= MAX_IMPORT_BYTES` (4 MiB).
2. JSON-object gate — parses as JSON and is an object.
3. Provenance gate — int `schema_version`, a `config` object with
   `twa_bin_size`/`tws_bin_size`, a `bins` object, and a `counters` object; else
   rejected as "not a Polar Recorder backup".
4. Schema gate — `persistence.migrate_payload` migrates older schemas and rejects
   a too-new one; the pre-migration version is recorded for the summary.
5. Unknown-key gate — no unexpected top-level keys.
6. Grid gate — `config.twa_bin_size`/`tws_bin_size` must equal this build's
   `TWA_BIN_SIZE`/`TWS_BIN_SIZE`; a foreign grid is rejected.
7. Strict bin parse — bin address `0 <= twa <= 359`, `0 <= tws <= TWS_BIN_MAX`;
   integer histogram speeds/counts `>= 0`; finite `last_update_wall`.
8. Strict counters parse — typed, non-negative counter fields built directly
   (not via the tolerant `Counters.from_dict`).

Presets validation order (`server/polarrecorder/preset_backup.py`): size,
JSON-object, provenance (int `schema_version` and a `presets` object), schema
(`<= PRESET_SCHEMA_VERSION`), unknown-key, then per-preset parse. Each preset name
passes `export.validate_preset_name` (trimmed, 1-30 chars, allowed pattern,
reserved/built-in names rejected, not skipped) and each `twa`/`tws` array passes
`export.validate_grid_values` (strict integers — `bool` rejected — within range;
TWS bounded by the **live** `max_tws`). Duplicate normalized names are rejected.

Shared size/JSON/object/unknown-key gates live in
`server/polarrecorder/import_common.py` and raise `BackupError`. Polar-specific
failures raise `RestoreError` (a `BackupError` subclass); preset-specific failures
reuse `export.ExportError`. `api_dispatch.handle_request` catches both
`ExportError` and `BackupError` and returns the precise reason in the
`{"status":"ERROR","error":...}` envelope.

### Chunked-GET staging protocol

AvNav plugin URLs receive GET/HEAD only (POST is rejected upstream), and a single
GET request line is length-bounded, so a backup is uploaded in slices over several
GETs and reassembled server-side. `plugin.py` owns one lock-guarded staging buffer
with a `kind` discriminator and an upload token:

- `import/begin?kind=learned-data|presets` — discards any existing staging (last-writer
  wins), records the kind, returns a fresh `token`, `max_bytes`, and `max_chunks`.
- `import/chunk?token=&seq=&data=` — under the lock, rejects a missing/mismatched
  token, an idle-expired session (`IMPORT_IDLE_TIMEOUT_SECONDS`), a non-contiguous
  `seq`, a byte-cap overflow (`MAX_IMPORT_BYTES`), or a chunk-cap overflow
  (`MAX_IMPORT_CHUNKS`). Any chunk rejection clears staging. The `data` value is
  URL-decoded by AvNav before dispatch.
- `import/commit?token=&confirm=yes` — verifies the token, requires `confirm=yes`
  (an unconfirmed commit errors but **keeps** staging for a retry), assembles the
  parts, clears staging, then validates **outside** the lock and applies by kind.
- `import/abort` — clears staging idempotently.

### Apply paths (replace semantics)

- **Learned data** (`Plugin._apply_learned_data_restore`): on success, re-acquire the lock and
  swap `_model`, `_counters`, and `_created_wall`; set the new model's
  `generation` to the previous generation + 1 so polling viewers never see it go
  backwards; set `_flush_requested` so the plugin thread persists `polar.json`.
  `last_flush_wall` is not restored (the triggered flush stamps it). If the plugin
  booted into `_startup_error_active` (corrupt/too-new `polar.json`), restore
  clears it and sets the status to `STARTED`, so restore doubles as recovery.
- **Presets** (`Plugin._apply_presets_restore`): on success, re-acquire the lock
  and replace the entire user-preset set with one atomic `presets.json` write
  (`export.replace_user_presets`) on the HTTP worker thread. Built-in presets are
  excluded by validation and never written. No plugin-thread flush is involved.

The polar `config.percentile`/`max_tws` are treated as metadata only and never
overwrite live AvNav editable-parameter settings; only the `config` bin sizes are
consumed, as the grid-match gate.

## Related

- [API shape](api.md)
- [Persistence](persistence.md)
- [Export and import](../user/export-import.md)
- [Request routing and static files](../avnav/request-routing-and-static-files.md)
- [UI architecture](ui.md)
