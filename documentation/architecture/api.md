# API Shape

**Status:** Current.

## Overview

Polar Recorder exposes one AvNav plugin request handler below
`/plugins/polarrecorder/api/<endpoint>`. `plugin.py` normalizes AvNav's
list-valued query args to scalar strings, snapshots live state under its lock,
and formats read responses outside the lock through pure helpers.

## Key Details

AvNav request-handler contract:

- `AVNApi.getBaseUrl()` documents that appending `/api` reaches plugin API
  requests. For Polar Recorder the design URL is
  `/plugins/polarrecorder/api/<endpoint>`.
- A plugin registers one callback with `api.registerRequestHandler(callback)`;
  registering again replaces the previous handler.
- AvNav routes paths beginning with `api` to the plugin callback and invokes it
  with `(url, handler, args)`, where `url` is the path after `/api/`.
- AvNav builds query parameters with `urllib.parse.parse_qs(query, True)`, so
  values are lists and blank values are preserved.
- When a plugin request handler returns a `dict`, AvNav serializes it with
  `json.dumps()` and returns JSON.
- Polar Recorder's OK/ERROR envelopes are a project convention layered on top
  of AvNav's dict-to-JSON behavior.

All endpoints return dictionaries for AvNav to serialize as JSON. Success
responses use `{"status": "OK", "data": ...}`. Application errors use
`{"status": "ERROR", "error": "..."}`. Unexpected exceptions are caught at the
`plugin.py` request boundary and returned as `Internal error`.

AvNav supplies request parameters from `parse_qs(..., keep_blank_values=True)`,
so raw values are lists. `plugin.py` takes the first value per key before
dispatch. Blank values remain blank strings and fail normal validation, such as
`confirm=yes`.

Endpoints:

| Method | Endpoint | Params | Response data |
|---|---|---|---|
| GET | `status` | none | Recording flags, `data_status`, `warming_up`, uptime, current finite values plus ages/stale flags, current decision or `null`, counters plus acceptance rate, top rejections, persistence status, generation. |
| GET | `polar` | `format` optional named preset, `percentile` optional 1-99 | `{format, percentile, generation, tws_bands, curves}`. TWA spans the full circle 0-359 by array index; curves are keyed by TWS string and contain `null` or `{stw, samples}`. |
| GET | `rejections` | none | `{global, per_bin}` histograms. Per-bin keys are `"<twa>_<tws>"`. |
| GET | `timeline` | `minutes` optional integer 1-240, default 240 | `{buckets}` oldest first, with minute wall time `t`, decision counts, and reason-code counts. |
| GET | `export` | `format`, or inline `twa`+`tws`; optional `percentile`; optional `high_confidence=yes|true|1` | `{csv}` containing semicolon-delimited CSV. Circular grids emit TWA rows above 180 deg. |
| GET | `config` | none | Parsed runtime config values in native JSON types. |
| GET | `presets` | none | Built-in presets (`DefaultStarboard180`, `DefaultPort180`, `Default360`, `windy`) first, then user presets, as `{name, builtin, twa, tws}` entries. |
| GET | `presets/save` | `name`, `twa`, `tws` | Saves or overwrites a user preset and returns the saved preset. TWA values 0-359 are accepted. |
| GET | `presets/delete` | `name`, `confirm=yes` | Deletes a user preset. Built-in presets cannot be deleted. |
| GET | `reset` | `confirm=yes` required | Clears learned model and counters, keeps timeline and validation state, and sets `_flush_requested` for the plugin thread. |
| GET | `pause` | none | Idempotently pauses recording. |
| GET | `resume` | none | Idempotently resumes recording when `record_enabled` allows it. |
| GET | `export/json` | none | Full persistence-schema JSON backup, produced under the lock by `persistence.serialize_to_dict`. |
| GET | `export/presets` | none | User export presets in the `presets.json` backup shape `{schema_version, presets:{name:{twa,tws}}}`. Built-ins are excluded so the download re-imports cleanly. |
| GET | `import/begin` | `kind=learned-data\|presets` | Starts a chunked upload: discards any prior staging and returns `{token, kind, max_bytes, max_chunks}`. |
| GET | `import/chunk` | `token`, `seq` (contiguous from 0), `data` (URL-encoded slice) | Appends one slice under the lock. Returns `{received, bytes}`. Any rejection clears staging. |
| GET | `import/commit` | `token`, `confirm=yes` | Assembles, validates, and applies the staged backup by `kind`. Learned-data returns `{kind, bins_restored, total_accepted, migrated_from_version}`; presets returns `{kind, presets_restored}`. An unconfirmed commit errors but keeps staging. |
| GET | `import/abort` | none | Clears staging idempotently. |
| GET | `enhanced/keys` | none | `{keys}` sorted list of currently-present store keys, enumerated via `api.getDataByPrefix` for `gps` plus any configured enhanced-key prefixes, flattened to dotted keys. |
| GET | `enhanced/status` | none | `{rules}` one row per enhanced rule with `rule`, `enable_field` (the rule's enable parameter name), `enabled`, `combinator`, `keys` (each `{field, key}`), `thresholds`, and `status`. |
| GET | `enhanced/save` | enhanced parameter name/value pairs | Validates names against the enhanced allowlist (fail-closed on unknown names), self-applies the parsed config under the lock, then persists via `api.saveConfigValues`. Returns `{config}` with the saved enhanced values. |

Restore is implemented as a strict, fail-closed, replace-only flow for both the
polar model and user presets. Because AvNav plugin URLs receive GET/HEAD only
(POST is rejected upstream) and a single GET request line is length-bounded, a
backup is uploaded in slices over several GETs, staged under the `plugin.py` lock
with a `kind` discriminator, and validated by pure domain modules before being
applied. Validation failures (`RestoreError`, `BackupError`, `ExportError`) are
surfaced verbatim in the error envelope. See
[import-restore.md](import-restore.md) for the full protocol and rules.

`GET polar` is preset-only: `format` is absent or a named preset. Inline TWA/TWS
grids are not accepted by the polar endpoint. Projection uses the resolved
preset's TWA grid, so each curve carries projected cells only at the preset TWA
columns the viewer plots, and a TWS enters `tws_bands` only when one of those
preset columns has data. The response uses a 360 entry TWA curve array per
populated TWS band, with array index equal to absolute TWA 0-359, so projected
port cells (181-359 deg) are addressable; non-preset indices are
`null`. Each populated band is anchored at index 0 with `{stw: 0.0, samples: 0}`
so the curve starts at 0 deg TWA / 0 STW. This anchor is the shared
`export.anchor_origin` boundary condition (head to wind is 0 STW) applied to the
projection that both `GET polar` and `GET export` consume: it is added only for
bands that already carry data and never overwrites a real cell, so it never
creates a band. When the requested TWA grid includes 0 deg, `GET export` emits
`0.0` in the TWA 0 row of every populated band; grids without 0 deg omit the row.

`GET export` mode resolution is deterministic: inline `twa`+`tws` wins and
cannot be combined with `format`; otherwise `format` resolves first against the
case-insensitive built-in set (`DefaultStarboard180`, `DefaultPort180`,
`Default360`, `windy`, plus the pre-rename `Default180` alias) and then
case-sensitive user presets; absent mode defaults to `DefaultStarboard180`.
One-sided inline grids are errors. Inline and saved `twa` grids accept values
0-359.

`GET polar` and default `GET export` share the same projection function,
configured percentile, and `MIN_SAMPLES_DISPLAY = 3` floor. Projection never
folds: it carries true 0-359 TWA. A non-circular (180 deg) grid merges starboard
bins by linear midpoint boundaries capped at 180 deg, excluding port bins; a
circular grid (any TWA above 180 deg) assigns each raw bin to its nearest grid
point on the circle, including the 360 deg/0 deg wrap. Both use the fixed TWS
upper bound `TWS_BIN_MAX = 60` for the last TWS interval. `high_confidence=yes`,
`true`, or `1` affects CSV export only and swaps the floor to
`min_samples_for_export`.

No response may contain non-finite floats. Current values are updated only from
a built finite `Sample`; later missing or non-finite reads leave the previous
finite values frozen. Histogram speeds originate from accepted finite samples,
and timeline/counter values are integers.

The enhanced endpoints back the Settings-tab "Enhanced Rules" section. `enhanced/keys`
enumerates only currently-present store keys (AvNav exposes no list-all-registered-keys
endpoint), so the viewer offers them as dropdown options and also allows free-text entry for
custom keys (RPM, engine state, heel) that are not standard AvNav keys. `enhanced/status`
computes each key's presence/freshness at the boundary (snapshotting `self.config` under the
lock, probing via `getSingleValue`) and resolves the per-rule live status in the pure
`enhanced_status` module outside the lock. `enhanced/save` self-applies first (sets
`self.config` under the lock) and then calls `api.saveConfigValues` after releasing the lock;
`saveConfigValues` only persists to disk and does not invoke the change callback, so there is no
lock re-entrancy and the disk write never runs while the lock is held.

State mutations use GET for AvNav/viewer simplicity. Destructive reset requires
`confirm=yes`; preset deletion also requires confirmation. Polar persistence
writes still happen on the plugin thread. Preset writes are the exception:
`plugin.py` holds its lock while `export.py` performs the `presets.json`
read-modify-atomic-write so concurrent HTTP worker threads cannot collide.
Reset does not write to disk on the HTTP thread; it only sets `_flush_requested`
so the plugin thread performs the next polar-file flush. `export/json` likewise
keeps live model access under the lock: `plugin.py` calls
`persistence.serialize_to_dict(...)` while locked, then the pure API formatter
wraps the finished dict.

## Related

- [Plugin lifecycle](plugin-lifecycle.md)
- [Request routing and static files](../avnav/request-routing-and-static-files.md)
- [Persistence](persistence.md)
- [Import and restore](import-restore.md)
- [Export and import](../user/export-import.md)
