# PLAN2 - Full 360 degree polar support (port/starboard asymmetry)

**Status:** Active. Authoritative implementation source for ROADMAP item 1 until
moved to `exec-plans/completed/`. Prescriptive parts: the verified baseline, hard
constraints, phase deliverables, exit conditions, and acceptance criteria. Flexible
parts: helper names, internal function decomposition, and test-case naming, provided
the exit conditions and constraints hold.

This plan covers ROADMAP item 1 only. Items 2-5 (restore/import, optional signal
hooks, dashboard widgets, dyninstruments palette) are explicitly out of scope and
must not be touched.

## Goal

User-visible outcomes after completion:

1. A new built-in preset `Default180` is the default polar/export grid everywhere
   `windy` is the default today. It covers the starboard half only, 0 deg to 180 deg
   in 15 deg steps, reusing the Windy TWS bands.
2. A new built-in preset `Default360` provides full-circle coverage, 0 deg to 345 deg
   in 15 deg steps (wrapping at 360 deg back to 0 deg), reusing the Windy TWS bands,
   so port and starboard performance can be compared directly.
3. The legacy `windy` preset remains selectable and built-in (still the irregular
   Windy.com passage-planner angles), but is no longer the default.
4. The polar diagram and CSV export record, display, and emit true port/starboard
   asymmetry. A 180 deg preset behaves exactly as today for starboard data; a 360 deg
   preset additionally draws labelled TWA sectors on the port (left) half using
   absolute 0-359 deg values.
5. CSV export accepts and emits TWA grid values above 180 deg.

Repository-visible outcomes:

1. The projection-time 0-180 deg fold is removed; projection, API, viewer, and CSV
   carry true 0-359 deg TWA end to end.
2. `tools/check-all.sh` is green, including ruff, `mypy --strict`, pytest, and the
   Node check scripts.
3. Updated tests assert de-folded projection, the two new presets, above-180 deg CSV
   emission, and the viewer port-label behaviour.
4. `README.md` and the mapped documentation describe the new presets, the asymmetry
   behaviour, and the per-bin density consequence of de-folding.

## Verified Baseline

Facts checked against current repository files and tooling.

1. The model already stores true 0-359 deg TWA. `bins.twa_bin` is
   `round(twa_deg_raw / TWA_BIN_SIZE) % 360` ([bins.py:30-33](../../server/polarrecorder/bins.py#L30-L33)),
   and `PolarModel._bin_for_sample` keys on `sample.twa_deg_raw`
   ([polar_model.py:97-103](../../server/polarrecorder/polar_model.py#L97-L103)). No
   `polar.json` schema change is required for asymmetry.
2. `Sample` already exposes `twa_deg_raw`, `twa_deg_abs` (folded 0-180), and
   `twa_deg_signed` (-180..+180) ([sample.py:47-62](../../server/polarrecorder/sample.py#L47-L62));
   `_normalize_twa` computes all three ([sample.py:114-118](../../server/polarrecorder/sample.py#L114-L118)).
   The model write path does not consume the folded fields, so no sample change is
   needed.
3. The only data-level fold is in projection: `export._folded_bins` maps every
   `twa > 180` bin to `360 - twa`
   ([export.py:383-390](../../server/polarrecorder/export.py#L383-L390)). This is the
   single fold to remove.
4. `export.TWA_FOLD_MAX = 180` ([export.py:33](../../server/polarrecorder/export.py#L33))
   caps TWA in three places: `save_preset` via `_parse_grid("twa", ..., 0, TWA_FOLD_MAX)`
   ([export.py:100](../../server/polarrecorder/export.py#L100)), the custom CSV path in
   `resolve_export_selection` ([export.py:167](../../server/polarrecorder/export.py#L167)),
   and the TWA axis ceiling passed to `_intervals` in `project_grid`
   ([export.py:201](../../server/polarrecorder/export.py#L201)).
5. `_intervals` builds linear half-open midpoint intervals; the final interval closes
   at the axis ceiling ([export.py:406-415](../../server/polarrecorder/export.py#L406-L415)),
   and `_inside` is a plain linear comparison
   ([export.py:418-422](../../server/polarrecorder/export.py#L418-L422)). There is no
   wraparound handling today.
6. The built-in preset is hardcoded: `WINDY_NAME = "windy"`,
   `WINDY_TWA = [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]`,
   `WINDY_TWS = [4, 6, 8, 10, 12, 14, 16, 20, 25]`
   ([export.py:32-36](../../server/polarrecorder/export.py#L32-L36)). `builtin_preset`
   returns a single Windy preset ([export.py:75-77](../../server/polarrecorder/export.py#L75-L77));
   `list_presets` prepends it to user presets
   ([export.py:80-85](../../server/polarrecorder/export.py#L80-L85)).
7. The default preset resolves to `windy`: `resolve_polar_preset` uses
   `args.get("format", WINDY_NAME)` and recognises only `windy` plus user presets
   ([export.py:131-144](../../server/polarrecorder/export.py#L131-L144)).
8. `windy` is the only reserved name: `_validate_name` rejects `"windy"`
   ([export.py:283-285](../../server/polarrecorder/export.py#L283-L285)), `delete_preset`
   rejects `"windy"` ([export.py:120-122](../../server/polarrecorder/export.py#L120-L122)),
   and `_decode_presets` skips `name.lower() == WINDY_NAME`
   ([export.py:342](../../server/polarrecorder/export.py#L342)).
9. `csv_from_projection` and `csv_export` are already grid-driven: they iterate the
   supplied `twa_grid`/`tws_grid` and emit whatever rows/columns it contains
   ([export.py:241-272](../../server/polarrecorder/export.py#L241-L272)). They need no
   change to emit above-180 deg rows once the grid is allowed to contain them.
10. `api_handlers.format_polar` hardcodes a 181-entry curve: `for twa in range(181)`
    ([api_handlers.py:129](../../server/polarrecorder/api_handlers.py#L129)). It also
    reuses `anchor_origin`, which anchors only `ORIGIN_TWA = 0`
    ([export.py:217-238](../../server/polarrecorder/export.py#L217-L238)).
11. `api_dispatch._polar` passes `preset.twa`/`preset.tws` straight into `format_polar`
    ([api_dispatch.py:46-48](../../server/polarrecorder/api_dispatch.py#L46-L48)); the
    CSV path runs through `resolve_export_selection`
    ([api_dispatch.py:68-85](../../server/polarrecorder/api_dispatch.py#L68-L85)). No
    grid is constructed in `plugin.py`.
12. The viewer caps TWA at 180 deg: `polar-chart.normalizeTwa` rejects any rounded
    value `< 0 || > 180` ([polar-chart.js:262-276](../../viewer/polar-chart.js#L262-L276)),
    and `addGrid` hardcodes spokes/labels `[0, 30, 60, 90, 120, 150, 180]`
    ([polar-chart.js:144-159](../../viewer/polar-chart.js#L144-L159)).
13. The viewer geometry is already full-circle correct: `anglePoint` uses
    `sin`/`cos` ([polar-chart.js:245-251](../../viewer/polar-chart.js#L245-L251)), so
    angles 181-359 deg map to the port (left) half with no geometry change. Center is
    `(280, 280)`, plot radius `220`, label offset `18`.
14. The viewer default preset is `windy`: `state.polarFormat: "windy"`
    ([viewer.js:22](../../viewer/viewer.js#L22)), `fallbackPresets` returns a single
    `windy` entry ([viewer.js:143-145](../../viewer/viewer.js#L143-L145)), and
    `presetLabel` maps any builtin to `"Windy Passage Planner"`
    ([viewer.js:147-149](../../viewer/viewer.js#L147-L149)).
15. There is no preset-default runtime config parameter; `config.py` and `params.py`
    define no preset/format key. The default lives only in `export.resolve_polar_preset`
    and the viewer `state.polarFormat`.
16. Tests that encode current fold/preset behaviour and must change:
    `tests/test_export.py::test_windy_preset_values_are_exact` (line 14),
    `::test_projection_folds_and_merges_bins` (line 23, asserts 30 deg and 330 deg
    bins merge), the `list_presets` ordering assertions (lines 77, 81, 101, 108), the
    reserved-name test (line 84), the `181` out-of-range `_parse_grid` case (line 117),
    and the `range(181)` grid in `tests/test_api_handlers.py` (lines 89, 107).
17. Negative facts (new, do not exist today): there is no `Default180`/`Default360`
    constant, no circular/wraparound TWA interval logic, no port-side viewer label
    code, no above-180 deg CSV emission path, and no documentation of the de-fold
    density consequence.

## Hard Constraints

1. `server/polarrecorder/` must not import AvNav modules or `plugin.py`, must not
   acquire locks, must not sleep, and must not perform I/O beyond the existing preset
   file handling. Projection and preset logic stay pure.
2. `plugin.py` remains the only AvNav boundary and the only lock owner. No grid
   construction, fold logic, or preset defaults move into `plugin.py`; it keeps
   passing `preset.twa`/`preset.tws` and `ExportSelection` through unchanged.
3. `polar.json` persistence schema does not change. No data migration is written.
   Existing learned bins are reused as-is.
4. The `--polarrecorder-` CSS prefix and the single `window.Polarrecorder` namespace
   are preserved. No `innerHTML`, `eval`, `var`, `console.log`, loose equality, or
   commented-out code is introduced. SVG attributes interpolate only numeric and
   whitelisted values.
5. Files keep the 400 non-empty-line hard limit and mandatory module headers.
   `export.py` is already near the limit; if a phase would breach it, split helpers
   into a new module rather than compressing lines.
6. The `windy` built-in is preserved exactly (irregular angles, label
   "Windy Passage Planner", reserved name) and remains selectable.
7. `LOW_CONFIDENCE` (viewer) and `min_samples` validation constants are NOT changed to
   compensate for de-folded density. The density consequence is accepted and
   documented, not tuned away.
8. A 180 deg preset must behave byte-identically to today for starboard-only data:
   port samples (181-359 deg) are excluded from a 180 deg grid, never folded back in.

## Implementation Order

Each phase must leave `tools/check-all.sh` green.

### Phase 1 - Remove the projection-time fold (foundational)

Intent: stop mirroring port bins into starboard during projection, and make the TWA
axis circular-aware so full-circle grids project correctly while 180 deg grids stay
starboard-only.

Dependencies: none.

Deliverables:

- In `export.py`, replace `_folded_bins`
  ([export.py:383-390](../../server/polarrecorder/export.py#L383-L390)) with a
  non-folding bin extractor that yields `(twa, tws, histogram)` for the raw 0-359 deg
  bin TWA, with no `360 - twa` mirroring. Rename it to reflect that it no longer folds
  (e.g. `_raw_bins`) and update `project_grid` accordingly.
- Introduce circular-aware TWA interval handling for `project_grid`. A grid is
  "circular" iff it contains any value `> 180`. For non-circular grids keep the exact
  current linear `_intervals`/`_inside` behaviour with `TWA_FOLD_MAX` (180 deg) as the
  axis ceiling, byte-for-byte as today, so port bins (181-359 deg) fall outside the top
  interval and are excluded while real starboard bins between the grid maximum and
  180 deg still merge into the top grid point exactly as before (Constraint 8).
  For circular grids, assign each raw bin to its nearest grid point on the circle
  using modular midpoint boundaries (uniform 15 deg spacing puts boundaries at
  `g +/- 7.5`; the wrap pair last->first+360 is handled like any adjacent pair, so the
  0 deg point owns the `352.5-359 / 0-7.5` arc and the 180 deg point is the single
  shared dead-downwind sector).
- Keep `TWS` interval logic unchanged.
- Preserve the `anchor_origin` interaction: the 0 deg head-to-wind anchor still applies
  once per populated band and is never duplicated for port; circular grids retain a
  single 0 deg origin.

Tests:

- Rewrite `tests/test_export.py::test_projection_folds_and_merges_bins` into a
  de-fold test: a 30 deg bin and a 330 deg bin must NOT merge in a 180 deg grid (the
  330 deg port bin is excluded); a `[30, 330]`-style circular grid must keep them
  separate.
- Add a circular-grid projection test covering nearest-bin assignment across the
  360 deg/0 deg wrap and the 180 deg shared sector.

Exit conditions:

- For any starboard-only dataset, a 180 deg grid projection is identical to the
  pre-change output.
- A circular grid projects port bins (181-359 deg) into their own cells with no
  mirroring.
- `tools/check-all.sh` green.

### Phase 2 - Add Default180 and Default360 built-in presets; change the default

Intent: introduce the two new hardcoded presets, make `Default180` the default, keep
`windy` selectable, and reserve the new names.

Dependencies: Phase 1 (so a 180 deg default truthfully shows starboard-only data).

Deliverables:

- In `export.py`, add constants:
  `DEFAULT180_NAME = "Default180"`, `DEFAULT360_NAME = "Default360"`,
  `DEFAULT_TWA_180 = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]`,
  `DEFAULT_TWA_360 = [0, 15, 30, ... , 345]` (every 15 deg, `range(0, 360, 15)` values;
  no `360` entry because 360 deg wraps to 0 deg). Both reuse `WINDY_TWS`.
- Define the built-in set once (an ordered mapping of name -> `Preset`) so
  `builtin_preset` (the default), `list_presets`, `resolve_polar_preset`, and the
  reserved-name guards share a single source of truth. `builtin_preset` returns the
  `Default180` preset (the new default).
- `list_presets` returns built-ins first in a stable order
  (`Default180`, `Default360`, `windy`), then sorted user presets.
- `resolve_polar_preset` default becomes `DEFAULT180_NAME` and resolves any built-in
  name (case-insensitive) before user presets.
- Reserve all three built-in names in `_validate_name`, `delete_preset`, and
  `_decode_presets` (replace the single `windy` check with a built-in-name set
  membership check).

Tests:

- Update `test_windy_preset_values_are_exact` to assert `windy` values unchanged AND
  add explicit value assertions for `Default180`/`Default360` (names, builtin flag,
  TWA lists, shared `WINDY_TWS`).
- Update `list_presets` ordering assertions to expect the three built-ins first.
- Extend the reserved-name test so `Default180`/`Default360` are rejected for save and
  delete (case-insensitive).
- Add a test that `resolve_polar_preset({})` returns `Default180`.

Exit conditions:

- `GET /api/presets` lists `Default180`, `Default360`, `windy`, then user presets.
- A polar request with no `format` resolves to `Default180`.
- `windy` is still resolvable and still rejected for save/delete.
- `tools/check-all.sh` green.

### Phase 3 - Widen the TWA range end to end (server)

Intent: allow grids and CSV to carry TWA above 180 deg, and let the polar API curve
span the full circle.

Dependencies: Phase 1 (projection must handle circular grids), Phase 2 (Default360
must be projectable and exportable).

Deliverables:

- Raise the TWA parse ceiling above 180 deg. Add `TWA_GRID_MAX = 359` and use it in
  `_parse_grid("twa", ...)` for both `save_preset`
  ([export.py:100](../../server/polarrecorder/export.py#L100)) and the custom CSV path
  in `resolve_export_selection` ([export.py:167](../../server/polarrecorder/export.py#L167)).
  Keep `TWA_FOLD_MAX` only where the 180 deg semantics are still meaningful, or remove
  it if Phase 1 no longer references it.
- `api_handlers.format_polar`: build the curve over the full circle so projected port
  cells are addressable. Replace `range(181)` with `range(360)` (or size from the grid
  maximum), keeping the `None`-for-empty-index contract and the
  `tws_bands`/`curves` response shape. Update the `format_polar` docstring, which still
  says "Cells are placed into a 181-entry array indexed by TWA 0-180"
  ([api_handlers.py:112-114](../../server/polarrecorder/api_handlers.py#L112-L114)), to
  describe the full-circle (0-359 deg) curve.

Tests:

- Update the `_parse_grid` range test in `tests/test_export.py` (the `181` case at
  line 117) so values up to 359 are accepted and 360+ is rejected.
- Add a CSV export test that emits rows above 180 deg for a circular grid.
- Update `tests/test_api_handlers.py` `format_polar` tests to use a circular grid and
  assert a curve entry exists at a port index (e.g. 210 deg).

Exit conditions:

- `GET /api/export?format=Default360` returns CSV with TWA rows above 180 deg.
- `GET /api/polar?format=Default360` returns curves with populated port indices.
- A 180 deg preset CSV/polar response is unchanged from Phase 2.
- `tools/check-all.sh` green.

### Phase 4 - Viewer: port labels, default preset, circular rendering

Intent: render the port half of a 360 deg preset with absolute TWA labels and make the
viewer default to `Default180`, while a 180 deg preset looks exactly as today.

Dependencies: Phase 2 (presets exist), Phase 3 (API serves full-circle curves).

Deliverables:

- `viewer/polar-chart.js`:
  - `normalizeTwa`: raise the upper bound from 180 to 359 (reject `< 0 || > 359`).
  - `addGrid`: when the active preset is circular (the resolved `presetTwa` contains a
    value `> 180`), additionally draw port-half spokes and labels at
    `210, 240, 270, 300, 330` deg using absolute degree text (e.g. `"210°"`), mirroring
    the existing 30 deg starboard cadence. A non-circular preset draws exactly the
    current `[0, 30, 60, 90, 120, 150, 180]` spokes and nothing on the left. Pass the
    circular flag (or `presetTwa`) into `addGrid` from `buildSvg`; geometry uses the
    existing `anglePoint` with no change (Baseline 13). Labels interpolate only the
    numeric angle. The `emptySvg` no-data path also calls `addGrid`
    ([polar-chart.js:102](../../viewer/polar-chart.js#L102)); it passes the non-circular
    default so the empty-state grid keeps drawing the current starboard-only spokes.
  - Confirm `radiusMax`, `hasRenderableData`, `addCurve`, and connector logic already
    operate over `presetTwa`, so port indices render once `normalizeTwa` admits them.
  - `addConnectors`: for a circular preset, close the curve by connecting the last
    rendered grid point back to the first (the 0 deg/360 deg head-to-wind origin), so the
    full-circle curve forms a closed teardrop instead of leaving a one-sector notch at
    head to wind. Only the wrap segment is added; the existing adjacent-`gridIndex` run
    logic is otherwise unchanged, and a non-circular preset draws no wrap segment so
    180 deg presets stay visually identical.
- `viewer/viewer.js`:
  - `state.polarFormat` default becomes `"Default180"`
    ([viewer.js:22](../../viewer/viewer.js#L22)).
  - `fallbackPresets` returns the three built-ins (`Default180`, `Default360`, `windy`)
    matching the server, with `Default180` first
    ([viewer.js:143-145](../../viewer/viewer.js#L143-L145)).
  - `presetLabel` returns a correct display name per built-in instead of always
    "Windy Passage Planner" ([viewer.js:147-149](../../viewer/viewer.js#L147-L149)):
    `Default180` -> "Default (180°)", `Default360` -> "Default (360°)",
    `windy` -> "Windy Passage Planner".

Tests:

- Extend the Node viewer checks only as far as existing harness allows (namespace,
  pattern, filesize). Behavioural verification of port labels is manual via the viewer
  (record in the verification notes); do not add a browser test harness that does not
  exist today.

Exit conditions:

- Selecting `Default360` in the viewer draws labelled port-half sectors with absolute
  degrees, plots port data points, and closes the curve from the last port grid point
  back to the 0 deg/360 deg origin; selecting `Default180` or `windy` looks identical to
  today.
- The viewer opens on `Default180` by default.
- `tools/check-all.sh` green (including `check:namespace`, `check:patterns`,
  filesize/line-limit checks).

### Phase 5 - Documentation and README

Intent: synchronise public docs with the new behaviour, including the de-fold density
consequence.

Dependencies: Phases 1-4.

Deliverables:

- `README.md`:
  - `## What are presets?` (line 159): document `Default180` (new default),
    `Default360`, and the retained `windy` preset.
  - `### Polar` (line 87) and `### Export` (line 134): explain that 360 deg presets show
    and export true port/starboard asymmetry, with absolute port-half labels.
  - `## Known limitations` (line 265): document that, because port and starboard are no
    longer folded together, a 180 deg view counts only starboard samples, so per-bin
    sample counts are lower than before the change and confidence builds more slowly
    (Constraint 7).
- `documentation/architecture/polar-model.md`: correct the statement that TWA is
  "stored internally as the raw 0-360 value, a folded 0-180 absolute value..." to make
  clear the model is the source of true 0-359 deg data and that no fold occurs at or
  after projection.
- `documentation/user/export-import.md`: presets list, the two new built-ins, and CSV
  emission above 180 deg (note Default360 CSV is not Windy.com-importable by design).
- `documentation/architecture/api.md`: `format_polar` curve now spans the full circle;
  `/api/polar` and `/api/export` accept the new presets and above-180 deg grids.
- `documentation/architecture/ui.md`: viewer default preset, circular grid rendering,
  and absolute port-half labels.
- `documentation/user/configuration.md` / `troubleshooting.md`: only if a referenced
  default or symptom text mentions `windy` as the default; update to `Default180`.
- `ROADMAP.md`: mark item 1 as in progress / done per the repo's roadmap convention.
- `documentation/TABLEOFCONTENTS.md`: no new files are added, so update only if any
  routing line text becomes inaccurate.

Exit conditions:

- `npm run check:docs` passes (documentation reachability and AI-instruction sync).
- `tools/check-all.sh` green.

## Documentation Impact

| Doc | Change | Trigger |
|---|---|---|
| `README.md` | Presets, polar/export asymmetry, known-limitation density note | User-facing behaviour + presets change |
| `documentation/architecture/polar-model.md` | Clarify no fold; model is 0-359 truth | Behaviour change |
| `documentation/architecture/api.md` | Full-circle curve; new presets; >180 deg grids | API shape change |
| `documentation/architecture/ui.md` | Default preset, port labels, circular rendering | Viewer behaviour change |
| `documentation/user/export-import.md` | New built-in presets; >180 deg CSV; Windy-import caveat | Export/preset change |
| `documentation/user/configuration.md`, `troubleshooting.md` | Default preset rename if referenced | Default change |
| `ROADMAP.md` | Item 1 status | Roadmap progress |
| `documentation/TABLEOFCONTENTS.md` | Only if routing text becomes stale | Doc index sync |

No new documentation files are introduced.

## Acceptance Criteria

Behaviour:

- [ ] Projection no longer folds: port bins are never mirrored into starboard.
- [ ] A 180 deg preset returns starboard-only results identical to the pre-change
      output for starboard data.
- [ ] `Default180` is the default polar/export grid (server and viewer).
- [ ] `Default360` projects, exports, and renders full-circle port/starboard data.
- [ ] `windy` remains selectable, unchanged, and reserved.
- [ ] CSV export emits TWA rows above 180 deg for circular grids.
- [ ] The viewer draws absolute-degree port-half labels for 360 deg presets, closes the
      full-circle curve at the 0 deg/360 deg origin, and is visually unchanged for 180 deg
      presets.

Tests:

- [ ] `test_projection_folds_and_merges_bins` is replaced by de-fold + circular-grid
      tests.
- [ ] Preset value, ordering, default-resolution, and reserved-name tests cover all
      three built-ins.
- [ ] `_parse_grid` accepts TWA up to 359 and rejects 360+.
- [ ] A CSV test asserts above-180 deg emission; a `format_polar` test asserts a
      populated port index.

Docs:

- [ ] `README.md` documents the presets and the density limitation.
- [ ] Mapped architecture/user docs updated per the table above.
- [ ] `npm run check:docs` passes.

Release impact:

- [ ] `tools/check-all.sh` green after every phase and at handoff.
- [ ] No `polar.json` migration; existing installs keep their learned data and simply
      see `Default180` as the new default view.

## Related

- [ROADMAP.md](../../ROADMAP.md) - item 1 source
- [exec-plan-authoring.md](../../documentation/guides/exec-plan-authoring.md) - plan contract
- [polar-model.md](../../documentation/architecture/polar-model.md) - model is 0-359 native
- [data-pipeline.md](../../documentation/architecture/data-pipeline.md) - sample/TWA flow
- [api.md](../../documentation/architecture/api.md) - polar/export/presets endpoints
- [ui.md](../../documentation/architecture/ui.md) - viewer rendering
- [export-import.md](../../documentation/user/export-import.md) - presets and CSV
- [coding-standards.md](../../documentation/conventions/coding-standards.md),
  [smell-prevention.md](../../documentation/conventions/smell-prevention.md) - binding rules
