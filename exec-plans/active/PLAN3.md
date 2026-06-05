# PLAN3 - JSON backup restore / import (validated, fail-closed)

**Status:** Active. Authoritative implementation source for ROADMAP item 1
("Restore / import flows") until moved to `exec-plans/completed/`. Prescriptive
parts: the verified baseline, hard constraints, phase deliverables, exit
conditions, and acceptance criteria. Flexible parts: helper names, internal
function decomposition, constant tuning within the stated bounds, and test-case
naming, provided the exit conditions and constraints hold.

This plan covers ROADMAP item 1 only. Items 2-5 (optional signal hooks, dashboard
widgets, dyninstruments palette) are explicitly out of scope and must not be
touched.

## Goal

User-visible outcomes after completion:

1. A user can upload a previously downloaded JSON backup from the **Settings** tab
   and restore the learned polar from it, completing the round-trip that
   `GET /api/export/json` only half-implements today.
2. Restore uses **replace** semantics: a valid backup fully replaces the current
   learned model and counters. It requires explicit confirmation (type `RESTORE`),
   mirroring the existing Reset confirmation.
3. Import is **fail-closed and all-or-nothing**: any wrong file, corrupted file,
   foreign-grid file, too-new schema, or out-of-range value is rejected with a
   precise, user-readable reason, and the currently learned model is left
   completely untouched. Nothing partial is ever applied.
4. A backup that is recognizably not a Polar Recorder backup (wrong JSON, missing
   the schema/config/bins shape) is rejected with a clear "not a Polar Recorder
   backup" message rather than silently producing an empty model.
5. On success the user sees a short summary (bins restored, total accepted
   samples, and the schema version the backup was migrated from, if any).

Repository-visible outcomes:

1. A new pure domain module `server/polarrecorder/restore.py` performs strict
   validation and builds a `PolarModel` + `Counters` from a backup string, with no
   AvNav import, no I/O, no locks, and no clock reads.
2. `plugin.py` owns a lock-guarded chunked-upload staging buffer and four new
   GET endpoints (`import/begin`, `import/chunk`, `import/commit`, `import/abort`),
   because AvNav plugin URLs cannot receive POST (Baseline 9) and a single GET URL
   cannot carry a realistic backup (Baseline 10).
3. The Settings tab replaces its disabled "Restore JSON (Post-MVP)" placeholder
   with a working file-picker + chunked-upload + confirm flow.
4. `tools/check-all.sh` is green, including ruff, `mypy --strict`, pytest, and the
   Node check scripts. A new `test_restore.py` plus import-flow integration tests
   assert validation rejection, the chunked transport, and an export->import
   round-trip equality.
5. `README.md` and the mapped documentation describe the restore flow, its
   replace semantics, and its limitations (replace-only, size cap, must match the
   running build's bin grid).

## Verified Baseline

Facts checked against current repository files, AvNav host source, and tooling.

1. `GET /api/export/json` already returns the full persistence schema via
   `persistence.serialize_to_dict`, produced under the lock
   ([api_dispatch.py:100-107](../../server/polarrecorder/api_dispatch.py#L100-L107)).
   The schema is a single object with `schema_version`, `plugin_version`,
   `created_wall`, `last_flush_wall`, a metadata `config` block
   (`percentile`, `twa_bin_size`, `tws_bin_size`, `max_tws`), `counters`, and
   sparse `bins` keyed `"{twa}_{tws}"`
   ([persistence.py:77-99](../../server/polarrecorder/persistence.py#L77-L99)).
2. Each serialized bin is `{histogram, total_accepted, total_rejected,
   total_quarantined, last_update_wall, rejection_histogram}`; `histogram` keys are
   integer deciknots and `rejection_histogram` keys are reason strings
   ([persistence.py:216-224](../../server/polarrecorder/persistence.py#L216-L224)).
3. There is **no** import/restore endpoint today; `ROUTES` has exactly thirteen
   GET routes and no body-consuming route
   ([api_dispatch.py:266-280](../../server/polarrecorder/api_dispatch.py#L266-L280)).
   The API doc states plainly "There is no import/restore endpoint"
   ([api.md:58](../../documentation/architecture/api.md#L58)).
4. The startup `load()` path is deliberately **corruption-tolerant**: it coerces
   strings to ints/floats (`_to_int`/`_to_float`), defaults missing fields, skips a
   non-dict `bins`/`histogram` silently, and recovers from `polar.backup.json`
   ([persistence.py:318-386](../../server/polarrecorder/persistence.py#L318-L386)).
   This tolerance is correct for startup but is **not** acceptable for user import,
   which must reject rather than coerce. A separate strict validator is required.
5. Schema versioning already exists: `CURRENT_SCHEMA_VERSION = 1`
   ([persistence.py:24](../../server/polarrecorder/persistence.py#L24)); `_migrate`
   raises `_SchemaTooNewError` for versions above current and runs an ordered
   migration ladder (`_MIGRATIONS = {0: _migrate_v0_to_v1}`, v0 being test-only)
   ([persistence.py:249-278](../../server/polarrecorder/persistence.py#L249-L278)).
   Both `_migrate` and `_SchemaTooNewError` are currently private.
6. The running build's bin grid is fixed: `TWA_BIN_SIZE = 1`, `TWS_BIN_SIZE = 1`,
   `TWS_BIN_MAX = 60` ([bins.py:11-13](../../server/polarrecorder/bins.py#L11-L13)).
   Bin addresses are `round(twa/TWA_BIN_SIZE) % 360` (so TWA 0-359) and tws clamped
   `0..TWS_BIN_MAX` ([bins.py:32-38](../../server/polarrecorder/bins.py#L32-L38)).
   A backup whose `config` bin sizes differ from these addresses its bins on a
   foreign grid and must be rejected.
7. `PolarModel` exposes `bins`, `reset()`, `snapshot_bins()`, `iter_bins()`, and a
   monotonic `generation` counter that mutating operations increment
   ([polar_model.py:37,44,54,69-72,83](../../server/polarrecorder/polar_model.py#L37)).
   `Counters` exposes `from_dict`, `to_dict`, and `reset`
   ([counters.py:59,67,78](../../server/polarrecorder/counters.py#L59)).
8. `plugin.py` owns the single lock and all live state:
   `_lock`, `_model`, `_counters`, `_created_wall`, `_last_flush_wall`,
   `_flush_requested`, `_data_dir`, `_logger`, `_clock` (monotonic), `_wall_clock`
   ([plugin.py:72-99](../../plugin.py#L72-L99)). The destructive `reset` route is
   the template for an in-place state change: it mutates under the lock and sets
   `_flush_requested = True` so the **plugin thread** performs the disk write; it
   does not write on the HTTP thread
   ([api_dispatch.py:110-117](../../server/polarrecorder/api_dispatch.py#L110-L117)).
   The run loop honours `_flush_requested` on its next iteration
   ([plugin.py:122-124](../../plugin.py#L122-L124)) and `_flush()` serializes the
   current `_model`/`_counters` with current config metadata
   ([plugin.py:221-244](../../plugin.py#L221-L244)).
9. **AvNav plugins cannot receive POST.** Plugin URLs are `/plugins/<name>/...`
   (prefix `URL_PREFIX = "/plugins"`, AvNav `pluginhandler.py:53`) and are
   dispatched through `doExternalMappings`. AvNav's navurl is `/api`
   (AvNav `httpserver.py` config `navurl`), so `isNavUrl("/plugins/...")` returns
   `False` and the request takes the external-mappings branch, which returns
   `404 "unsupported post url"` for any POST **before** the plugin handler is
   called (AvNav `httphandler.py` `handleRequest`, the `else:` branch). The
   `_json`/`_getPostParam` POST-body mechanism (AvNav `httphandler.py`
   `_getPostParam`) exists **only** on the core `/api` navrequest branch, not for
   plugins. Plugins therefore receive only GET (and HEAD). This is a portable AvNav
   host contract, verified in the AvNav server source on this machine.
10. **A single GET cannot carry a realistic backup.** AvNav's HTTP handler
    (`AVNHTTPHandler`, AvNav `httphandler.py:43-45`) sets no request-line length
    override, so Python's default ~64 KB request-line limit applies; after
    URL-encoding, a single GET query carries only ~15-20 KB of JSON. A
    well-learned model (hundreds of populated bins, the device-migration case the
    ROADMAP targets) exports well past that. The bytes must therefore arrive in
    multiple GET requests and be reassembled server-side.
11. AvNav URL-decodes query parameters before the plugin sees them
    (`parse_qs`, documented in
    [request-routing-and-static-files.md:23](../../documentation/avnav/request-routing-and-static-files.md#L23)),
    and `plugin.py._normalize_args` takes the first scalar per key and stringifies
    it ([plugin.py:315-322](../../plugin.py#L315-L322)). A chunk sent as
    `?data=<urlencoded slice>` therefore reaches the dispatch handler as the
    already-decoded slice string in `args["data"]`. The `confirm=yes` guard pattern
    (blank values fail the check) is already established for `reset`/`presets/delete`
    ([api.md:53,52](../../documentation/architecture/api.md#L53)).
12. The viewer fetch helper `Polarrecorder.FetchJson(endpoint, {action:true})`
    issues `fetch(ApiBase + endpoint, {cache:"no-store"})`, throws on non-OK HTTP or
    on an `{status:"ERROR", error}` envelope (surfacing `error`), and otherwise
    returns `body.data`
    ([viewer.js:106-121](../../viewer/viewer.js#L106-L121)). `endpoint` may carry a
    query string (e.g. `"reset?confirm=yes"`), and `ApiBase` is `"../api/"` by
    default ([viewer.js:45-48](../../viewer/viewer.js#L45-L48)).
13. The Settings tab already has the symmetric download side and a **disabled
    placeholder for restore**: `restoreCard()` renders "Restore JSON (Post-MVP)"
    with a disabled "Choose Backup File (Post-MVP)" button, and `downloadJson()`
    fetches `export/json` and saves it via a Blob
    ([settings-ui.js:39-49,133-140](../../viewer/settings-ui.js#L39-L49)). The
    Reset card shows the confirm-text pattern to mirror
    ([settings-ui.js:51-71](../../viewer/settings-ui.js#L51-L71)). `settings-ui.js`
    is 173 lines, well under the 400-line viewer limit.
14. `persistence.py` is at the file-size ceiling (404 total lines / near the 400
    non-empty-line hard limit, Baseline confirmed by `wc`), so the strict validator
    must be a **new** module, not an addition to `persistence.py`.
15. Test harness exists for both layers: `tests/test_persistence.py` covers
    serialize/load and migration; `tests/test_plugin_integration.py` with
    `tests/plugin_integration_support.py` drives the plugin through a fake AvNav API
    and injected clocks ([tests/](../../tests/)). These are the patterns the new
    tests reuse; no new test framework is introduced.
16. Negative facts (new, do not exist today): there is no `restore.py`, no strict
    import validator, no chunked-upload staging state or constants, no
    `import/*` routes, no public migration entry point on `persistence`, no viewer
    upload code, and no documentation of the restore flow or of the AvNav
    POST-not-supported / GET-size constraints.

## Hard Constraints

1. `server/polarrecorder/restore.py` and all of `server/polarrecorder/` must not
   import AvNav modules or `plugin.py`, must not acquire locks, must not sleep,
   must not read clocks, and must not perform disk I/O. The validator is a pure
   function of the backup string (and the build's bin-grid constants).
2. `plugin.py` remains the only AvNav boundary and the only lock owner. The
   chunked-upload staging buffer, the upload token, idle-timeout checks (using the
   injected monotonic `_clock`), and the model swap all live in `plugin.py` under
   `_lock`. Validation of the assembled string is delegated to the pure
   `restore` module.
3. Import is **fail-closed and atomic**. On any validation failure the live
   `_model`/`_counters` are not mutated at all, and the staging buffer is cleared.
   No partial bins, no coercion of bad values, no "best effort" load.
4. The disk write happens on the **plugin thread** via the existing
   `_flush_requested` mechanism (as `reset` does). No persistence write occurs on
   the HTTP worker thread.
5. Restore is **replace-only** in this plan. No merge mode, no `mode=` parameter.
   Merging two models is explicitly out of scope.
6. The backup `config` block's `percentile`/`max_tws` are treated as **metadata
   only** and must not overwrite live AvNav editable-parameter settings. Only the
   `config` bin sizes are consumed, and only as the grid-match safety gate.
7. All new thresholds are **named constants**, never magic numbers:
   `restore.MAX_IMPORT_BYTES`, `plugin.MAX_IMPORT_CHUNKS`,
   `plugin.IMPORT_IDLE_TIMEOUT_SECONDS`, and the viewer's `IMPORT_CHUNK_CHARS`.
   Suggested values (tunable within reason): `MAX_IMPORT_BYTES = 4_194_304`
   (4 MiB), `MAX_IMPORT_CHUNKS = 4096`, `IMPORT_IDLE_TIMEOUT_SECONDS = 120`,
   `IMPORT_CHUNK_CHARS = 4000`. `IMPORT_CHUNK_CHARS` must stay small enough that one
   URL-encoded chunk is comfortably under the ~64 KB request-line limit (Baseline
   10), and the chunk/byte caps together must permit a 4 MiB backup.
8. New Python files start with the mandatory module header, every file keeps
   `from __future__ import annotations`, all functions are typed, public functions
   carry Google-style docstrings, and ruff + `mypy --strict` pass. No broad/bare
   `except` in `restore.py`; it raises a specific `RestoreError`.
9. Viewer code stays under the single `window.Polarrecorder` namespace and the
   plain-script rules: no `innerHTML` assignment, no `eval`, no `var`, no loose
   equality, no `console.log`, no commented-out code. The `data` query value is
   built with `encodeURIComponent`. Files keep the 400-line viewer limit; if the
   Settings flow would breach it, split the upload logic into a new kebab-case
   viewer script rather than compressing lines.
10. No change to the on-disk persistence schema and no new schema version. Restore
    reuses `CURRENT_SCHEMA_VERSION` and the existing migration ladder; it does not
    invent a parallel schema.

## Implementation Order

Each phase must leave `tools/check-all.sh` green.

### Phase 1 - Strict import validator (pure domain module)

Intent: turn a backup string into a validated `PolarModel` + `Counters` +
metadata, or a precise rejection, with zero tolerance for malformed or foreign
data.

Dependencies: none.

Deliverables:

- Expose the migration entry point on `persistence.py` for reuse without
  duplicating schema knowledge: add a public `migrate_payload(data) -> SerializedDict`
  wrapping the existing `_migrate`, and a public `SchemaTooNewError` alias (or
  rename `_SchemaTooNewError`), keeping `CURRENT_SCHEMA_VERSION` as the single
  version authority (Constraint 10). Existing private callers keep working.
- New module `server/polarrecorder/restore.py` with the mandatory header
  (`Depends: polarrecorder.bins, polarrecorder.counters, polarrecorder.persistence,
  polarrecorder.polar_model`). It defines:
  - `MAX_IMPORT_BYTES` (Constraint 7).
  - `class RestoreError(Exception)` carrying a stable, user-safe `reason` string
    (and an optional machine `code`); messages name the first failing check and
    never leak internals/stack detail.
  - A frozen `RestoreResult` dataclass: `model: PolarModel`, `counters: Counters`,
    `created_wall: float | None`, `last_flush_wall: float`,
    `migrated_from_version: int`, `bins_restored: int`, `total_accepted: int`.
  - `validate_and_build(raw: str) -> RestoreResult` performing, in order, and
    raising `RestoreError` on the first failure:
    1. **Size gate** - `len(raw.encode("utf-8")) <= MAX_IMPORT_BYTES`.
    2. **JSON object gate** - parses as JSON and is a `dict` (not list/scalar).
    3. **Provenance gate** - has an int-compatible `schema_version`, a `config`
       object containing `twa_bin_size`/`tws_bin_size`, a `bins` object, and a
       `counters` object; otherwise reject as "not a Polar Recorder backup".
    4. **Schema gate** - `persistence.migrate_payload` (rejects `schema_too_new`
       via `SchemaTooNewError` -> `RestoreError`; migrates older). Record the
       pre-migration version as `migrated_from_version`.
    5. **Unknown-key gate** - reject unexpected top-level keys (the set is fixed
       for the current schema version; this is sound because the schema gate has
       already pinned the version).
    6. **Grid gate** - `config.twa_bin_size == TWA_BIN_SIZE` and
       `config.tws_bin_size == TWS_BIN_SIZE`; otherwise reject as a foreign grid.
    7. **Strict bin parse** - for every bin: address parses to `(twa, tws)` with
       `0 <= twa <= 359` and `0 <= tws <= TWS_BIN_MAX`; `histogram` keys are
       int-compatible deciknots `>= 0` with counts `>= 0`; `total_*` are ints
       `>= 0`; `last_update_wall` is a finite float; `rejection_histogram` keys are
       strings with int counts `>= 0`. Reject (do **not** coerce) on any mismatch.
    8. **Strict counters parse** - build `Counters` from the `counters` object,
       rejecting wrong types / negative totals.
    9. Build a fresh `PolarModel` from the validated bins and return
       `RestoreResult`. The validator does **not** read clocks or touch disk.
  - Note: cross-consistency between global counters and per-bin totals is
    intentionally **not** checked (legitimate backups can diverge; checking it
    would risk false rejects).

Tests (`tests/test_restore.py`):

- Round-trip: feed a `persistence.serialize_to_dict(...)` output string back
  through `validate_and_build` and assert the rebuilt model's bins/counters equal
  the original (the core "the backup round-trips" guarantee).
- Reject each failure mode with its reason: non-JSON, JSON array/scalar, missing
  provenance keys, `schema_too_new`, unknown top-level key, foreign bin grid
  (`twa_bin_size`/`tws_bin_size` mismatch), TWA out of 0-359, TWS over
  `TWS_BIN_MAX`, negative count, non-finite `last_update_wall`, oversized payload.
- Migration: a v0 (test-only) payload restores and reports `migrated_from_version
  == 0`.

Exit conditions:

- `validate_and_build` accepts a genuine export and rejects every listed bad
  input with a specific reason and no mutation of any external state.
- `restore.py` imports no AvNav module, holds no lock, reads no clock, does no I/O.
- `tools/check-all.sh` green.

### Phase 2 - Chunked-upload staging and import routes (server transport)

Intent: let the viewer deliver an arbitrarily large backup over multiple GETs,
reassemble it under the lock with strict bounds, and atomically replace the model
on a confirmed, valid commit.

Dependencies: Phase 1 (the validator).

Deliverables:

- In `plugin.py`, add lock-guarded staging state initialized in `__init__`:
  `_import_token: str | None = None`, `_import_parts: list[str] = []`,
  `_import_bytes: int = 0`, `_import_last_activity: float = 0.0`, plus the
  constants `MAX_IMPORT_CHUNKS` and `IMPORT_IDLE_TIMEOUT_SECONDS` (Constraint 7),
  and a private `_reset_import_staging()` helper. Token generation uses
  `secrets.token_hex` at the boundary (stdlib; domain stays pure).
- Add four routes to `api_dispatch.ROUTES`, each mirroring the lock discipline of
  `_reset`:
  - `import/begin`: under the lock, discard any existing staging (last-writer-wins,
    so an abandoned upload can never permanently block restore), generate a fresh
    token, stamp `_import_last_activity = plugin._clock()`, and return
    `{token, max_bytes: MAX_IMPORT_BYTES, max_chunks: MAX_IMPORT_CHUNKS}`.
  - `import/chunk`: requires `token` (must match) and integer `seq`; under the
    lock, reject if no active token, if the token mismatches, if idle-expired
    (`plugin._clock() - _import_last_activity > IMPORT_IDLE_TIMEOUT_SECONDS`), if
    `seq != len(_import_parts)` (strictly contiguous ordering — rejects gaps and
    dupes), if appending `args["data"]` would exceed `MAX_IMPORT_BYTES`, or if
    `len(_import_parts) >= MAX_IMPORT_CHUNKS`. On success append the (already
    URL-decoded, Baseline 11) `data`, add its byte length, refresh the activity
    stamp, and return `{received: len(_import_parts), bytes: _import_bytes}`. Any
    rejection clears staging (fail-closed).
  - `import/commit`: requires `token` (must match) and `confirm == "yes"`
    (Baseline 11); otherwise an application error and staging is **kept** so the UI
    can retry the confirm without re-uploading. Under the lock: verify token, check
    not idle-expired, assemble `"".join(_import_parts)`, clear staging, and capture
    the string. Release the lock, then call `restore.validate_and_build(assembled)`
    (pure). On `RestoreError`, return `{status:"ERROR", error: reason}` with the
    live model untouched. On success, re-acquire the lock and swap:
    `_model = result.model` (set its `generation` to `previous_generation + 1` so
    `GET polar` consumers see a change), `_counters = result.counters`,
    `_created_wall = result.created_wall`, optionally
    `_last_flush_wall = result.last_flush_wall`, and `_flush_requested = True` so
    the plugin thread persists it (Baseline 8, Constraint 4). Return a summary
    `{bins_restored, total_accepted, migrated_from_version}`.
  - `import/abort`: under the lock, clear staging (idempotent) and return `{}`.
- Reuse `api_handlers.ok`/`error` for envelopes; add an `import/*`-specific
  formatter only if a dedicated response shape is cleaner. Keep dispatch lean to
  respect the 400-line limits on `api_dispatch.py`/`plugin.py`; if a phase would
  breach a limit, factor the staging helpers into a small module owned by
  `plugin.py` rather than compressing lines.

Tests (extend `tests/test_plugin_integration.py` / support):

- Happy path: begin -> N chunks of a real exported backup -> commit(confirm=yes)
  replaces the model, sets `_flush_requested`, and the subsequent flush writes
  `polar.json`; `GET status` reflects the restored bin count and a bumped
  generation.
- Token mismatch, missing token, and commit/chunk after `import/abort` are
  rejected.
- `seq` gap / duplicate is rejected and clears staging.
- Byte-cap and chunk-count overflow are rejected with clear reasons.
- Idle expiry past `IMPORT_IDLE_TIMEOUT_SECONDS` (driven by the injected clock)
  invalidates the staging.
- `commit` without `confirm=yes` errors and **keeps** staging (retryable).
- A malformed assembled payload is rejected by the validator and leaves the prior
  model intact (assert bins unchanged).

Exit conditions:

- A multi-chunk upload of a genuine export restores the model end-to-end through
  the fake AvNav API; an invalid or unconfirmed upload never mutates the model.
- All staging mutation happens under `plugin._lock`; the validator call happens
  outside the lock; the only persistence write path is `_flush_requested`.
- `tools/check-all.sh` green.

### Phase 3 - Viewer restore UI (replace the placeholder)

Intent: give the Settings tab a real, confirm-gated restore control that slices
the chosen file and drives the chunked upload, surfacing precise server errors.

Dependencies: Phase 2 (the routes).

Deliverables:

- In `viewer/settings-ui.js`, replace `restoreCard()` (Baseline 13) with a working
  card: a hidden `<input type="file" accept="application/json,.json">`, a
  "Choose Backup File" button that opens it, a read-only field showing the chosen
  file name, a confirm-text field ("Type RESTORE to confirm") mirroring the Reset
  card, and a "Restore" action button (danger styling).
- Add an `IMPORT_CHUNK_CHARS` constant (Constraint 7) and an upload routine that:
  1. Guards on the confirm text (`=== "restore"`, case-insensitive) before doing
     anything.
  2. Reads the file via `FileReader.readAsText`.
  3. Optionally does a client-side `JSON.parse` for a friendly early error, but the
     **server is authority** (do not trust the client).
  4. `FetchJson("import/begin", {action:true})` to get `token`.
  5. Slices the text into `IMPORT_CHUNK_CHARS`-sized pieces and sends them
     sequentially (promise chain) as
     `FetchJson("import/chunk?token=" + token + "&seq=" + i + "&data=" +
     encodeURIComponent(slice), {action:true})`.
  6. `FetchJson("import/commit?token=" + token + "&confirm=yes", {action:true})`,
     then show the returned summary via `setMessage(...)` and refresh.
  7. On any rejection, call `FetchJson("import/abort?token=" + token, {action:true})`
     (best-effort) and show `error.message` via `setMessage(..., "error")`.
- Obey all viewer rules (Constraint 9). If this pushes `settings-ui.js` near the
  400-line limit, extract the chunked-upload routine into a new
  `viewer/import-upload.js` (plain script, `window.Polarrecorder` namespaced,
  registered in `viewer/viewer.html`) and call it from `settings-ui.js`.

Tests:

- Extend the Node viewer checks only as far as the existing harness allows
  (namespace, banned patterns, filesize/line limits). Behavioural verification of
  the upload is manual via the viewer and recorded in the verification notes; do
  not add a browser test harness that does not exist today.

Exit conditions:

- Choosing a downloaded backup and confirming `RESTORE` uploads it in chunks and
  restores the model; the polar/status tabs reflect the restored data after the
  next status refresh.
- A wrong or corrupted file shows the precise server rejection reason and changes
  nothing.
- `tools/check-all.sh` green (including `check:namespace`, `check:patterns`,
  filesize/line-limit checks).

### Phase 4 - Documentation and README

Intent: synchronise public docs with the new restore subsystem and record the
AvNav transport constraints that shaped it.

Dependencies: Phases 1-3.

Deliverables:

- New `documentation/architecture/import-restore.md` (title, `Status`, `Overview`,
  `Key Details`, `Related`): the strict-validation rules and rejection reasons, the
  replace/fail-closed/atomic semantics, the chunked-GET staging protocol with its
  bounds, the grid-match gate, and the flush-on-plugin-thread persistence path.
- `documentation/TABLEOFCONTENTS.md`: add a routing line for the new doc under
  Architecture (and under Validation if appropriate).
- `documentation/architecture/api.md`: add the four `import/*` endpoints to the
  table, replace the "There is no import/restore endpoint" line (Baseline 3), and
  document the chunked-GET rationale (POST unsupported for plugins).
- `documentation/user/export-import.md`: the JSON backup now round-trips; document
  restore from the Settings tab, replace semantics, and the limitations.
- `documentation/architecture/persistence.md`: note the new public migration entry
  point and that restore reuses the version authority and migration ladder.
- `documentation/avnav/request-routing-and-static-files.md`: record as a portable
  AvNav contract that plugin URLs receive GET/HEAD only (POST is rejected upstream)
  and that GET URLs are request-line-length bounded, so large uploads use chunked
  GET (Baseline 9-10).
- `documentation/architecture/ui.md`: the Settings restore card and its flow.
- `README.md`: a restore section describing how to import a backup, the confirm
  step, and the limitations - **replace-only** (overwrites current learned data),
  a size cap, and that the backup must come from a build with the same bin grid.
- `ROADMAP.md`: mark item 1 ("Restore / import flows") as in progress / done per
  the repo's roadmap convention.

Exit conditions:

- `npm run check:docs` passes (documentation reachability and AI-instruction sync).
- `tools/check-all.sh` green.

## Documentation Impact

| Doc | Change | Trigger |
|---|---|---|
| `documentation/architecture/import-restore.md` | New file: validation rules, semantics, chunked protocol | New subsystem |
| `documentation/TABLEOFCONTENTS.md` | Add routing line for the new doc | New doc added |
| `documentation/architecture/api.md` | Add `import/*` endpoints; remove "no import" line; POST/chunk rationale | API shape change |
| `documentation/user/export-import.md` | Restore now real; replace semantics; limitations | Export/import behaviour change |
| `documentation/architecture/persistence.md` | Public migration entry point; restore reuse | Behaviour change |
| `documentation/avnav/request-routing-and-static-files.md` | GET-only plugins; chunked-GET upload contract | Host-contract clarification |
| `documentation/architecture/ui.md` | Settings restore card and flow | Viewer behaviour change |
| `README.md` | Restore instructions and limitations | User-facing behaviour change |
| `ROADMAP.md` | Item 1 status | Roadmap progress |

One new documentation file is introduced (`import-restore.md`).

## Acceptance Criteria

Behaviour:

- [ ] A genuine `export/json` backup, downloaded and re-uploaded from Settings,
      restores the learned model (export -> import round-trip equality).
- [ ] Restore replaces the current model and counters and requires the `RESTORE`
      confirmation; the live model is never partially modified.
- [ ] Wrong files, corrupted JSON, foreign bin grids, too-new schema, and
      out-of-range values are each rejected with a precise reason and leave the
      current model untouched (fail-closed, atomic).
- [ ] JSON that is not a Polar Recorder backup is rejected as such, not turned into
      an empty model.
- [ ] A large (multi-chunk) backup uploads and restores successfully; staging is
      bounded by byte cap, chunk cap, and idle timeout.
- [ ] `config.percentile`/`max_tws` from the backup do not change live settings.

Tests:

- [ ] `tests/test_restore.py` asserts round-trip equality and every listed
      rejection reason, plus v0 migration.
- [ ] Integration tests assert the chunked happy path, token/seq/cap/expiry
      rejections, confirm-required-with-retainable-staging, and
      model-untouched-on-failure.

Docs:

- [ ] `import-restore.md` added and linked from `TABLEOFCONTENTS.md`.
- [ ] `api.md`, `export-import.md`, `persistence.md`,
      `request-routing-and-static-files.md`, `ui.md`, and `README.md` updated.
- [ ] `npm run check:docs` passes.

Release impact:

- [ ] `tools/check-all.sh` green after every phase and at handoff.
- [ ] No persistence schema change and no new schema version; existing installs are
      unaffected until a user explicitly restores a backup.

## Related

- [ROADMAP.md](../../ROADMAP.md) - item 1 source
- [exec-plan-authoring.md](../../documentation/guides/exec-plan-authoring.md) - plan contract
- [persistence.md](../../documentation/architecture/persistence.md) - schema, migration, atomic write
- [api.md](../../documentation/architecture/api.md) - endpoints and dispatch/lock discipline
- [export-import.md](../../documentation/user/export-import.md) - backup shape and the missing restore
- [request-routing-and-static-files.md](../../documentation/avnav/request-routing-and-static-files.md) - plugin request contract
- [ui.md](../../documentation/architecture/ui.md) - viewer/settings rendering
- [coding-standards.md](../../documentation/conventions/coding-standards.md),
  [smell-prevention.md](../../documentation/conventions/smell-prevention.md) - binding rules
- [PLAN2.md](../completed/PLAN2.md) - prior ROADMAP-item plan, format reference
