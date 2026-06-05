# PLAN3 - JSON backup restore / import (validated, fail-closed)

**Status:** Active. Authoritative implementation source for ROADMAP item 1
("Restore / import flows") until moved to `exec-plans/completed/`. Prescriptive
parts: the verified baseline, hard constraints, phase deliverables, exit
conditions, and acceptance criteria. Flexible parts: helper names, internal
function decomposition, constant tuning within the stated bounds, and test-case
naming, provided the exit conditions and constraints hold.

This plan covers ROADMAP item 1 only, for **two** backup artifacts: the learned
polar model (`polar.json`) and the user export presets (`presets.json`). Items 2-5
(optional signal hooks, dashboard widgets, dyninstruments palette) are explicitly
out of scope and must not be touched.

## Goal

User-visible outcomes after completion:

1. A user can upload a previously downloaded JSON backup from the **Settings** tab
   and restore the learned polar from it, completing the round-trip that
   `GET /api/export/json` only half-implements today.
2. A user can **download** their export presets (`presets.json`) as a JSON backup
   from the Settings tab, and **restore** that presets backup the same way,
   completing the presets round-trip.
3. Both restores use **replace** semantics: a valid polar backup fully replaces the
   current learned model and counters; a valid presets backup fully replaces the
   current set of user presets. Each requires explicit confirmation (type
   `RESTORE`), mirroring the existing Reset confirmation. Built-in presets are never
   affected.
4. Both imports are **fail-closed and all-or-nothing**: any wrong file, corrupted
   file, foreign-grid file (polar), too-new schema, reserved/built-in preset name,
   or out-of-range value is rejected with a precise, user-readable reason, and the
   current state (model, counters, presets) is left completely untouched. Nothing
   partial is ever applied.
5. A file that is recognizably not the expected backup (wrong JSON, missing the
   expected schema/shape) is rejected with a clear message rather than silently
   producing an empty model or wiping presets.
6. On success the user sees a short summary (polar: bins restored, total accepted
   samples, and the schema version migrated from if any; presets: number of user
   presets restored).

Repository-visible outcomes:

1. A new pure domain module `server/polarrecorder/restore.py` strictly validates and
   builds a `PolarModel` + `Counters` from a polar backup string, with no AvNav
   import, no I/O, no locks, and no clock reads.
2. A new pure domain module `server/polarrecorder/preset_backup.py` strictly
   validates a presets backup string into a set of user `Preset`s and serializes the
   current user presets to the `presets.json` backup shape, reusing `export.py`'s
   name/grid validators (exposed as small public wrappers).
3. `plugin.py` owns a single lock-guarded chunked-upload staging buffer with a
   `kind` discriminator (`polar`/`presets`) and the import routes (`import/begin`,
   `import/chunk`, `import/commit`, `import/abort`), because AvNav plugin URLs
   cannot receive POST (Baseline 9) and a single GET URL cannot carry a realistic
   backup (Baseline 10).
4. New download route `export/presets` returns the user-presets backup shape, and
   `import/commit` dispatches to the polar or presets apply path by `kind`.
5. The Settings tab gains working download + restore controls for both artifacts,
   driven by one shared chunked-upload viewer helper parameterized by `kind`.
6. `tools/check-all.sh` is green. New `test_restore.py` and `test_preset_backup.py`
   plus import-flow integration tests assert validation rejection, the chunked
   transport for both kinds, and export->import round-trip equality for both.
7. `README.md` and the mapped documentation describe both restore flows, their
   replace semantics, and their limitations.

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
3. There is **no** import/restore endpoint and **no** presets-download endpoint
   today; `ROUTES` has exactly thirteen GET routes, none body-consuming and none
   serving the raw `presets.json`
   ([api_dispatch.py:266-280](../../server/polarrecorder/api_dispatch.py#L266-L280)).
   The API doc states plainly "There is no import/restore endpoint"
   ([api.md:58](../../documentation/architecture/api.md#L58)).
4. The startup `load()` path is deliberately **corruption-tolerant**: it coerces
   strings to ints/floats, defaults missing fields, skips a non-dict
   `bins`/`histogram` silently, and recovers from `polar.backup.json`
   ([persistence.py:318-386](../../server/polarrecorder/persistence.py#L318-L386)).
   `_load_user_presets` is likewise tolerant: corrupt or too-new `presets.json`
   logs a warning and returns built-ins only, and `_decode_presets` silently skips
   malformed or built-in-named entries
   ([export.py:311-342](../../server/polarrecorder/export.py#L311-L342)). This
   tolerance is correct for startup but is **not** acceptable for user import,
   which must reject rather than coerce. Separate strict validators are required.
5. Polar schema versioning already exists: `CURRENT_SCHEMA_VERSION = 1`
   ([persistence.py:24](../../server/polarrecorder/persistence.py#L24)); `_migrate`
   raises `_SchemaTooNewError` for versions above current and runs an ordered
   migration ladder (`_MIGRATIONS = {0: _migrate_v0_to_v1}`, v0 being test-only)
   ([persistence.py:249-278](../../server/polarrecorder/persistence.py#L249-L278)).
   Both `_migrate` and `_SchemaTooNewError` are currently private.
6. The running build's polar bin grid is fixed: `TWA_BIN_SIZE = 1`,
   `TWS_BIN_SIZE = 1`, `TWS_BIN_MAX = 60`
   ([bins.py:11-13](../../server/polarrecorder/bins.py#L11-L13)). Bin addresses are
   `round(twa/TWA_BIN_SIZE) % 360` (TWA 0-359) and tws clamped `0..TWS_BIN_MAX`
   ([bins.py:32-38](../../server/polarrecorder/bins.py#L32-L38)). A polar backup
   whose `config` bin sizes differ addresses its bins on a foreign grid and must be
   rejected.
7. The presets store is a separate file with its own schema:
   `PRESETS_NAME = "presets.json"`, `PRESET_SCHEMA_VERSION = 1`, written atomically
   by `_write_user_presets` as `{schema_version, presets:{name:{twa,tws}}}` with
   **user presets only** (built-ins are not persisted)
   ([export.py:47,46,352-367](../../server/polarrecorder/export.py#L47)). Preset
   validation rules already exist and must be reused for import: names are trimmed,
   1-30 chars, pattern `^[A-Za-z0-9 -]+$`, with built-in names reserved
   (`_validate_name`, `NAME_PATTERN`), TWA values `0..TWA_GRID_MAX` (359) and TWS
   values `1..max_tws` (`_parse_grid`)
   ([export.py:279-308](../../server/polarrecorder/export.py#L279-L308)). These
   helpers are currently private.
8. `PolarModel` exposes `bins`, `reset()`, `snapshot_bins()`, `iter_bins()`, and a
   monotonic `generation` counter that mutating operations increment
   ([polar_model.py:37,44,54,69-72,83](../../server/polarrecorder/polar_model.py#L37)).
   `Counters` exposes `from_dict`, `to_dict`, `reset`
   ([counters.py:59,67,78](../../server/polarrecorder/counters.py#L59)).
9. **AvNav plugins cannot receive POST.** Plugin URLs are `/plugins/<name>/...`
   (prefix `URL_PREFIX = "/plugins"`, AvNav `pluginhandler.py:53`) and are
   dispatched through `doExternalMappings`. AvNav's navurl is `/api`
   (AvNav `httpserver.py` config `navurl`), so `isNavUrl("/plugins/...")` returns
   `False` and the request takes the external-mappings branch, which returns
   `404 "unsupported post url"` for any POST **before** the plugin handler is
   called (AvNav `httphandler.py` `handleRequest`, the `else:` branch). The
   `_json`/`_getPostParam` POST-body mechanism exists **only** on the core `/api`
   navrequest branch, not for plugins. Plugins therefore receive only GET (and
   HEAD). This is a portable AvNav host contract, verified in the AvNav server
   source on this machine.
10. **A single GET cannot carry a realistic backup.** AvNav's HTTP handler
    (`AVNHTTPHandler`, AvNav `httphandler.py:43-45`) sets no request-line length
    override, so Python's default ~64 KB request-line limit applies; after
    URL-encoding, a single GET query carries only ~15-20 KB of JSON. A well-learned
    polar model (and, for power users, a large presets file) exports past that. The
    bytes must arrive in multiple GET requests and be reassembled server-side.
11. AvNav URL-decodes query parameters before the plugin sees them
    (`parse_qs`,
    [request-routing-and-static-files.md:23](../../documentation/avnav/request-routing-and-static-files.md#L23)),
    and `plugin.py._normalize_args` takes the first scalar per key and stringifies
    it ([plugin.py:315-322](../../plugin.py#L315-L322)). A chunk sent as
    `?data=<urlencoded slice>` reaches dispatch as the already-decoded slice string
    in `args["data"]`. The `confirm=yes` guard pattern is established for
    `reset`/`presets/delete` ([api.md:52-53](../../documentation/architecture/api.md#L52)).
12. `plugin.py` owns the single lock and all live state
    ([plugin.py:72-99](../../plugin.py#L72-L99)). Two persistence-write disciplines
    coexist: (a) **polar** writes happen on the **plugin thread** - `reset` mutates
    under the lock and sets `_flush_requested = True`, and the run loop's `_flush()`
    serializes and writes
    ([api_dispatch.py:110-117](../../server/polarrecorder/api_dispatch.py#L110-L117),
    [plugin.py:122-124,221-244](../../plugin.py#L122-L124)); (b) **preset** writes
    are the documented exception that run on the **HTTP worker thread** under the
    lock - `presets/save` and `presets/delete` call `export` write helpers while
    holding `plugin._lock`
    ([api_dispatch.py:133-154](../../server/polarrecorder/api_dispatch.py#L133-L154),
    [request-routing-and-static-files.md:42](../../documentation/avnav/request-routing-and-static-files.md#L42)).
    Polar restore therefore applies via `_flush_requested`; presets restore applies
    via a direct lock-held atomic write.
13. The viewer fetch helper `Polarrecorder.FetchJson(endpoint, {action:true})`
    issues `fetch(ApiBase + endpoint, {cache:"no-store"})`, throws on non-OK HTTP or
    on an `{status:"ERROR", error}` envelope (surfacing `error`), else returns
    `body.data` ([viewer.js:106-121](../../viewer/viewer.js#L106-L121)). `endpoint`
    may carry a query string; `ApiBase` defaults to `"../api/"`
    ([viewer.js:45-48](../../viewer/viewer.js#L45-L48)).
14. The Settings tab already has the polar download side and a disabled restore
    placeholder: `restoreCard()` renders "Restore JSON (Post-MVP)" with a disabled
    button, and `downloadJson()` fetches `export/json` and saves it via a Blob
    ([settings-ui.js:39-49,133-140](../../viewer/settings-ui.js#L39-L49)). The Reset
    card shows the confirm-text pattern to mirror
    ([settings-ui.js:51-71](../../viewer/settings-ui.js#L51-L71)). `settings-ui.js`
    is 173 lines; adding polar restore + presets download/restore makes a shared,
    extracted upload helper the right way to stay under the 400-line viewer limit.
15. File-size headroom: `persistence.py` is at the ceiling (404 total / ~400
    non-empty lines), so the polar validator must be a **new** module.
    `export.py` is 336 non-empty lines (~64 of headroom), enough for a few small
    public validator wrappers but not for the full backup orchestration, which must
    live in a **new** module too.
16. Test harness exists for both layers: `tests/test_persistence.py` and
    `tests/test_export.py` cover serialize/load and preset validation;
    `tests/test_plugin_integration.py` with `tests/plugin_integration_support.py`
    drives the plugin through a fake AvNav API and injected clocks
    ([tests/](../../tests/)). No new test framework is introduced.
17. Negative facts (new, do not exist today): there is no `restore.py`, no
    `preset_backup.py`, no strict import validators, no presets-download endpoint,
    no chunked-upload staging or `kind` discriminator, no `import/*` routes, no
    public migration/validator entry points, no viewer upload code, and no
    documentation of the restore flows or of the AvNav POST/GET-size constraints.

## Hard Constraints

1. `server/polarrecorder/restore.py`, `server/polarrecorder/preset_backup.py`, and
   all of `server/polarrecorder/` must not import AvNav modules or `plugin.py`, must
   not acquire locks, must not sleep, must not read clocks, and must not perform
   disk I/O. The validators are pure functions of the backup string (plus the
   build's grid constants / live `max_tws` passed in as an argument).
2. `plugin.py` remains the only AvNav boundary and the only lock owner. The single
   chunked-upload staging buffer, its `kind`, the upload token, idle-timeout checks
   (using the injected monotonic `_clock`), the polar model swap, and the presets
   write all happen in `plugin.py` under `_lock`. Validation of the assembled string
   is delegated to the pure `restore`/`preset_backup` modules.
3. Both imports are **fail-closed and atomic**. On any validation failure the live
   model, counters, and presets are not mutated at all, and the staging buffer is
   cleared. No partial bins, no partial presets, no coercion of bad values.
4. Apply paths follow the existing write disciplines (Baseline 12): polar restore
   sets `_flush_requested` for the plugin thread; presets restore performs the
   atomic `presets.json` write under the lock on the HTTP thread via an `export`
   write helper. No new write discipline is introduced.
5. Both restores are **replace-only** in this plan. Polar replaces the model +
   counters; presets replace the entire user-preset set (built-ins untouched and
   never written). No merge mode, no `mode=` parameter.
6. The polar backup `config` block's `percentile`/`max_tws` are treated as
   **metadata only** and must not overwrite live AvNav editable-parameter settings;
   only the `config` bin sizes are consumed, as the grid-match gate. Presets TWS
   values are validated against the **live** `max_tws` (as `save_preset` already
   does), so a presets backup whose TWS exceeds the current `max_tws` is rejected.
7. All new thresholds are **named constants**, never magic numbers:
   `restore.MAX_IMPORT_BYTES`, `preset_backup.MAX_IMPORT_BYTES` (or one shared
   constant), `plugin.MAX_IMPORT_CHUNKS`, `plugin.IMPORT_IDLE_TIMEOUT_SECONDS`, and
   the viewer's `IMPORT_CHUNK_CHARS`. Suggested values (tunable): byte cap
   `4_194_304` (4 MiB), `MAX_IMPORT_CHUNKS = 4096`,
   `IMPORT_IDLE_TIMEOUT_SECONDS = 120`, `IMPORT_CHUNK_CHARS = 4000`.
   `IMPORT_CHUNK_CHARS` must keep one URL-encoded chunk comfortably under the
   ~64 KB request-line limit (Baseline 10).
8. New Python files start with the mandatory module header, keep
   `from __future__ import annotations`, fully type all functions, give public
   functions Google-style docstrings, and pass ruff + `mypy --strict`. No
   broad/bare `except` in the new domain modules; they raise specific errors
   (`RestoreError` / a presets equivalent, reusing `export.ExportError` where it
   fits).
9. Reuse, do not duplicate, the preset validation primitives. Expose small public
   wrappers from `export.py` (e.g. `validate_preset_name`, `parse_preset_grid`) -
   or factor them into a tiny shared module - so `preset_backup.py` reuses the exact
   name pattern, length limit, reserved-name set, and grid ranges. Keep `export.py`
   under the 400 non-empty-line limit; if wrappers would breach it, factor the
   primitives into a new module instead.
10. Viewer code stays under the single `window.Polarrecorder` namespace and the
    plain-script rules: no `innerHTML` assignment, no `eval`, no `var`, no loose
    equality, no `console.log`, no commented-out code. The `data` query value is
    built with `encodeURIComponent`. The shared chunked-upload routine lives in one
    kebab-case helper script used by both polar and presets restore. Files keep the
    400-line viewer limit.
11. No change to the on-disk polar or presets schema and no new schema versions.
    Restore reuses `CURRENT_SCHEMA_VERSION` / `PRESET_SCHEMA_VERSION` and the
    existing migration ladder / validators; it does not invent parallel schemas.

## Implementation Order

Each phase must leave `tools/check-all.sh` green.

### Phase 1 - Strict polar import validator (pure domain module)

Intent: turn a polar backup string into a validated `PolarModel` + `Counters` +
metadata, or a precise rejection, with zero tolerance for malformed or foreign
data.

Dependencies: none.

Deliverables:

- Expose the migration entry point on `persistence.py` for reuse without
  duplicating schema knowledge: add a public `migrate_payload(data) -> SerializedDict`
  wrapping `_migrate`, and a public `SchemaTooNewError` (or rename
  `_SchemaTooNewError`), keeping `CURRENT_SCHEMA_VERSION` as the single version
  authority. Existing private callers keep working.
- New module `server/polarrecorder/restore.py` with the mandatory header
  (`Depends: polarrecorder.bins, polarrecorder.counters, polarrecorder.persistence,
  polarrecorder.polar_model`). It defines `MAX_IMPORT_BYTES`,
  `class RestoreError(Exception)` carrying a stable user-safe `reason`, a frozen
  `RestoreResult` (`model`, `counters`, `created_wall`, `last_flush_wall`,
  `migrated_from_version`, `bins_restored`, `total_accepted`), and
  `validate_and_build(raw: str) -> RestoreResult` performing, in order, raising
  `RestoreError` on the first failure:
  1. **Size gate** - `len(raw.encode("utf-8")) <= MAX_IMPORT_BYTES`.
  2. **JSON object gate** - parses as JSON and is a `dict`.
  3. **Provenance gate** - has int `schema_version`, a `config` object with
     `twa_bin_size`/`tws_bin_size`, a `bins` object, and a `counters` object; else
     reject as "not a Polar Recorder backup".
  4. **Schema gate** - `persistence.migrate_payload` (rejects too-new; migrates
     older); record the pre-migration version.
  5. **Unknown-key gate** - reject unexpected top-level keys for the (now-pinned)
     schema version.
  6. **Grid gate** - `config.twa_bin_size == TWA_BIN_SIZE` and
     `config.tws_bin_size == TWS_BIN_SIZE`; else reject as foreign grid.
  7. **Strict bin parse** - each bin address `(twa, tws)` with `0 <= twa <= 359`,
     `0 <= tws <= TWS_BIN_MAX`; histogram keys int deciknots `>= 0` with counts
     `>= 0`; `total_*` ints `>= 0`; `last_update_wall` finite; `rejection_histogram`
     string keys with int counts `>= 0`. Reject (never coerce) on mismatch.
  8. **Strict counters parse** - build `Counters`, rejecting wrong types / negatives.
  9. Build a fresh `PolarModel` and return `RestoreResult`. No clock, no I/O.
  - Cross-consistency between global counters and per-bin totals is intentionally
    **not** checked (legitimate backups can diverge).

Tests (`tests/test_restore.py`):

- Round-trip: `serialize_to_dict(...)` output string -> `validate_and_build` ->
  rebuilt bins/counters equal the original.
- Reject each failure mode with its reason: non-JSON, array/scalar, missing
  provenance keys, schema-too-new, unknown top-level key, foreign grid, TWA out of
  range, TWS over `TWS_BIN_MAX`, negative count, non-finite `last_update_wall`,
  oversize. v0 migration reports `migrated_from_version == 0`.

Exit conditions:

- `validate_and_build` accepts a genuine export and rejects every listed bad input
  with no mutation of external state; `restore.py` is AvNav-free, lock-free,
  clock-free, I/O-free. `tools/check-all.sh` green.

### Phase 2 - Strict presets backup serializer + validator (pure domain module)

Intent: serialize the current user presets to the `presets.json` backup shape, and
strictly validate a presets backup string into a replacement set of user presets.

Dependencies: none (parallel to Phase 1).

Deliverables:

- In `export.py`, expose small public wrappers reusing the existing primitives
  (Constraint 9): e.g. `validate_preset_name(name) -> str`,
  `parse_preset_grid(name, raw, lower, upper) -> list[int]`, and a public accessor
  for the reserved/built-in-name check and `PRESET_SCHEMA_VERSION`. Keep `export.py`
  under the line limit; if needed, factor the primitives into a small module that
  both `export.py` and `preset_backup.py` import.
- New module `server/polarrecorder/preset_backup.py` (`Depends: polarrecorder.export`)
  defining:
  - `serialize_presets(presets) -> dict` producing the exact backup shape
    `{schema_version: PRESET_SCHEMA_VERSION, presets:{name:{twa,tws}}}` from
    **user** presets only (so the download round-trips through the importer).
  - `validate_presets(raw: str, max_tws: int) -> list[Preset]` performing, in
    order, raising on the first failure (reuse `export.ExportError` or a dedicated
    error):
    1. **Size gate** - byte cap.
    2. **JSON object gate** - parses and is a `dict`.
    3. **Provenance gate** - has int `schema_version` and a `presets` object; else
       reject as "not a presets backup".
    4. **Schema gate** - reject `schema_version > PRESET_SCHEMA_VERSION`.
    5. **Unknown-key gate** - reject unexpected top-level keys.
    6. **Strict per-preset parse** - for every entry: name passes
       `validate_preset_name` (trimmed, 1-30, pattern, **reject** reserved/built-in
       names rather than skipping them), `twa` via `parse_preset_grid(0, 359)`,
       `tws` via `parse_preset_grid(1, max_tws)`; reject duplicates and malformed
       entries (no silent skip, unlike the tolerant loader). Return the validated
       `list[Preset]`.

Tests (`tests/test_preset_backup.py`):

- Round-trip: `serialize_presets(user_presets)` -> JSON string ->
  `validate_presets` -> equal preset set.
- Reject each failure mode: non-JSON, array/scalar, missing `presets`/`schema_version`,
  schema-too-new, unknown top-level key, reserved/built-in name present, bad name
  chars, name too long, TWA out of range, TWS over live `max_tws`, duplicate name,
  oversize.

Exit conditions:

- `validate_presets` accepts a genuine `export/presets` output and rejects every
  listed bad input; `preset_backup.py` is AvNav-free, lock-free, clock-free,
  I/O-free. `tools/check-all.sh` green.

### Phase 3 - Chunked-upload staging, import routes, and presets download

Intent: deliver an arbitrarily large backup over multiple GETs, reassemble it under
the lock with strict bounds, and atomically apply it by `kind`; add the presets
download endpoint.

Dependencies: Phases 1-2 (the validators).

Deliverables:

- Add `export/presets` to `api_dispatch.ROUTES`: under the lock, read user presets
  (as `_presets`/`list_presets` do) and return
  `preset_backup.serialize_presets(...)` via an `ok(...)` envelope. Mirrors
  `export/json`.
- In `plugin.py`, add lock-guarded staging state in `__init__`:
  `_import_token: str | None`, `_import_kind: str | None`, `_import_parts: list[str]`,
  `_import_bytes: int`, `_import_last_activity: float`, plus `MAX_IMPORT_CHUNKS`,
  `IMPORT_IDLE_TIMEOUT_SECONDS`, and a `_reset_import_staging()` helper. Token via
  `secrets.token_hex` at the boundary (domain stays pure).
- Add the import routes to `api_dispatch.ROUTES`, each mirroring `_reset`'s lock
  discipline:
  - `import/begin`: requires `kind in {"polar","presets"}`; under the lock discard
    any existing staging (last-writer-wins so an abandoned upload never blocks
    restore), record the kind, generate a fresh token, stamp activity, return
    `{token, kind, max_bytes, max_chunks}`.
  - `import/chunk`: requires matching `token` and integer `seq`; under the lock
    reject if no active token, token mismatch, idle-expired
    (`plugin._clock() - _import_last_activity > IMPORT_IDLE_TIMEOUT_SECONDS`),
    `seq != len(_import_parts)` (strictly contiguous, rejecting gaps/dupes),
    byte cap exceeded, or chunk cap exceeded. On success append the URL-decoded
    `args["data"]`, refresh activity, return `{received, bytes}`. Any rejection
    clears staging.
  - `import/commit`: requires matching `token` and `confirm == "yes"` (else an
    application error that **keeps** staging for a confirm-only retry). Under the
    lock: verify token, check not idle-expired, assemble `"".join(_import_parts)`,
    capture `kind`, clear staging. Release the lock, then validate (pure) by kind:
    - `kind == "polar"`: `restore.validate_and_build(assembled)`; on success
      re-acquire the lock and swap `_model` (set generation to
      `previous_generation + 1`), `_counters`, `_created_wall`, optionally
      `_last_flush_wall`, and set `_flush_requested = True` (plugin thread persists).
      Return `{kind, bins_restored, total_accepted, migrated_from_version}`.
    - `kind == "presets"`: `preset_backup.validate_presets(assembled,
      plugin.config.max_tws)`; on success re-acquire the lock and perform the atomic
      `presets.json` replacement via an `export` write helper (HTTP-thread write
      under the lock, Baseline 12). Return `{kind, presets_restored}`.
    On any validation error, return `{status:"ERROR", error: reason}` with all live
    state untouched.
  - `import/abort`: under the lock, clear staging (idempotent), return `{}`.
- Add the `export` write helper used by the presets apply path (replace the entire
  user-preset set atomically, reusing `_write_user_presets`); built-in names are
  excluded by validation so they are never written.

Tests (extend `tests/test_plugin_integration.py` / support):

- Polar happy path: begin(kind=polar) -> chunks of a real `export/json` -> commit
  replaces the model, sets `_flush_requested`, flush writes `polar.json`; status
  reflects restored bins and bumped generation.
- Presets happy path: `export/presets` output -> begin(kind=presets) -> chunks ->
  commit replaces user presets; `GET presets` lists them and built-ins are intact;
  `presets.json` rewritten under the lock without a plugin-thread flush.
- Shared transport: token mismatch, missing token, post-abort use, `seq` gap/dup,
  byte-cap and chunk-cap overflow, idle expiry (injected clock), commit without
  `confirm=yes` (errors and keeps staging), unknown/absent `kind` rejected.
- Failure isolation: a malformed polar payload leaves the model intact; a malformed
  presets payload leaves existing presets intact.

Exit conditions:

- A multi-chunk upload of either artifact restores it end-to-end through the fake
  AvNav API; an invalid or unconfirmed upload never mutates any state. Staging
  mutation is under the lock; validation is outside the lock; polar persists via
  `_flush_requested`, presets via the lock-held atomic write. `tools/check-all.sh`
  green.

### Phase 4 - Viewer download + restore UI

Intent: give the Settings tab working download and confirm-gated restore controls
for both artifacts, driven by one shared chunked-upload helper.

Dependencies: Phase 3 (the routes).

Deliverables:

- New `viewer/import-upload.js` (plain script, `window.Polarrecorder` namespaced,
  registered in `viewer/viewer.html`) exposing a reusable
  `uploadBackup(kind, text, onSummary, onError)` that: defines `IMPORT_CHUNK_CHARS`;
  `FetchJson("import/begin?kind=" + kind, {action:true})`; slices `text` and sends
  chunks sequentially as
  `FetchJson("import/chunk?token=" + t + "&seq=" + i + "&data=" +
  encodeURIComponent(slice), {action:true})`;
  `FetchJson("import/commit?token=" + t + "&confirm=yes", {action:true})`; and on
  any rejection calls `import/abort` (best-effort) and reports the precise error.
- In `viewer/settings-ui.js`:
  - Replace `restoreCard()` (Baseline 14) with a working **polar restore** card:
    hidden `<input type="file" accept="application/json,.json">`, a "Choose Backup
    File" button, a chosen-filename label, a "Type RESTORE to confirm" field, and a
    danger "Restore Polar" button. On confirm (`=== "restore"`), `FileReader`-read
    the file and call `uploadBackup("polar", ...)`, then show the summary.
  - Add a **presets backup** card with a "Download Presets" button calling
    `FetchJson("export/presets")` and saving the JSON via the existing `download`
    Blob helper (filename e.g. `polarrecorder-presets.json`).
  - Add a **presets restore** card mirroring the polar restore card, calling
    `uploadBackup("presets", ...)`.
- Obey all viewer rules (Constraint 10). Moving the upload routine into
  `import-upload.js` keeps `settings-ui.js` under the 400-line limit.

Tests:

- Extend the Node viewer checks only as far as the existing harness allows
  (namespace, banned patterns, filesize/line limits, and the new file is
  registered). Behavioural verification is manual via the viewer and recorded in the
  verification notes; do not add a browser test harness that does not exist today.

Exit conditions:

- Choosing a downloaded polar or presets backup and confirming `RESTORE` uploads it
  in chunks and restores it; a wrong/corrupted file shows the precise server
  rejection and changes nothing; downloading presets yields a file that re-imports
  cleanly. `tools/check-all.sh` green (including `check:namespace`, `check:patterns`,
  filesize/line-limit checks).

### Phase 5 - Documentation and README

Intent: synchronise public docs with both restore flows and the AvNav transport
constraints that shaped them.

Dependencies: Phases 1-4.

Deliverables:

- New `documentation/architecture/import-restore.md` (title, `Status`, `Overview`,
  `Key Details`, `Related`): the strict-validation rules and rejection reasons for
  both kinds, the replace/fail-closed/atomic semantics, the chunked-GET staging
  protocol with its `kind` discriminator and bounds, the polar grid-match gate, and
  the two apply paths (plugin-thread flush vs lock-held presets write).
- `documentation/TABLEOFCONTENTS.md`: add a routing line for the new doc.
- `documentation/architecture/api.md`: add the `import/*` and `export/presets`
  endpoints, replace the "There is no import/restore endpoint" line, and document
  the chunked-GET rationale (POST unsupported for plugins).
- `documentation/user/export-import.md`: both JSON backups now round-trip; document
  download + restore from Settings for the polar model and presets, replace
  semantics, and limitations.
- `documentation/architecture/persistence.md`: the public migration entry point and
  that polar restore reuses the version authority and migration ladder.
- `documentation/avnav/request-routing-and-static-files.md`: record as a portable
  AvNav contract that plugin URLs receive GET/HEAD only (POST rejected upstream) and
  that GET URLs are request-line-length bounded, so large uploads use chunked GET.
- `documentation/architecture/ui.md`: the Settings download/restore cards and flow.
- `README.md`: a restore section for both artifacts - how to download and import,
  the confirm step, and the limitations (replace-only; size cap; polar backup must
  match the build's bin grid; presets TWS must fit the current `max_tws`).
- `ROADMAP.md`: mark item 1 ("Restore / import flows") as in progress / done per the
  repo's roadmap convention.

Exit conditions:

- `npm run check:docs` passes; `tools/check-all.sh` green.

## Documentation Impact

| Doc | Change | Trigger |
|---|---|---|
| `documentation/architecture/import-restore.md` | New file: validation rules, semantics, chunked protocol, both kinds | New subsystem |
| `documentation/TABLEOFCONTENTS.md` | Add routing line for the new doc | New doc added |
| `documentation/architecture/api.md` | Add `import/*` and `export/presets`; remove "no import" line; POST/chunk rationale | API shape change |
| `documentation/user/export-import.md` | Polar + presets round-trip; download/restore; limitations | Export/import behaviour change |
| `documentation/architecture/persistence.md` | Public migration entry point; restore reuse | Behaviour change |
| `documentation/avnav/request-routing-and-static-files.md` | GET-only plugins; chunked-GET upload contract | Host-contract clarification |
| `documentation/architecture/ui.md` | Settings download/restore cards and flow | Viewer behaviour change |
| `README.md` | Restore instructions and limitations for both artifacts | User-facing behaviour change |
| `ROADMAP.md` | Item 1 status | Roadmap progress |

One new documentation file is introduced (`import-restore.md`).

## Acceptance Criteria

Behaviour:

- [ ] A genuine `export/json` backup, downloaded and re-uploaded from Settings,
      restores the learned model (polar export -> import round-trip equality).
- [ ] User presets can be downloaded via `export/presets` and re-uploaded to restore
      them (presets export -> import round-trip equality); built-in presets are
      untouched.
- [ ] Both restores replace their target and require the `RESTORE` confirmation; no
      live state is ever partially modified.
- [ ] Wrong files, corrupted JSON, foreign bin grids (polar), too-new schema,
      reserved/built-in preset names, and out-of-range values are each rejected with
      a precise reason and leave current state untouched (fail-closed, atomic).
- [ ] Files that are not the expected backup are rejected as such, not turned into an
      empty model or an emptied preset set.
- [ ] A large (multi-chunk) backup of either kind uploads and restores; staging is
      bounded by byte cap, chunk cap, and idle timeout, and the `kind` is enforced.
- [ ] Polar `config.percentile`/`max_tws` do not change live settings; presets TWS is
      validated against the live `max_tws`.

Tests:

- [ ] `tests/test_restore.py` asserts polar round-trip equality and every listed
      rejection, plus v0 migration.
- [ ] `tests/test_preset_backup.py` asserts presets round-trip equality and every
      listed rejection.
- [ ] Integration tests assert chunked happy paths for both kinds, the shared
      transport rejections (token/seq/cap/expiry/kind), confirm-required-with-
      retainable-staging, and state-untouched-on-failure for both kinds.

Docs:

- [ ] `import-restore.md` added and linked from `TABLEOFCONTENTS.md`.
- [ ] `api.md`, `export-import.md`, `persistence.md`,
      `request-routing-and-static-files.md`, `ui.md`, and `README.md` updated.
- [ ] `npm run check:docs` passes.

Release impact:

- [ ] `tools/check-all.sh` green after every phase and at handoff.
- [ ] No persistence or presets schema change and no new schema versions; existing
      installs are unaffected until a user explicitly restores a backup.

## Related

- [ROADMAP.md](../../ROADMAP.md) - item 1 source
- [exec-plan-authoring.md](../../documentation/guides/exec-plan-authoring.md) - plan contract
- [persistence.md](../../documentation/architecture/persistence.md) - polar schema, migration, atomic write
- [export-import.md](../../documentation/user/export-import.md) - backup shapes, presets store, missing restore
- [api.md](../../documentation/architecture/api.md) - endpoints and dispatch/lock discipline
- [request-routing-and-static-files.md](../../documentation/avnav/request-routing-and-static-files.md) - plugin request contract
- [ui.md](../../documentation/architecture/ui.md) - viewer/settings rendering
- [coding-standards.md](../../documentation/conventions/coding-standards.md),
  [smell-prevention.md](../../documentation/conventions/smell-prevention.md) - binding rules
- [PLAN2.md](../completed/PLAN2.md) - prior ROADMAP-item plan, format reference
