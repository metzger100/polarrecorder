# API Shape

**Status:** Complete for Phase 8 API endpoints.

## Overview

Polar Recorder exposes one AvNav plugin request handler below
`/plugins/polarrecorder/api/<endpoint>`. `plugin.py` normalizes AvNav's
list-valued query args to scalar strings, snapshots live state under its lock,
and formats read responses outside the lock through pure helpers.

## Key Details

Source-verified AvNav request-handler facts from Phase 2:

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

All MVP endpoints return dictionaries for AvNav to serialize as JSON. Success
responses use `{"status": "OK", "data": ...}`. Application errors use
`{"status": "ERROR", "error": "..."}`. Unexpected exceptions are caught at the
`plugin.py` request boundary and returned as `Internal error`.

AvNav supplies request parameters from `parse_qs(..., keep_blank_values=True)`,
so raw values are lists. `plugin.py` takes the first value per key before
dispatch. Blank values remain blank strings and fail normal validation, such as
`confirm=yes`.

MVP endpoints:

| Method | Endpoint | Params | Response data |
|---|---|---|---|
| GET | `status` | none | Recording flags, `data_status`, `warming_up`, uptime, current finite values plus ages/stale flags, current decision or `null`, counters plus acceptance rate, top rejections, persistence status, generation. |
| GET | `polar` | `format` optional named preset, `percentile` optional 1-99 | `{format, percentile, generation, tws_bands, curves}`. TWA is always 0-180 by array index; curves are keyed by TWS string and contain `null` or `{stw, samples}`. |
| GET | `rejections` | none | `{global, per_bin}` histograms. Per-bin keys are `"<twa>_<tws>"`. |
| GET | `timeline` | `minutes` optional integer 1-240, default 240 | `{buckets}` oldest first, with minute wall time `t`, decision counts, and reason-code counts. |
| GET | `export` | `format`, or inline `twa`+`tws`; optional `percentile`; optional `high_confidence=yes|true|1` | `{csv}` containing semicolon-delimited Windy-compatible CSV. |
| GET | `config` | none | Parsed runtime config values in native JSON types. |
| GET | `presets` | none | Windy built-in plus user presets as `{name, builtin, twa, tws}` entries. |
| GET | `presets/save` | `name`, `twa`, `tws` | Saves or overwrites a user preset and returns the saved preset. |
| GET | `presets/delete` | `name`, `confirm=yes` | Deletes a user preset. Windy cannot be deleted. |
| GET | `reset` | `confirm=yes` required | Clears learned model and counters, keeps timeline and validation state, and sets `_flush_requested` for the plugin thread. |
| GET | `pause` | none | Idempotently pauses recording. |
| GET | `resume` | none | Idempotently resumes recording when `record_enabled` allows it. |
| GET | `export/json` | none | Full persistence-schema JSON backup, produced under the lock by `persistence.serialize_to_dict`. |

There is no import/restore endpoint in Phase 8. Restore from a JSON backup is
Post-MVP.

`GET polar` is preset-only: `format` is absent or a named preset. Inline TWA/TWS
grids are not accepted by the polar endpoint. The response always uses a 181
entry TWA curve array for each populated TWS band, with array index equal to TWA
0-180.

`GET export` mode resolution is deterministic: inline `twa`+`tws` wins and
cannot be combined with `format`; otherwise `format` resolves first against the
case-insensitive Windy built-in and then case-sensitive user presets; absent
mode defaults to Windy. One-sided inline grids are errors.

`GET polar` and default `GET export` share the same midpoint-boundary projection
function, configured percentile, and `MIN_SAMPLES_DISPLAY = 3` floor. Projection
folds raw 0-359 TWA bins to 0-180, merges neighboring bins by midpoint
boundaries across the requested TWA/TWS grid, and uses the fixed TWS upper bound
`TWS_BIN_MAX = 60` for the last TWS interval. `high_confidence=yes`, `true`, or
`1` affects CSV export only and swaps the floor to `min_samples_for_export`.

No response may contain non-finite floats. Current values are updated only from
a built finite `Sample`; later missing or non-finite reads leave the previous
finite values frozen. Histogram speeds originate from accepted finite samples,
and timeline/counter values are integers.

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
- [Persistence](persistence.md)
- [Export and import](../user/export-import.md)
