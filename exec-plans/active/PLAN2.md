# PLAN2 — Audit Remediation: Data Safety, Hot Paths, Viewer State, and Gate Cost

## Status

Active. Authored 2026-09-30 from a read-only repository audit; the owner confirmed findings F1–F9 and the tooling
findings as true and asked for every smaller finding to be fixed as well.

This plan is prescriptive about **behavior, contracts, file ownership, and exit conditions**. It is flexible about exact
function bodies, helper names that stay private, and test names, as long as they do not cite this plan or a phase
(`exec-plan-reference`). Repo rules outrank this plan: if a phase conflicts with the 400-line limit, a hotspot budget,
coverage floors, a blocking smell, or `npm run check:all`, amend the plan instead of improvising.

Commit only when the owner asks. Every phase must leave `npm run check:all` green.

## Goal

User-visible outcomes:

1. A startup that cannot load `polar.json` (corrupt or newer schema) never overwrites the unreadable files. Learned-data
   restore, Reset, or upgrading the plugin are the only ways out of that state.
2. An unreadable or too-new `presets.json` is never silently replaced by a normal preset save/delete. A missing
   `presets.json` is a normal state and does not log a warning.
3. A learned-data backup downloaded from the viewer can always be restored for realistic model sizes. Oversized files
   are rejected before any chunk is sent, with a clear message.
4. The polar endpoint and status polling do no redundant per-request work: no histogram re-coercion, no per-grid-cell
   rescan of the whole model, no deep copy just to count bins.
5. Settings-tab messages never discard unsaved edits, the chosen restore file, or typed confirmation text.
6. Preset save/delete/restore keeps the Polar and Export tabs consistent. An API error is never presented as "Connection
   lost".
7. Built-in presets export as CSV at every allowed `max_tws`.

Repository-visible outcomes:

1. Unreachable, test-only, and forwarding production code is removed from `plugin.py` and `server/polarrecorder/`.
2. Viewer duplicates and dead namespace exports are removed.
3. `check:core` loses its redundant re-runs (about 29 s of about 76 s measured). No check loses coverage, and the
   viewer/plugin Vitest projects return to a short default timeout.
4. Dead suppression machinery, frozen baselines that can no longer tighten, empty digest-guarded manifests, and stale
   gate documentation are removed or corrected.

## Finding-to-Deliverable Map

| ID  | Finding                                                                                                                           | Phase |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F1  | Error-state startup still flushes, destroying the unreadable/newer `polar.json` within two flushes                                | 1     |
| F2  | Unreadable/too-new `presets.json` is overwritten by the next preset save/delete; a missing file logs a warning on every read      | 1     |
| F3  | Host config callback path is unreachable from AvNav; its test encodes an impossible state                                         | 1     |
| F4  | Any Settings-tab message re-renders the panel and discards unsaved edits                                                          | 2     |
| F5  | Pretty-printed backup plus 4 MiB import cap makes realistic backups unrestorable; `max_bytes`/`max_chunks` ignored                | 3     |
| F6  | Concurrent uploads collide; `import/abort` ignores its token; restore controls stay enabled; FileReader errors are silent         | 3     |
| F7  | Projection re-coerces every histogram entry and rescans all bins per grid cell; `merge_histograms` is unused while merged inline  | 4     |
| F8  | Status snapshot deep-copies all bins to count them, double-copies counters, and copies current values into a duplicate type       | 4     |
| F9  | Built-in presets (25 kt column) fail CSV export when `max_tws` < 25; grid bound disagrees with viewer editor and model grid       | 5     |
| F10 | `#polar-preset` change listener is added on every preset refresh; harness `addEventListener` overwrites so tests cannot see it    | 6     |
| F11 | Deleted/unknown polar format and any API `ERROR` body show "Connection lost"; presets restore never refreshes preset caches       | 6     |
| F12 | Export delete resets the selection but leaves the grid editors on the deleted preset                                              | 6     |
| F13 | An older polar response can overwrite a newer one; status polls have no in-flight guard                                           | 6     |
| F14 | `ConfigCache` is never refreshed after a settings save; percentile help text hardcodes 65                                         | 6     |
| F15 | A failed first Export-tab config fetch leaves the tab on "Connecting…" until the tab is re-clicked                                | 6     |
| F16 | The 2 s Status rebuild drops the Pause/Resume "Working" state                                                                     | 6     |
| F17 | Dead viewer namespace exports                                                                                                     | 7     |
| F18 | Duplicate viewer helpers (`decisionColor` already diverged, `svgNode`, card header builder)                                       | 7     |
| F19 | Test-only and forwarding production API in domain modules                                                                         | 8     |
| F20 | `duplication:check` passes an `--only` flag the CLI ignores, so all pattern rules run twice                                       | 9     |
| F21 | `docs:check` re-runs five Vitest contract files that `test:tools` already runs                                                    | 9     |
| F22 | `package:check` re-runs release tests; a format test repeats `format:check`                                                       | 9     |
| F23 | `command-graph.test.mjs` spawns full `check:core` runs (18.5 s) and forces a 60 s timeout on every Vitest project                 | 9     |
| F24 | Dead in-source suppression grammar; AGENTS.md and coding standards describe suppression forms the gate forbids                    | 10    |
| F25 | Stale gate docs (removed roles, "signed" graph, attestation, deleted enforcement files); path contract only checks `tools/` paths | 10    |
| F26 | Hotspot budgets are enforced but missing from the smell catalog                                                                   | 10    |
| F27 | Coverage floor ratchet is frozen below the live floors, so it cannot catch a regression to the old values                         | 11    |
| F28 | Empty digest-guarded manifests; one cites a deleted file                                                                          | 11    |
| F29 | Hand-maintained JS test inventory and `tsconfig.tests.json` file list duplicate discovery                                         | 11    |
| F30 | Unread project-profile metadata and role flags                                                                                    | 11    |

## Verified Baseline

Verified on 2026-09-30 against the clean detached `HEAD` at `991a241`.

1. **Plan bookkeeping.** `exec-plans/active/` was empty and `exec-plans/completed/` contains only `PLAN1.md`, so this
   plan is `PLAN2.md`.

2. **Persistence and plugin shell.** `plugin.py::_load_persistence` (`plugin.py:321-332`) sets
   `_startup_error_active = True` and starts with an empty model when `persistence.load()` returns `corrupt_empty` or
   `schema_too_new`.
3. `Plugin.run` flushes periodically (`plugin.py:145`) and once at loop exit (`plugin.py:149`). `_flush`
   (`plugin.py:288`) has no guard for `_startup_error_active`.
4. `persistence.save` moves an existing `polar.json` over `polar.backup.json` on every save (`persistence.py:153`).
5. Reproduction in a temporary directory (schema-2 `polar.json`):
   - Boot 1: ERROR status. After its flush, `polar.json` holds an empty v1 model and `polar.backup.json` holds the v2
     data.
   - Boot 2: loads the empty file without an ERROR. After its flush, both files are empty.
   - Both-corrupt files behave the same way.
6. `tests/test_plugin_integration.py:324` (`test_schema_too_new_error_status_survives_run`) runs through a flush but
   asserts nothing about file contents. It does assert that learning continues in memory
   (`plugin._counters.total_accepted > 0`).
7. Learned-data restore clears `_startup_error_active` (`plugin.py:349-350`). `api_dispatch._reset`
   (`api_dispatch.py:107-114`) does not.
8. `documentation/user/export-import.md:115` states that restoring recovers a plugin that booted from a corrupt or
   too-new `polar.json`. `documentation/user/troubleshooting.md` "Corrupt file recovery" does not mention that the files
   are rewritten.
9. `export._load_user_presets` returns `{}` for three different states:
   - a missing file, with a warning log on every call;
   - a corrupt file, with a warning;
   - a too-new schema, with a warning.

   `save_preset` and `delete_preset` then write the file from that empty map, destroying the unreadable content.

10. `params.EDITABLE_PARAMETERS` is `[]` (`params.py:321`). `plugin.py:97` still registers `_on_config_change`, which
    calls `api_config.apply_host_config_change` (`api_config.py:292`).
11. In the local AvNav core, `AVNPluginHandler.updateConfig` handles `enabled` itself and deletes it. It returns early
    when no keys remain. Otherwise `WorkerParameter.checkValuesFor` drops every key that is not a registered editable,
    so the callback can only ever receive `{}`.
12. `parse_config_values({}, …, previous)` builds a new `Config` object. `_run_iteration` detects supersession by
    identity (`config is not self.config`), so even an empty callback discards the in-flight iteration.
13. `tests/test_plugin_integration.py:178` calls `_on_config_change` with Polar Recorder keys, a state the host cannot
    produce.

14. **Hotspot budgets and file sizes.** `tools/quality-policy/hotspot-budgets.json` budgets versus current non-empty
    lines:

    | File                                   | Current / budget |
    | -------------------------------------- | ---------------- |
    | `plugin.py`                            | **379/379**      |
    | `tests/test_plugin_integration.py`     | 394/398          |
    | `server/polarrecorder/export.py`       | 386/395          |
    | `server/polarrecorder/persistence.py`  | 333/341          |
    | `server/polarrecorder/api_dispatch.py` | 322/338          |
    | `viewer/export-ui.js`                  | 350/369          |

    Any `plugin.py` addition must be offset in the same phase.

15. **Backup and import.** `viewer/settings-ui.js:295` and `:306` download backups as `JSON.stringify(data, null, 2)`.
16. `import_common.MAX_IMPORT_BYTES` is 4 MiB (`import_common.py:13`). `Plugin.MAX_IMPORT_CHUNKS` is 4096. The viewer
    sends `IMPORT_CHUNK_CHARS = 4000` per chunk as sequential GETs (`viewer/import-upload.js:11`).
17. `import/begin` returns `max_bytes` and `max_chunks` (`api_dispatch.py:175-176`). The viewer types and reads only
    `token` (`import-upload.js:13`).
18. Measured `persistence.serialize_to_dict` sizes on synthetic models:

    | Model                     | Compact  | Pretty    |
    | ------------------------- | -------- | --------- |
    | 2880 bins × 20 speed keys | 1.48 MiB | 2.52 MiB  |
    | 5760 bins × 30 speed keys | 3.41 MiB | 6.03 MiB  |
    | 9000 bins × 40 speed keys | 6.01 MiB | 10.97 MiB |

19. `api_dispatch._import_abort` (`api_dispatch.py:223-226`) ignores its token and always clears staging. `import/begin`
    also resets staging (`:167`), and a token mismatch resets it (`:234`).
20. The restore button is never disabled during an upload. `settings-ui.js:159-163` registers no FileReader `error`
    handler.
21. `README.md:163` states that backups are limited to 4 MiB.

22. **Projection and status hot paths.** `projection._raw_bins` (`projection.py:126-132`) re-coerces every histogram key
    and count through `_int_histogram` / `coerce.to_int` (`projection.py:234`). The input is loosely typed as
    `SnapshotBins = Mapping[tuple[int, int], Mapping[str, object]]` (`projection.py:21`), although
    `PolarModel.snapshot_bins()` already guarantees `dict[int, int]` histograms.
23. `_linear_cells` calls `_cell_histogram` (`projection.py:200`) once per grid cell, and each call scans every raw bin.
    `_circular_cells` already assigns each bin in one pass. Both merge histograms inline, while
    `histogram.merge_histograms` has no production caller.
24. `projection` is layer 1 and `polar_model` is layer 2 in `tools/check-py-dependencies.py`, so `projection` cannot
    import `polar_model.SnapshotBin`.
25. Measured `api_handlers.format_polar` for the default preset (13 × 9 cells) on the audit desktop: 44 ms at 1440 bins,
    176 ms at 5760 bins. The profile splits about 46% coercion and 54% cell rescans. A Raspberry Pi is expected to be
    several times slower (not measured).
26. The viewer polls `status` every 2 s (`viewer.js:11`). It refetches `polar` whenever `generation` changed
    (`viewer.js:240`), which is every heartbeat while samples are accepted.
27. `tests/test_projection_scaling_contract.py` counts only `CountingDict.get`/`__setitem__` calls
    (`tests/counting_dict.py`). It sees one histogram read per bin and cannot see the per-cell rescan.
28. `api_dispatch._status_snapshot` (`api_dispatch.py:243-270`):
    - `bins_with_data=len(plugin._model.snapshot_bins())` deep-copies every bin under the lock (about 12 ms at 5760 bins
      on the audit desktop; `len(plugin._model.bins)` takes about 0 ms);
    - `_counters.to_dict()` followed by `dict(...)` copies both histograms twice;
    - `_current_values_snapshot` copies an immutable `diagnostics.CurrentValues` NamedTuple into an identical frozen
      dataclass, `api_handlers.CurrentValuesSnapshot`;
    - `_copy_decision` re-checks `isinstance(reasons, list)` on a producer-guaranteed list.

    `_rejections` deep-copies all bins to read only `rejection_histogram`.

29. `plugin.py:199-202` stores `_last_decision` as a fresh dict every iteration and never mutates it afterwards.

30. **Export grid bound.** Every built-in preset uses `WINDY_TWS = [4, …, 20, 25]` (`export.py:56`).
31. The viewer always sends explicit `twa`/`tws` grids (`export-ui.js:170-177`). `resolve_export_selection` and
    `save_preset` bound TWS by the live `max_tws` (`export.py:233`, `:148`), and `max_tws` accepts 20–60 (`params.py`).
32. `preset_backup.validate_presets(raw, max_tws)` uses the same bound.
33. At `max_tws=20` the default preset raises `Invalid parameter 'tws': expected values 1-20`. The viewer grid editor
    allows 1–60 (`export-presets.js:95`), and the model grid is fixed at `bins.TWS_BIN_MAX = 60`.
34. CSV already renders empty cells as blanks (`export.csv_from_projection`). Routing POL trims columns above `max_tws`
    because it requires every cell (`documentation/user/export-import.md:37-40`); that behavior stays.

35. **Viewer.** Settings re-render: `settings-ui.js:335-339` `setMessage` calls `render()`. `render()` (`:31-41`) clears
    the panel and calls `SourceSettings.Render()`, `EnhancedSettings.Render()`, and `AdvancedSettings.Render()`, each of
    which reloads from the server (`advanced-settings.js:153-184`).
36. Listener stacking: `viewer.js:190-203` `populatePresetSelects` adds a `change` listener on every call. It runs after
    every preset save/delete through `ExportUI` hooks (`export-ui.js:304`, `:320`).
37. Stale polar format and wrong banner:
    - after a delete, `state.polarFormat` keeps the deleted name;
    - the next `polar` request returns `Unknown format` (`export.py:207`);
    - `fetchJson` (`viewer.js:146-163`) treats every `status: "ERROR"` body like a transport failure and shows
      "Connection lost — retrying..." (`viewer.html:22`).
38. Stale caches after restore: a presets restore never refreshes `PresetsCache` (`settings-ui.js:171-185`), and
    `Polarrecorder.RefreshPresets` (`viewer.js:334`) has no caller.
39. Export delete: `export-ui.js:319` calls `SetSelected("DefaultStarboard180")` without `LoadSelected()`, so the
    editors keep the deleted grid.
40. Polar responses: `fetchPolar` (`viewer.js:207-222`) never compares `data.format`, which the server echoes
    (`api_handlers.py:149`), with the current selection.
41. Status polling: `fetchStatus` (`viewer.js:234-245`) has no in-flight guard.
42. `ConfigCache` refresh: `ConfigCache` is fetched once (`viewer.js:295-304`) and never refreshed. `advanced/save` and
    `enhanced/save` return the saved subset as `data.config`.
43. Export-tab config failure: when the first `config` fetch fails, `initExport` only shows the banner, and the
    heartbeat never retries.
44. Percentile help text: `export-fields.js:125` hardcodes "Default 65". The field placeholder uses
    `ConfigCache.percentile` (`export-ui.js:371`).
45. Pause/Resume state: `status-ui.js:78-83` rebuilds the Pause/Resume button on every 2 s render, so the disabled
    "Working" state that `runAction` sets is lost.
46. Test harness: `tools/viewer-harness/fake-dom.mjs` implements `addEventListener` by overwriting a single handler.
47. Dead viewer exports:
    - `Object.defineProperty(Polarrecorder, "fetchJson", …)` (`viewer.js:54`) has no reader;
    - `Polarrecorder.EngineWarning` (`engine-warning.js:134`) has no reader, because the module self-starts on
      `DOMContentLoaded`;
    - `ExportFields.Header`, `ConfidenceField`, and `PercentileHelp` are used only inside `export-fields.js`, yet
      `documentation/architecture/ui.md:43-44` lists them.
48. Duplicate viewer helpers:
    - `decisionColor` exists in `status-ui.js:285` (fallback `--polarrecorder-second-color`) and `timeline-chart.js:227`
      (fallback quarantined);
    - `svgNode` is identical in `timeline-chart.js:238` and `polar-chart-geometry.js:280`;
    - the `card export-card` + `section-head` header is built in `export-fields.js:14`, `settings-ui.js:224`, and
      `advanced-settings.js:154-157`.
49. `viewer.html` loads `dom.js` before `status-ui.js`, `polar-chart-geometry.js`, `timeline-chart.js`,
    `export-fields.js`, `advanced-settings.js`, and `settings-ui.js`.

50. **Test-only and forwarding Python API.** Production helpers used only by tests:

    | Helper                                                                    | Test use                                                                       |
    | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
    | `reader.read_store`                                                       | `tests/test_reader.py`                                                         |
    | `reader._coerce_float`, a wrapper of `enhanced_input.coerce_finite_float` | `tests/test_reader.py:317-330`, which is the only direct test of that behavior |
    | `reader.TWA_KEY`/`TWS_KEY`/`STW_KEY`, aliases of `source_params` defaults | tests only                                                                     |
    | `persistence.save`'s `PolarModel` input mode (`_payload_to_dict`)         | tests; `plugin.py:290` passes a serialized dict                                |
    | `PolarModel.query`                                                        | 7 test call sites                                                              |
    | `ValidationState.observe`                                                 | tests only                                                                     |
    | `export.builtin_preset`                                                   | 3 test call sites                                                              |

    Forwarding and re-export layers:
    - `export.validate_preset_name` only forwards to `_validate_name`;
    - `export.__all__` re-exports projection names "so API handlers and tests keep addressing `export.<name>`".

51. **Quality tooling.** `duplication:check` runs `node tools/check-patterns.mjs --only=…`, but `runPatternCheckCli`
    parses only `--warn` (`tools/check-patterns.mjs:30-31`), so all rules run in both the `standard` and `smells` roles.
    `check:fast` depends on that accident for pattern-rule coverage.
52. `tests/js/command-graph.test.mjs` took 18.55 s for 27 tests in a single run, mostly from tests that spawn a full
    `check:core` in a fixture. `tests/portable-core/portable-role-graph.test.mjs` proves stop-on-failure in-process.
    `vitest.config.mjs:19-22` sets `TEST_TIMEOUT_MS = 60000` for every project, citing those spawn tests.
53. Other duplicated runs:
    - `docs:check` runs five Vitest contract files in separate processes (format, reachability, TOC, smell-catalog,
      pointer), and `test:tools` also runs them. `documentation/conventions/quality-gates.md:40` says they run through
      `test:tools` "instead". AGENTS.md §8 says reachability and the pointer contract are enforced by `docs:check`.
    - `package:check` re-runs four release tests that `test:tools` runs.
    - `tests/js/run-format.test.mjs:53` ("the real repository is already format:check-clean") repeats `format:check`.
54. Dead suppression grammar:
    - in `tools/check-patterns/shared-suppressions.mjs`, every parsed in-source directive is pushed to `invalids`;
    - `suppressionsByLine` is never populated, so `isLintSuppressed()` always returns false and the filter in
      `tools/check-patterns/runner.mjs:57-60` is a no-op;
    - `tools/portable-core/suppression-engine.mjs:36` already rejects every in-source suppression spelling.
55. Contradicting suppression docs: `AGENTS.md:212` and `documentation/conventions/coding-standards.md:73` describe a
    "specific codes plus reason" Python suppression form as allowed, and `coding-standards.md:119` describes a
    checker-ignore comment form. `coding-standards.md:126` and `check:suppressions` forbid both.
56. Stale gate docs:
    - `quality-gates.md:21` calls the role graph "signed", and `:25` lists `portable-core, generic-surface, standalone`
      roles that commit `7f12638` removed;
    - `testing-infrastructure.md:131-134` still mentions an emitted attestation;
    - `smell-prevention.md:94-95` cites `test-plugin-mjs.mjs` and `test-viewer-*.mjs`, which no longer exist.
57. Hotspot budgets are enforced by `tests/js/hotspot-budgets.test.mjs` but have no row in `smell-prevention.md`.
58. Frozen coverage baseline: `tools/quality-policy/coverage-floor-baseline.json` is derived from the frozen
    `baseline-coverage-capture.json` (digest-pinned in `tests/test_baseline_captures.py`). The live floors are higher
    (`viewer/viewer.js` 80 vs 45; `viewer/export-ui.js` and `viewer/settings-ui.js` 80 vs 60), so the ratchet no longer
    constrains them.
59. Empty manifests:
    - `tools/quality-policy/planned-quality-fixtures.json` (`plannedFixtures: []`) and `test-exception-baseline.json`
      (`exceptions: []`) are digest-guarded empty manifests;
    - the latter cites a deleted `baseline-test-inventory.json`;
    - `tests/fixtures/` does not exist.
60. `tools/quality-policy/test-inventory.json` (every entry `strict`) and `tsconfig.tests.json`'s `files` list each
    changed in 12 commits.
61. Byte-identical portable-core files: comparing against the sibling Dyninstruments checkout,
    - identical: `complexity-engine`, `coverage-engine`, `doc-link-engine`, `file-size-engine`, `focused-test-engine`,
      `format-engine`, `gate-orchestrator`, `generic-rule-duplicates`, `generic-rule-engine`, `generic-rule-structural`,
      `hook-engine`, `json`, `path-policy`, `release-engine`, `schema-engine`, `suppression-engine`,
      `test-inventory-engine`;
    - different: `gate-role-engine`, `generic-rule-common`, `generic-rule-contracts`.

## Hard Constraints

- Runtime Python stays Python 3.9+ stdlib only. No AvNav imports in `server/polarrecorder/`. The single ordinary lock
  stays owned by `plugin.py`, and domain modules stay lock- and thread-unaware.
- The viewer stays plain scripts under `window.Polarrecorder`. No bundler, modules, or runtime dependencies.
- The `polar.json` schema stays at `CURRENT_SCHEMA_VERSION = 1`. API response shapes stay unchanged, apart from the
  documented `import/abort` token scoping (Phase 3) and error-message text for the TWS grid bound (Phase 5).
- Do not edit the byte-identical portable-core files listed in baseline fact 61. Unregister or stop calling them at the
  project level instead.
- The hotspot budgets in fact 14 and the 400-non-empty-line limit bind every phase. `plugin.py` must be net ≤ 0
  non-empty lines per phase. Budgets may not be raised.
- Never lower a coverage floor, add a suppression, skip a test, or weaken an assertion to reach green. When code moves
  between viewer files and a per-file floor would drop, add tests.
- No test, function, comment, or doc outside `exec-plans/` may cite `PLAN2` or a phase number.
- This plan file lives in `exec-plans/active/`, so `check:suppressions` scans it. Never write literal in-source
  suppression spellings in it, or in any maintained file.
- New JS test files must be registered through `npm run inventory:write` and in `tsconfig.tests.json` until Phase 11
  replaces that mechanism.
- Gates must not read sibling directories. The portable-parity comparison in fact 61 is a manual pre-flight only.

## Implementation Order

### Execution Prerequisite

On the clean tree, run `npm run check:all` once and record its pass counts and the `check:core` wall time in the
Progress section below, as the before-state.

### Phase 1 — Stop overwriting unreadable persistence files and retire the unreachable host callback

Intent: once a startup load fails, no automatic write may touch `polar.json` or `polar.backup.json`, and preset writes
must not replace an unreadable `presets.json`.

Dependencies: none.

Deliverables:

1. Persistence guard in `plugin.py`:
   - while `_startup_error_active` is true (read under the lock), `_flush` performs no `persistence.save` call. It still
     clears `_flush_requested`;
   - learning continues in memory, as today.
2. Reset clears the error state: `server/polarrecorder/api_dispatch.py::_reset` captures and clears
   `_startup_error_active` under the lock. After releasing the lock, it calls
   `plugin._set_status("STARTED", "Polar Recorder started")` when it was set, mirroring learned-data restore. The
   requested flush then writes normally.
3. Host callback: `plugin.py::_on_config_change` ignores its argument and never replaces `self.config`. Its docstring
   states that AvNav delivers no Polar Recorder keys to it, because `EDITABLE_PARAMETERS` is empty, and that the viewer
   save path owns runtime configuration. Delete `api_config.apply_host_config_change` and drop the now-unused
   `api_config` import from `plugin.py`. Keep the `registerEditableParameters` call, which is the documented host
   contract.
4. `plugin.py` line budget: keep it at ≤ 379 non-empty lines. If deliverables 1 and 3 do not net to ≤ 0, collapse the
   duplicated fallback branches in `_read_plugin_version` without changing its behavior or its tests.
5. Presets in `server/polarrecorder/export.py`:
   - `_load_user_presets` distinguishes a missing file (returns `{}` silently) from an unreadable or too-new file
     (returns `{}` with the existing warning for readers);
   - `save_preset` and `delete_preset` raise `ExportError` with a user-actionable message ("presets.json is unreadable;
     restore a presets backup or remove the file") instead of writing;
   - `replace_user_presets` (presets restore) keeps replacing, because it is the explicit recovery path;
   - stay ≤ 395 non-empty lines.
6. Tests:
   - new `tests/test_startup_error_persistence.py`:
     - a schema-too-new boot through periodic and final flushes leaves `polar.json` byte-identical and creates no
       backup;
     - a both-corrupt boot leaves both files byte-identical;
     - Reset during the error state clears it, reports `STARTED`, and the next flush writes;
     - learned-data restore during the error state writes on the next flush;
   - in `tests/test_plugin_integration.py`, delete
     `test_config_hot_swap_replaces_config_without_resetting_validation_state`;
   - in `tests/test_avnav_registration_contract.py`, add a test that the registered callback invoked with `{}` leaves
     `plugin.config` as the identical object;
   - in `tests/test_export.py`, cover: save and delete over corrupt and too-new `presets.json` raise and leave the file
     byte-identical; a missing file logs no warning; `replace_user_presets` replaces a corrupt file.

Exit conditions:

- `python -m pytest tests/test_startup_error_persistence.py tests/test_export.py tests/test_avnav_registration_contract.py tests/test_plugin_integration.py tests/test_import_flow.py -q`
  passes;
- `tests/js/hotspot-budgets.test.mjs` passes;
- `npm run check:all` is green.

### Phase 2 — Make Settings-tab messages non-destructive

Intent: a status message updates only the message line, never the cards.

Dependencies: none. This phase is a prerequisite for Phase 3's upload progress messages.

Deliverables:

1. `viewer/settings-ui.js`: `render()` runs only from `init`. `setMessage` updates the existing message node's text and
   class in place, keeping a reference in `state` as `advanced-settings.js` already does with `state.messageNode`.
2. New `tests/js/viewer-settings.test.mjs`, registered per the Hard Constraints, covering:
   - an edited Advanced input keeps its value after a backup-download message;
   - a restore validation error keeps the chosen file and the typed confirmation text;
   - the message renders once, with the right class.

Exit conditions: `npm run test:viewer` passes and `npm run check:all` is green.

### Phase 3 — Align the backup/restore size contract and make uploads single-flight

Intent: every realistic backup the viewer downloads can be restored, oversized files fail before any chunk is sent, and
one tab's failure cannot abort another tab's upload.

Dependencies: Phase 2.

Deliverables:

1. Compact downloads: `viewer/settings-ui.js` downloads both backups as compact JSON (`JSON.stringify(data)`).
2. Pre-flight check in `viewer/import-upload.js`:
   - after `import/begin`, compute the UTF-8 byte length (`TextEncoder`) and the chunk count;
   - if either exceeds `max_bytes`/`max_chunks`, abort that token and report a message that names the file size and the
     limit in MiB, without sending chunks;
   - report progress through a callback, which `settings-ui.js` shows as "Uploading backup… n / N".
3. Upload single-flight in `viewer/settings-ui.js`:
   - both Restore buttons and file inputs stay disabled while an upload runs and are re-enabled when it settles;
   - a FileReader `error` listener routes the error to `setMessage(..., "error")`.
4. Token-scoped abort in `server/polarrecorder/api_dispatch.py::_import_abort`:
   - clears staging only when `token` equals the active token;
   - no active import, or a different token, returns `ok({})` without changes.
5. Import cap: raise `server/polarrecorder/import_common.MAX_IMPORT_BYTES` to 12 MiB (12,582,912). The constraint
   `MAX_IMPORT_BYTES ≤ Plugin.MAX_IMPORT_CHUNKS × 4000` (16,384,000) must hold, so the chunk cap never binds first for
   ASCII JSON. `import-restore.md` documents the relationship.
6. Tests:
   - `tests/test_import_flow.py`: abort with a foreign token keeps the active staging; abort with the matching token
     clears it;
   - `tests/test_restore.py`: a compact serialized 5760-bin × 30-key synthetic model passes `validate_and_build`;
   - `tests/js/viewer-settings.test.mjs`: downloads contain no indentation; an oversized backup fails before the first
     `import/chunk`; the restore controls are disabled mid-upload; a FileReader error is surfaced.

Exit conditions: the focused Python and viewer tests pass and `npm run check:all` is green.

### Phase 4 — Remove redundant work from projection and status hot paths

Intent: polar and export projection trust the model snapshot contract and assign each bin once; status polling snapshots
only what it formats.

Dependencies: none.

Deliverables:

1. Snapshot type in `server/polarrecorder/projection.py`:
   - define a minimal local `TypedDict` with `histogram: dict[int, int]` and type `SnapshotBins` values with it, so
     `polar_model.SnapshotBin` stays structurally compatible;
   - read `data["histogram"]` directly and delete `_int_histogram` and the `isinstance` guard.
2. Single-pass projection:
   - `_linear_cells` assigns each raw bin to its TWA and TWS interval in one pass, preserving the half-open intervals,
     the closed last interval, and the starboard/port exclusion semantics;
   - `_linear_cells` and `_circular_cells` accumulate through `histogram.merge_histograms` instead of inline loops;
   - `project_folded_grid` inherits the change.
3. Equivalence and boundary proof:
   - before replacing the old implementation, compare old and new outputs with a throwaway script outside the
     repository. Cover the 5760-bin synthetic model plus a few random models, for all four built-in presets, one custom
     grid, and `project_folded_grid` on the routing grid. Record "identical" in the Progress section. Do not commit a
     reference re-implementation;
   - add permanent boundary tests to `tests/test_export.py` for:
     - a bin exactly on a midpoint;
     - the closed last interval at 180 (starboard) and 360 (port);
     - port bins excluded from a starboard grid and the reverse;
     - the TWS last interval closed at 60.
4. Scaling contract: `tests/counting_dict.py` also counts `__getitem__`, so `check:scaling` still measures one read per
   bin after the switch from `.get`. Retype the fixture builders in `tests/scaling_contract_fixtures.py` to the new
   `TypedDict`.
5. Status and rejections snapshots in `server/polarrecorder/api_dispatch.py`:
   - `bins_with_data=len(plugin._model.bins)`;
   - top rejections and predicates come from the live histograms under the lock (sorting already creates new lists), and
     totals come from the counter attributes;
   - `_rejections` copies only each bin's `rejection_histogram`, using `iter_bins()`.
6. Current values: delete `api_handlers.CurrentValuesSnapshot` and `_current_values_snapshot`, and type
   `StatusSnapshot.current_values` as `diagnostics.CurrentValues | None` (a `TYPE_CHECKING` import; update `Depends:`).
   Update `tools/check-runtime-contracts.py`.
7. Last decision: `plugin.py` stores `_last_decision` as an immutable `(decision, reason_codes)` tuple.
   `api_handlers.format_status` formats `{"state": …, "reason_codes": [...]}`, so the response shape stays unchanged.
   Delete `_copy_decision`.
8. Record `format_polar` timings for the 1440- and 5760-bin synthetic models, before and after, in Progress. These
   numbers are informative and not gated; the expected result is at least 3× faster at 5760 bins.

Exit conditions:

- `npm run check:scaling` passes;
- `tests/test_export.py`, `tests/test_routing_pol.py`, `tests/test_api_handlers.py`, and
  `tools/check-runtime-contracts.py` pass;
- `tests/mock-data/status.json` still matches (its shape is unchanged);
- `npm run check:all` is green.

### Phase 5 — Bound export grids by the model grid, not the rejection ceiling

Intent: built-in and user presets export at every allowed `max_tws`, and columns above it stay blank.

Dependencies: Phase 1 (it touches `export.py` under the same budget).

Deliverables:

1. `server/polarrecorder/export.py`: `save_preset` and `resolve_export_selection` bound TWS grid values by
   `bins.TWS_BIN_MAX`. Remove the now-unused `max_tws` parameters and update their callers in `api_dispatch.py` and
   `api_export.py`.
2. `server/polarrecorder/preset_backup.validate_presets`: drop the `max_tws` parameter, bound by `TWS_BIN_MAX`, and
   update `plugin.py::_apply_presets_restore`.
3. Routing POL keeps its documented trimming at `max_tws`.
4. Tests:
   - `tests/test_export.py`: the default preset exports at `max_tws=20` with a blank 25 kt column; a 25 kt custom grid
     is accepted at `max_tws=20`; 61 is rejected;
   - `tests/test_preset_backup.py`: a 25 kt preset is accepted independent of `max_tws`.

Exit conditions: the focused tests pass and `npm run check:all` is green.

### Phase 6 — Fix viewer preset, polling, and cache state defects

Intent: preset changes, API errors, settings saves, and polling keep every tab consistent and honest.

Dependencies: Phases 2 and 5.

Deliverables:

1. Harness first: `tools/viewer-harness/fake-dom.mjs` `addEventListener`/`removeEventListener` keep a per-type listener
   list, and dispatch calls every listener. Fix any existing test that relied on overwrite semantics.
2. `viewer/viewer.js` presets:
   - bind the `#polar-preset` change listener once in `init`;
   - `populatePresetSelects` only rebuilds options. It first resets `state.polarFormat` to the first cached preset when
     the current name is absent.
3. `viewer/viewer.js` errors:
   - `fetchJson` marks API `ERROR` bodies distinctly from transport or HTTP failures;
   - the banner keeps "Connection lost — retrying..." for transport failures;
   - for API errors in background fetches, the banner shows the server message instead ("Polar Recorder error: …").
     `hideBanner` restores the default text.
4. `viewer/viewer.js` polling:
   - `fetchPolar` drops a response whose `data.format` differs from `state.polarFormat`;
   - the heartbeat skips `fetchStatus` while one is in flight;
   - the heartbeat retries `initExport()` while the Export tab is active and uninitialized.
5. Pause/Resume: `viewer/viewer.js` and `viewer/status-ui.js` keep the pending Pause/Resume endpoint in viewer state, so
   the rebuilt button renders disabled with "Working" until the action settles.
6. Presets restore refresh: `viewer/settings-ui.js` calls `Polarrecorder.RefreshPresets()` after a successful presets
   restore.
7. Export delete: `viewer/export-ui.js` calls `LoadSelected()` after `SetSelected(...)` on delete, within its 369-line
   budget.
8. `ConfigCache` refresh: `viewer/advanced-settings.js` and `viewer/enhanced-settings.js` merge the returned
   `data.config` into `Polarrecorder.ConfigCache` when it is loaded, then re-render the Export tab through its existing
   re-render entry point when it is initialized.
9. `viewer/export-fields.js`: the percentile help text interpolates the configured default percentile passed in by
   `export-ui.js`.
10. Tests, in the existing `viewer-*.test.mjs` files or `viewer-settings.test.mjs`:
    - N preset refreshes produce exactly one `polar` fetch per selection change;
    - deleting the selected polar preset falls back without showing a banner;
    - an API `ERROR` body shows the server message, not "Connection lost";
    - a stale-format polar response is ignored;
    - status is single-flight;
    - the Export tab recovers after a failed first config fetch;
    - `ConfigCache` is updated after an Advanced save;
    - the export editors hold the default grid after a delete;
    - the Pause button stays disabled across a re-render while pending;
    - the help text shows a non-65 percentile.

Exit conditions: `npm run test:viewer` passes, `npm run test:coverage:check` passes with no floor lowered, and
`npm run check:all` is green.

### Phase 7 — Remove dead viewer exports and duplicate helpers

Intent: every exported viewer member has a reader, and every shared helper has one owner.

Dependencies: Phase 6.

Deliverables:

1. Delete the `Object.defineProperty(Polarrecorder, "fetchJson", …)` alias and the `Polarrecorder.EngineWarning` export.
   Remove `Header`, `ConfidenceField`, and `PercentileHelp` from the `ExportFields` export object. Update
   `types/polarrecorder-globals.d.ts`.
2. Add `Polarrecorder.Dom.SvgNode` and `Polarrecorder.Dom.Card(title)` to `viewer/dom.js`. `Card` emits the existing
   `section.card.export-card` + `.section-head > h2` markup, so the CSS is unchanged.
3. Move callers to the new helpers:
   - `polar-chart-geometry.js`, `polar-chart.js`, and `timeline-chart.js` use `Dom.SvgNode`, and `PolarChartGeometry`
     stops exporting its own `SvgNode`;
   - `export-fields.js` (`Section`), `settings-ui.js`, and `advanced-settings.js` use `Dom.Card`, along with any other
     hand-built copy that `grep -n '"card export-card"' viewer/*.js` finds.
4. `viewer/status-ui.js` exports `DecisionColor`, keeping the `--polarrecorder-second-color` fallback, and
   `timeline-chart.js` uses it.
5. Update the `Depends:` headers, `documentation/architecture/ui.md` (export lists and helper owners), and any test that
   referenced a removed member.

Exit conditions:

- `tests/js/viewer-structure-contract.test.mjs` and `viewer-dependency-contract.test.mjs` pass;
- `npm run typecheck:source` passes;
- the coverage inventory passes with no floor lowered;
- `npm run check:all` is green.

### Phase 8 — Remove test-only and forwarding production API

Intent: production modules expose only what production code calls.

Dependencies: Phases 1, 4, and 5 (they touch the same modules).

Deliverables:

1. `server/polarrecorder/reader.py`: delete `read_store`, `_coerce_float`, and the `TWA_KEY`/`TWS_KEY`/`STW_KEY`
   aliases. Tests use `StoreReader(...).read()` and the `source_params` defaults.
2. Move `test_coerce_float_rejects_booleans_and_is_total` to target `enhanced_input.coerce_finite_float` directly, in
   `tests/test_input_timestamps.py` or a new `tests/test_enhanced_input.py`, so that behavior keeps a direct test.
3. `server/polarrecorder/persistence.py`: `save` accepts only a serialized dict. Delete `_payload_to_dict` and the
   `counters`/`metadata` parameters, and have tests call `serialize_to_dict` first.
4. Move `PolarModel.query` and `ValidationState.observe` into test helpers in `tests/validation_helpers.py`, and update
   the call sites.
5. `server/polarrecorder/export.py`:
   - delete `builtin_preset`, and have tests use `resolve_polar_preset(tmp_path, {})`;
   - rename `_validate_name` to the public `validate_preset_name` and delete the forwarder;
   - delete the `__all__` re-export block and its comment; `api_handlers.py`, tests, and
     `tools/check-runtime-contracts.py` import projection names from `projection`.
6. Keep `tools/check-py-contracts.py` `_CANONICAL_HELPERS` equal to reality, and grep `documentation/` for every removed
   name.

Exit conditions: `npm run check:python-contracts`, `npm run typecheck:python`, and `npm run test:coverage:python` pass
with coverage ≥ the configured floors, and `npm run check:all` is green.

### Phase 9 — Remove redundant work from the quality gate

Intent: every check runs exactly once per `check:all`, and the slow subprocess tests shrink to the two that prove
something new.

Dependencies: none (can run in parallel with Phases 1–8 if coordinated).

Deliverables:

1. `package.json` duplication and fast path:
   - `duplication:check` is `jscpd --config jscpd.config.json` only;
   - `check:fast` becomes `check:standard && check:patterns && typecheck && test:unit`, so the fast path keeps the
     pattern rules it runs today by accident.
2. `package.json` docs and packaging:
   - `docs:check` drops the five Vitest rungs, keeping `docs:lint`, `docs:links:proof`, and `docs:links`;
   - the five `docs:*` convenience scripts stay runnable individually;
   - `package:check` drops its inline Vitest release run.
3. Remove the "real repository is already format:check-clean" test from `tests/js/run-format.test.mjs`. Update
   `tests/js/docs-check-composition-contract.test.mjs` to the new `docs:check` composition.
4. `tests/js/command-graph.test.mjs`:
   - keep one passing and one failing spawned `check:core` fixture test;
   - before deleting the per-role spawn tests, confirm that `tests/portable-core/portable-role-graph.test.mjs` proves
     stop-on-failure for every role in-process, and extend that in-process test first if a role is missing;
   - replace exact-string assertions on `setup` and `check:fast` with order and structure assertions;
   - rename the duplicate-leaf test so it states that it detects duplicate npm-script reachability only.
5. `vitest.config.mjs`: the viewer and plugin projects use Vitest's default timeout. Only the tools project keeps an
   elevated timeout, if the two remaining spawn tests need it, and the comment is updated.
6. Docs:
   - `documentation/conventions/quality-gates.md` (`duplication:check`, `docs:check`, `package:check`, `check:fast`
     rows);
   - `documentation/conventions/testing-infrastructure.md`;
   - `CONTRIBUTING.md` wherever `check:fast` or `docs:check` is described;
   - AGENTS.md §8: the reachability and pointer contracts are enforced by the Vitest doc contracts in `test:tools`.
7. Record the `check:core` wall time after the change in Progress. It is informative; the expected saving is ≥ 25 s on
   the same machine.

Exit conditions: `npm run test:tools` and `npm run docs:check` pass, `npm run check:all` is green, and a gate trace
shows each removed run still executes exactly once elsewhere.

### Phase 10 — Delete dead suppression machinery and correct gate documentation

Intent: the docs describe exactly the gate that runs, and code that can never fire is gone.

Dependencies: Phase 9.

Deliverables:

1. Dead suppression grammar:
   - `tools/check-patterns/runner.mjs`: remove the `isLintSuppressed` filter and keep the configured-exception filter;
   - `tools/check-patterns/shared-suppressions.mjs` and `shared.mjs`: remove `isLintSuppressed`,
     `getInvalidLintSuppressions`, and the `suppressionsByLine` plumbing;
   - unregister the `invalid-lint-suppression` rule in `tools/check-patterns/rules.mjs` and
     `tools/quality-policy/project-pattern-scopes.json`, leaving the byte-identical portable implementation untouched;
   - `check:suppressions` stays the single owner;
   - update `tests/js/pattern-suppression.test.mjs`, and confirm that the suppression-engine tests cover every spelling
     the removed rule covered.
2. Suppression docs: `AGENTS.md` §10, `coding-standards.md:73-77` and `:119-122`, and the `smell-prevention.md`
   suppression rows state one rule: no in-source suppressions; fix the root cause; `check:suppressions` enforces it.
   Update the smell-catalog linter's required-rule list in `tests/js/smell-catalog-contract.test.mjs` to match.
3. Gate docs:
   - `quality-gates.md`: the role order equals `check:core`'s `--roles` list, and "signed" is removed;
   - `testing-infrastructure.md`: remove the attestation sentence and keep the isolated-copy proof;
   - `smell-prevention.md`: enforcement cells name `tests/js/plugin-entrypoints.test.mjs` (`npm run test:plugin`) and
     `tests/js/viewer-*.test.mjs` (`npm run test:viewer`).
4. `tests/js/tool-path-existence-contract.test.mjs` also resolves backticked `tests/…` paths and simple globs in
   documentation tables, so enforcement cells cannot go stale again.
5. Add a "Hotspot budget" row to `smell-prevention.md` (owner `tests/js/hotspot-budgets.test.mjs` via `test:tools`) and
   register it with the catalog linter. Mention the budgets in the `coding-standards.md` file-size bullet.

Exit conditions: `npm run check:suppressions`, `npm run test:tools`, and `npm run docs:check` pass, and
`npm run check:all` is green.

### Phase 11 — Retire frozen baselines, empty manifests, and duplicated inventories

Intent: policy data that cannot fail, or only restates discovery, is removed, without losing any guarantee a live check
provides.

Dependencies: Phase 10.

Deliverables:

1. Coverage floor ratchet:
   - `tools/quality-policy/coverage-floor-baseline.json` becomes a directly reviewed ratchet equal to the current
     `coverage-floors.json` values, including the viewer/plugin family floors and every per-file floor;
   - `check-coverage-inventory.mjs` keeps "floors ≥ baseline";
   - delete `baseline-coverage-capture.json`, `tools/quality-policy/coverage-inventory/floor-baseline.mjs`'s derivation,
     the capture digest and derivation tests in `tests/test_baseline_captures.py` (delete the file if empty), and any
     format-scope exemption for the capture;
   - update `ARCHITECTURE.md`, `testing-infrastructure.md`, and the smell-prevention "Coverage floor regression" row.
2. Empty manifests: delete `planned-quality-fixtures.json` and `test-exception-baseline.json`, together with their
   digest anchors and loops in `tools/quality-policy/test-inventory.mjs` and `tests/js/test-inventory.test.mjs`.
3. JS test inventory:
   - switch `tsconfig.tests.json` from a `files` list to `include` globs that match live discovery;
   - if `typecheck:tests` still fails on a type error in any discovered JS test or helper, and on a discovered file
     outside the type-check scope, retire `test-inventory.json` and its write/verify logic in the project wrapper,
     leaving the byte-identical portable engine untouched;
   - if either guarantee would be lost, keep the inventory and record the reason in Progress.
4. Profile metadata: in `tools/quality-policy/project-profile.json` and `portable-role-graph.json`, remove every field
   and role flag that no code reads beyond validation. Verify each field with `git grep` before removing it. Keep
   `requiredOrder`, `adapters`, and the orchestrator's order, duplicate, recursion, and stop-on-failure checks. Update
   the project `gate-role-engine.mjs` validation and its tests.

Exit conditions: `npm run typecheck`, `npm run test:tools`, and `npm run test:coverage:check` pass, and
`npm run check:all` is green.

### Phase 12 — Final integration

Intent: prove the whole remediation from a clean state.

Dependencies: Phases 1–11.

Deliverables:

1. `npm run check:all` passes in the normal checkout and in a fresh isolated copy that contains only this repository
   (required by AGENTS.md §8 for broad tooling changes).
2. Add manual host checks to `documentation/guides/manual-avnav-validation.md`:
   - booting with a newer-schema `polar.json` leaves the files untouched;
   - Reset leaves the error state;
   - a compact backup of about 3 MiB restores.

   Run them if hardware is available; otherwise record them as open.

3. Fill in Progress with before/after gate counts, timings, and the Phase 4 equivalence result. Move this plan to
   `exec-plans/completed/`.

Exit conditions: both full-gate runs pass, and Progress is complete.

## Documentation Impact

| Document                                              | Change                                                                                               | Phase   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| `README.md`                                           | Backup limit 12 MiB and compact download; error-boot data safety sentence near the `polar.json` path | 1, 3    |
| `documentation/architecture/persistence.md`           | No writes while a startup load error is active; Reset/restore resume writes                          | 1       |
| `documentation/user/troubleshooting.md`               | Corrupt/too-new recovery keeps files; recovery options; unreadable presets block save/delete         | 1       |
| `documentation/user/export-import.md`                 | Restore wording (`:115`); size limit; TWS grid bound 1–60 with blank columns (`:29`, `:118`)         | 1, 3, 5 |
| `documentation/avnav/editable-parameters.md`          | Hot-change callback row: registered for the host contract, receives nothing, ignores input           | 1       |
| `documentation/architecture/import-restore.md`        | Token-scoped abort, 12 MiB cap and chunk relation, pre-flight check, compact download                | 3       |
| `documentation/architecture/api.md`                   | `import/abort` row; grid bound error text                                                            | 3, 5    |
| `documentation/architecture/ui.md`                    | Settings message behavior, banner semantics, helper owners, export lists                             | 2, 6, 7 |
| `documentation/conventions/quality-gates.md`          | Script compositions, role order, remove "signed"                                                     | 9, 10   |
| `documentation/conventions/testing-infrastructure.md` | Attestation sentence, inventory, coverage ratchet, timeouts                                          | 9–11    |
| `documentation/conventions/smell-prevention.md`       | Suppression rows, stale enforcement cells, hotspot row, coverage ratchet row                         | 10, 11  |
| `documentation/conventions/coding-standards.md`       | Suppression bullets, hotspot mention                                                                 | 10      |
| `AGENTS.md`                                           | §8 docs enforcement sentence; §10 suppression bullet                                                 | 9, 10   |
| `ARCHITECTURE.md`, `CONTRIBUTING.md`                  | Coverage capture removal; `check:fast`/`docs:check` descriptions                                     | 9, 11   |
| `documentation/guides/manual-avnav-validation.md`     | New host checks                                                                                      | 12      |

AGENTS.md §12 fixture sync:

- no API response shape changes, so `tests/mock-data/status.json` and `timeline.json` stay valid (re-verify in Phase 4);
- export/import format: the server `export/json` payload is unchanged, and `tests/mock-data/export-json.json` stays;
- presets validation changes in Phase 5 update `tests/test_preset_backup.py`, and `tests/mock-data/presets.json` stays
  valid.

## Acceptance Criteria

### Behavior

- After a `corrupt_empty` or `schema_too_new` boot, no code path writes `polar.json`/`polar.backup.json` until
  learned-data restore or Reset. After either, writes resume and the status returns to `STARTED`.
- Preset save/delete over an unreadable or too-new `presets.json` fails with a clear message and leaves the file
  unchanged. A missing file logs nothing.
- Viewer backups are compact. A 5760-bin × 30-key model restores. An oversized file fails before the first chunk.
  `import/abort` with a foreign token changes nothing.
- `format_polar` no longer calls `coerce.to_int`, and assigns each bin once. `_status_snapshot` makes no deep copy of
  bins.
- The default preset exports at `max_tws=20`.
- Settings messages preserve edits. Preset refreshes add no listeners. API errors never show "Connection lost". Stale
  polar responses are dropped. `ConfigCache` reflects saved settings.

### Tests and quality

- Every phase leaves `npm run check:all` green. No suppression, skip, lowered floor, or raised hotspot budget.
- New regression tests exist for every behavior bullet above.
- `check:core` wall time drops by at least 25 s on the same machine (informative). The viewer and plugin Vitest projects
  use the default timeout.
- No byte-identical portable-core file from fact 61 changed (`git diff --stat` on those paths is empty).

### Documentation

- Every row of the Documentation Impact table is done. `npm run docs:check` passes. No maintained doc cites a removed
  file, role, or suppression form.

### Release impact

- The next release notes mention:
  - error-boot data protection;
  - compact backups and the 12 MiB limit;
  - unreadable-presets protection;
  - the CSV grid bound fix;
  - the viewer fixes.
- This plan performs no release.

## Progress

- Before-state (`check:all` counts, `check:core` wall time), measured 2026-10-04 on `817d069`, the clean tree at
  implementation start (it carries ten commits after the audited `991a241`): `check:all` green. `check:core`: pytest 472
  passed; `test:tools` 46 files / 366 tests (55.9 s); `test:viewer` 12 files / 67 tests; `test:plugin` 1 / 1;
  `check:scaling` 26 passed; `package:check` release Vitest 4 files / 36 tests; the five `docs:check` Vitest rungs 25
  tests. Coverage half: pytest 472 passed at 96.47 %; viewer + plugin 13 files / 68 tests at 93.39 % lines / 75.82 %
  branches. `check:core` wall time on the implementation machine: 100.9 s.
- Phase 4 old/new projection equivalence: **identical**. A throwaway script outside the repository loaded the old
  `projection.py` beside the new one and compared `project_grid` for the 5760-bin synthetic model plus four seeded
  random models (100 to 6000 bins, including empty and zero-count histograms and bins on every interval edge, both sides
  of 180 deg, and TWS 60) over the four built-in presets and three custom grids (starboard, full-circle, port), at
  percentiles 10/50/65/95 and floors 1/30/50, plus `project_folded_grid` on the routing grid: 560 comparisons covering
  30,124 non-empty projected cells, all equal. No reference implementation was committed.
- Phase 4 `format_polar` timings before/after (default preset, 13 x 9 cells, median of 15 runs on the implementation
  machine): 1440 bins 43.3 ms -> 4.2 ms; 5760 bins 179.4 ms -> 16.1 ms (about 11x faster).
- Phase 9 `check:core` wall time after: _pending_
- Phase 11 inventory decision: _pending_

## Related

- [Core principles](../../documentation/core-principles.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Persistence](../../documentation/architecture/persistence.md)
- [Import and restore](../../documentation/architecture/import-restore.md)
- [Viewer UI](../../documentation/architecture/ui.md)
- [Execution plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Completed PLAN1](../completed/PLAN1.md)
