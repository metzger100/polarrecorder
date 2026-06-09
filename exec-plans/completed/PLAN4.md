# PLAN4 - Optional signal hooks (enhanced rejection rules)

## Status

- PLAN4 was written after inspecting the Polar Recorder source tree and the AvNav
  core source tree (`/home/leobareth/Dokumente/Programmieren/avnav/server` and
  `.../avnav/viewer`). Every Verified Baseline fact is checked against current
  files, not memory.
- PLAN4 is the authoritative implementation source for **ROADMAP item 1
  ("Optional signal hooks (enhanced rejection rules)")** until it is moved to
  `exec-plans/completed/`. Prescriptive parts: the Verified Baseline, Hard
  Constraints, phase deliverables, exit conditions, and Acceptance Criteria.
  Flexible parts: helper names, internal function decomposition, threshold
  defaults within the stated ranges, and test-case naming, provided the exit
  conditions and constraints hold.
- This plan covers ROADMAP item 1 only. ROADMAP items 2 (AvNav dashboard widgets)
  and 3 (dyninstruments palette) are explicitly out of scope and must not be
  touched.
- The file name is `PLAN4.md` because `exec-plans/completed/` already contains
  `PLAN1.md`, `PLAN2.md`, and `PLAN3.md`. The ROADMAP has been renumbered across
  releases, so the completed plans each say "item 1" about a *different* feature
  (PLAN2 = 360 deg polar; PLAN3 = JSON restore/import). PLAN4 targets the
  *current* ROADMAP item 1.
- Repo rules and core principles always outrank this plan. The 400 non-empty-line
  hard limit, `tools/check-all.sh`, coverage floors, and blocking smells bind
  every phase. Where a phase would breach a repo rule (most likely the 400-line
  limit on `params.py`, `plugin.py`, `api_dispatch.py`, or `settings-ui.js`),
  split the file inside that same phase rather than deferring.
- **Verification sign-off (2026-06-08).** Final pre-implementation review complete;
  baseline re-checked against current source. Resolved this pass: (1) prefilled keys
  are auto-active on upgrade by design — Acceptance Criterion #1 reworded and the
  behavior made explicit; (2) R21 reframed from a symmetric `abs(SOG-STW)` band to the
  asymmetric STW-implausibly-low (paddlewheel-failure) case, and gated on a present
  `current_drift_kt < (sog_kt - stw_kt)` so that strong *following* current
  (which produces the same STW-below-SOG signature) cannot false-reject: R21 fires only
  when the present current is demonstrably too small to account for the observed
  SOG-STW gap, and does not fire at all without a current-drift reading
  (+`enh_slip_sog_floor_kt`/`enh_slip_ratio`); (3) engine state coerced once at
  the reader (`_coerce_float`) and interpreted by a single `enh_engine_state_on_threshold`
  so boolean / RPM / alternator-voltage sources all work, killing the truthy-string
  bug; (4) live-status made key-set aware with an `all`/`any` combinator (R21 needs
  AWA+AWS, turn-confirm needs heading-or-COG); (5) R17-R19 are pre-candidate
  (`is_sailing_candidate=False`), grouped with `reject_head_to_wind` per the user:
  motoring and shallow-water squat are non-representative conditions
  (`record_non_candidate`); R20-R22 are candidate-gate (`is_sailing_candidate=True`,
  `record_rejected`). The original current-strength reject was **removed** in the fourth
  pass (see that note and Out of Scope): a uniform current does **not** distort a
  correctly water-referenced (STW, TWS_water) polar point — TWS and STW shift together in
  the same frame — so a current-magnitude reject would discard good data for no physics
  reason. Verified
  facts: `gps.currentDrift` exists (m/s), `gps.trueWindAngle` is `angleTrueWater`,
  AWA is 0-360 bow convention, and `saveConfigValues` does **not** invoke the change
  callback (`pluginhandler.py:961` vs `:1051`) so the Phase 5 save path has no
  lock re-entrancy/deadlock; AvNav store `DataEntry.timestamp` is `time.monotonic()`
  ([avnav_store.py:50]) and plugins run in-process, so the reader's
  `timestamp_monotonic - entry.timestamp` freshness age (reused for the enhanced
  stale-drop and the Phase 5 live-status probe) is valid. This plan adds **27 new
  enhanced parameters**, bringing the registered total from 23 to **50**; the "23
  parameter" contract in `documentation/avnav/editable-parameters.md` and
  `documentation/TABLEOFCONTENTS.md` must be updated in lockstep (Phase 1).
- **Second verification pass (2026-06-08).** Independent gap review against current
  source. Two wording fixes applied (the `_coerce_float` "logged once" claim — the reader
  is reconstructed each cycle and holds no dedup state — and the R21 `<= max`
  non-redundancy reasoning, **later superseded in the third pass** by a self-contained
  gap test). Two design decisions: (a) R20 recategorized from pre-candidate to candidate
  quality-gate with a sea-state rationale, because uniform current does not distort a
  water-referenced polar point (R20 is ordered before R21 in `_run_candidate_rules`;
  after the third pass this ordering is readability-only, no longer load-bearing);
  (b) R19 depth default changed to `gps.depthBelowKeel` with the floor lowered `2.0 -> 1.0`
  m (keel clearance is the meaningful reference and avoids rejecting normal sailing on
  upgrade). All ripples applied across the sign-off, candidacy table, candidacy prose,
  R21 rationale, Phase 3 pipeline ordering, the poisoning-resistance deliverable, the
  parameter table, and Verified Baseline fact 15. No open issues remain.
- **Third verification pass (2026-06-08).** Final gap review. One correctness fix and one
  completeness fix. (1) R21's weak-current corroboration was decoupled from the gap it
  explains — a fixed `current_drift_kt <= enh_current_drift_max_kt` gate still
  false-rejected honest light-air-with-current data (e.g. SOG 2.0 / STW 0.8 / drift 1.3,
  where a 1.3 kt following current fully accounts for the 1.2 kt gap, and the minimum
  possible gap at the SOG floor, `floor*(1-ratio)`, is smaller than the allowed drift, so
  the fixed gate could never guarantee the current was too weak). R21 now gates on
  `current_drift_kt < (sog_kt - stw_kt)`: it fires only when the present current is
  demonstrably too small to produce the observed SOG-STW gap. This is exact and
  SOG-floor-independent, removes the false-reject, and makes R21 self-contained — the
  earlier "R20 must precede R21 / `<= max` load-bearing-when-R20-disabled" reasoning is
  obsolete (ordering no longer affects R21 correctness; R20 stays before R21 only for
  readability). R21 still requires both `enh_sog_key` and `enh_current_drift_key` present
  (`all` combinator unchanged); `enh_current_drift_max_kt` is no longer referenced by R21
  (it was then the strong-current reject's threshold only — and that reject, with this
  parameter, was removed in the fourth pass below). Ripples applied across the goal, the
  parameter table,
  the R21 rule definition, the Phase 3 pipeline-ordering note, the Phase 3 and Phase 5
  tests, the live-status rationale, and poisoning-resistance. (2) Added the missing Phase 2
  call-site deliverable: `build_sample`/`StoreReader` signature updates at `pipeline.py:56`,
  `plugin.py:137`, and `plugin.py:167` (`_record_suppressed`). No open issues remain.
- **Fourth verification pass (2026-06-08).** Scope decision: the original
  current-strength reject (`reject_strong_current`) is **removed**. Verified against AvNav
  core source that `gps.trueWindAngle`/`trueWindSpeed` are parsed from instrument MWV
  (ref=T)/MWD sentences ([avnav_nmea.py:498-530]) and `gps.currentDrift`/`currentSet` from
  VDR ([avnav_nmea.py:644-656]) — AvNav does **not** derive them from apparent wind + STW
  (no `computeTrueWind` in `server/`). Consequences: (1) a current-magnitude reject brings
  no benefit — a uniform current does not distort a water-referenced `(STW, TWS_water)`
  point, and as a "wind-against-tide sea-state" proxy it is blunt and wrong (it cannot
  distinguish wind-with-tide flat water from wind-against-tide chop), so it discards good
  data; it is dropped (recorded in Out of Scope). (2) The true-wind cross-check (now R21)
  is therefore **not** a near-tautology in the AvNav-core NMEA model — true wind is
  instrument-computed independently of `gps.windAngle`/`windSpeed`+STW — so its limitation
  note is narrowed to SignalK/plugin-derived-true-wind setups only. (3) The SOG/STW
  paddlewheel check (now R20) keeps `gps.currentDrift` (from VDR) as its sole consumer,
  which removes the former shared-role complexity. Renumbering: surviving candidate-gate
  rejects shift down one to stay contiguous — `reject_sog_stw_mismatch` R21->**R20**,
  `reject_true_wind_crosscheck` R22->**R21**, `reject_heel_out_of_band` R23->**R22**; the
  enhanced set is now **R17-R22** (six rejects). Two parameters dropped
  (`enh_current_enabled`, `enh_current_drift_max_kt`): **27 new parameters, total 23 ->
  50**. Ripples applied throughout (goal, repository outcomes, signal model, parameter
  table, reason-code/candidacy tables, live-status, Phases 2/3/5, Documentation Impact,
  Acceptance Criteria, Out of Scope). No open issues remain.
- **Fifth verification pass (2026-06-08).** Final pre-implementation review. One
  correctness fix: the R16 engine-heuristic interaction had been specified as
  "suppress R16 whenever a definitive engine signal is *present*," but Goal #3 framed
  it as a two-state (off->suppress, on->reject) contract that silently omitted a third
  state — an RPM signal *present but idling below* `enh_rpm_idle_max` (where R17 does
  not reject and, with no separate engine-state source, R18 is inactive). Blanket
  presence-suppression there would accept a low-wind/moving idle-in-gear sample that
  R16's heuristic exists to quarantine. R16 now suppresses **only on a definitive
  "off" reading** (`engine_signal < enh_engine_state_on_threshold`, or `rpm <=
  RPM_OFF_CEILING`, a named stopped-engine constant); in the idle band the heuristic
  still applies, and engine-*on* remains a pre-candidate R17/R18 reject that never
  reaches R16. No new editable parameter (off-detection reuses
  `enh_engine_state_on_threshold` and a named module constant), so the count stays
  **27 new / 50 total**. Ripples applied across Goal #3, the Phase 3 `engine_heuristic`
  deliverable, the Phase 3 `test_validation_heuristic.py` deliverable, and the engine
  Acceptance Criterion. All other ground-checked facts (Phase 4 `WindowEntry`/
  `previous_sample` mechanics, the R21 true-wind trig and `sqrt` non-negativity, the
  `DataEntryLike.value` mypy-reachability note, the URL-keyed `ROUTES` save path with no
  GET/POST distinction, `config.stale_threshold = 3.0`, `params.py` at 166 non-empty
  lines, and the 23->50 / R17-R22 numbering) verified consistent. No open issues remain.
- **Sixth verification pass (2026-06-08).** Final pre-implementation sign-off. Two findings,
  both resolved. (1) Coverage-note sync: the live stub `rules_enhanced.py` is comment-only
  and reaches coverage solely through a smoke-import assertion
  (`test_validation_heuristic.py:4`/`:21`), which `pyproject.toml`'s `[tool.coverage.report]`
  note documents; once Phase 3 lands real rules both go stale, so Phase 3 now carries explicit
  deliverables to refresh the `pyproject.toml` note (real rules under the validation-package
  95%/95% floor) and remove the vestigial smoke-import assertion. (2) R21 `sqrt` domain: the
  law-of-cosines argument is provably non-negative in exact arithmetic but the subtractive
  form can round to a tiny negative in IEEE-754 doubles when apparent wind ~ boat speed and
  the wind is near dead-ahead, raising `ValueError` and dropping that one sample cycle (caught
  at the plugin boundary, no crash). Reviewed and **consciously accepted unguarded** — the
  plan keeps the "sqrt is safe" position; the edge is rare and fails safe. All other
  ground-checked facts re-verified against current source this pass: doc files targeted for
  edits are all well under the 400-line limit (largest `api.md` at 109); the only stray "23"
  parameter references are the three Phase 1 already fixes
  (`TABLEOFCONTENTS.md:24`, `editable-parameters.md:7` and `:41`); `enhanced/save` as a
  mutating GET over `args` matches the existing `presets/save` route shape; the enhanced
  freshness "now" is already available inside `build_sample` via
  `read_result.timestamp_monotonic`; and `ValidationState.previous_sample` is a `WindowEntry`
  (not a `Sample`), confirming Phase 4's `WindowEntry` extension is the correct place to carry
  `heading_deg`/`cog_deg`. Plan is implementation-ready.

---

## Goal

### User-visible outcomes after completion

1. Polar Recorder reads **optional boat signals** in addition to the three core
   signals (TWA/TWS/STW) and uses them to reject samples that those signals prove
   are unrepresentative. Each optional rule fires only when its signal is present;
   when the signal is absent the sample is left untouched (fail-open per signal,
   fail-closed per decision).
2. Eight optional signals from the ROADMAP are addressed:
   - **Engine RPM** -> `reject_engine_rpm` (RPM above a configured idle ceiling).
   - **Engine on/off state** -> `reject_engine_on` (engine signal at/above a
     configured threshold; the source may be a boolean, an RPM, or an alternator
     voltage, so one numeric threshold interprets all of them).
   - **Depth** -> `reject_shallow` (depth below a configured floor).
   - **SOG/STW mismatch** -> `reject_sog_stw_mismatch` (paddlewheel reads
     implausibly low: STW far below SOG while the boat is clearly moving, and the
     present current drift is too small to account for the SOG-STW gap
     (`current_drift_kt < sog_kt - stw_kt`) — not a symmetric `abs(SOG-STW)` band, so
     neither head nor following current triggers it).
   - **AWA/AWS true-wind cross-check** -> `reject_true_wind_crosscheck`
     (reported true wind disagrees with apparent-wind recomputation).
   - **Heel / roll** -> `reject_heel_out_of_band` (heel outside a configured
     `[min, max]` band; `min` defaults to `0` so multihulls are unaffected by
     default).
   - **Current set/drift** -> used only as **corroboration** for the SOG/STW
     paddlewheel check (R20); a standalone current-strength reject was evaluated and
     **removed** (a uniform current does not distort a water-referenced polar point — see
     Out of Scope), so current drift never rejects on its own.
   - **Heading / COG turn confirmation** -> hardens the existing maneuver reject
     (R11/R14): a TWA spike with steady heading/COG is treated as a wind shift,
     not a turn, and no longer triggers a false maneuver reject or cooldown.
3. When a definitive engine signal (RPM or engine-state) is configured and
   present, the heuristic engine quarantine (R16) defers to the signal in the
   two cases the signal actually settles, and **only** those:
   - **Engine on** (above its reject threshold: `rpm > enh_rpm_idle_max`, or
     `engine_signal >= enh_engine_state_on_threshold`) -> a direct reject (R17/R18,
     pre-candidate); the sample never reaches R16.
   - **Engine off** (`engine_signal < enh_engine_state_on_threshold`, or RPM at/below
     a named stopped-engine floor `RPM_OFF_CEILING`, i.e. rpm ~ 0) -> the R16
     quarantine is suppressed: the engine is known stopped, so there is no motoring
     to guess at.
   - **Engine running but below the reject threshold** (the RPM idle band,
     `0 < rpm <= enh_rpm_idle_max`, with no separate engine-state source to reject it)
     -> the signal has **not** settled the motoring question, so R16's existing
     low-wind/moving heuristic **still applies**. A boat ghosting along in light air
     at idle in gear is exactly what R16 exists to quarantine, so a present-but-idling
     RPM must not blanket-suppress it.
   This turns R16's guess into a fact only where the signal is definitive (on or off);
   the ambiguous idle band keeps the heuristic. No new editable parameter is added:
   the engine-state "off" test reuses `enh_engine_state_on_threshold`, and the RPM
   stopped-engine floor is a named module constant, not a magic literal.
4. The viewer **Settings tab gains a third "Enhanced Rules" section**. Each rule
   has an on/off switch (default **On**), a store-key picker where a key is
   required, threshold inputs, and a **live status badge**: `active`,
   `inactive_value_missing`, `inactive_key_missing`, `inactive_key_not_configured`,
   or `disabled`.
5. The store-key pickers offer the **currently-available AvNav store keys** as a
   dropdown, plus free-text entry for custom keys (RPM, engine state, heel) that
   are not standard AvNav keys.
6. Enhanced-rule settings are saved from the Settings tab and persist across
   restarts as AvNav editable-parameter state; they hot-apply on the next sample
   cycle exactly like the existing settings.

### Repository-visible outcomes after completion

1. `server/polarrecorder/validation/rules_enhanced.py` contains six pure,
   AvNav-free, I/O-free, lock-free rules that read only `Sample.enhanced` and the
   `Config`, and return the shared `RuleResult`. The stub comment block is
   replaced by real rules.
2. The reader populates `Sample.enhanced` from configured optional keys, with each
   unit converted exactly once at the read boundary.
3. The validation pipeline runs the enhanced rules in a deterministic order with
   correct `is_sailing_candidate` semantics; the rejection-rules table documents
   R17 through R22 and the R11/R14/R16 enhancements.
4. New plugin API endpoints expose available store keys, enhanced-rule live
   status, and an enhanced-settings save path (`api.saveConfigValues`).
5. `tools/check-all.sh` is green: ruff, `mypy --strict`, `check-python-compat.py`,
   `check-py-contracts.py`, `check-py-dependencies.py`, `check-performance.py`,
   `check-runtime-contracts.py`, pytest with coverage floors, and all Node viewer
   checks (`check-patterns.mjs`, `check-namespace.mjs`, `check-naming.mjs`,
   `check-headers.mjs`, `check-smell-contracts.mjs`, `check-js-duplication.mjs`,
   `check-file-size.mjs`, `check-viewer-contracts.mjs`, `check-js-coverage.mjs`,
   and `npm run check:docs`).
6. Tests and fixtures are synced in the same phases that change behavior
   (validation, API, persistence-metadata, viewer).
7. `README.md` and the mapped documentation describe the new optional signals,
   their configuration, and the Settings-tab third section.

---

## Verified Baseline

Every fact was verified against repository files on the working branch.

### Existing pipeline and rules

1. `server/polarrecorder/validation/pipeline.py:34` `run()` returns
   `tuple[PipelineResult, Sample | None]`. Phase A runs R1/R2 on the raw
   `ReadResult` (`_run_phase_a`, line 83); on pass it calls `build_sample` and
   `_run_sample_rules` (line 66).
2. `_run_pre_candidate_rules` (`pipeline.py:92`) runs `rules_core.stale_values`,
   `age_skew`, `twa_range`, `tws_range`, `stw_range`, `head_to_wind`, `low_wind`,
   `anchored_heuristic` in that order; any reject returns
   `is_sailing_candidate=False`.
3. `_run_candidate_rules` (`pipeline.py:108`) runs `rules_stability.twa_rate_of_change`,
   `tws_rate_of_change`, `stw_acceleration`, `maneuver_cooldown`,
   `stability_window`, then `rules_heuristic.engine_heuristic`; a reject/quarantine
   here yields `is_sailing_candidate=True` (quality gate), except
   `reject_warming_up` (`_candidate_rejection`, line 122).
4. `server/polarrecorder/validation/rules_enhanced.py` is a 15-non-empty-line
   stub with `Depends: none` and no executable code; it is the intended home for
   optional-signal rules.
5. `server/polarrecorder/sample.py:47` `Sample` already has
   `enhanced: dict[str, float] | None = None`; `build_sample` (line 72) currently
   hardcodes `enhanced=None` (line 105). `RuleResult` (line 64) has
   `decision: RuleDecision` and `reason_codes: list[str]`.
6. `ReadResult` (`sample.py:22`) carries `twa_raw/tws_raw/stw_raw` and matching
   `*_timestamp` fields, all `float | None`. It has no enhanced fields today.
7. `server/polarrecorder/validation/rules_heuristic.py:18` `engine_heuristic`
   quarantines `quarantine_engine_suspected` when
   `tws_kt < config.engine_tws_ceil and stw_kt > config.engine_stw_floor`. It does
   not consult `Sample.enhanced`.
8. `server/polarrecorder/validation/rules_stability.py:21` `twa_rate_of_change`
   sets `state.cooldown_expires = now + config.cooldown_seconds` and returns
   `reject_twa_roc` when the circular TWA rate exceeds `config.twa_roc_threshold`.
   `maneuver_cooldown` (line 64) rejects while `now < state.cooldown_expires`.
   These use `polarrecorder.validation.angle_math.circular_distance`/`circular_range`.
9. `server/polarrecorder/validation/state.py:20` `WindowEntry` is a frozen
   dataclass with `timestamp_monotonic`, `twa_deg_raw`, `tws_kt`, `stw_kt` only.
   `entry_from_sample` (line 92) builds it from a `Sample`. `ValidationState`
   keeps `window`, `cooldown_expires`, and `previous_sample`.
10. `documentation/filters/rejection-rules.md` documents R1-R16 in a table; R16 is
    the only quarantine. Two pre-pipeline codes (`reject_user_paused`,
    `reject_disabled`) are emitted by plugin integration only.

### Config, params, and reader

11. `server/polarrecorder/params.py` defines `EDITABLE_PARAMETERS` (166 non-empty
    lines, 23 parameters). Each dict has `name`, `type`, `default`, optional
    `rangeOrList`, `description`.
12. `server/polarrecorder/config.py` (`Config`, line 20) is a frozen dataclass
    mirroring those 23 fields; `parse_config_values` (line 49) parses AvNav string
    values, clamps `NUMBER`/`FLOAT` to `rangeOrList`, and falls back to previous or
    default on invalid values. Booleans use `value.strip().upper() == "TRUE"`.
13. `server/polarrecorder/reader.py:17` reads exactly three keys
    (`gps.trueWindAngle`, `gps.trueWindSpeed`, `gps.waterSpeed`) via the
    `StoreAPI` protocol method `getSingleValue(key, includeInfo=True)` and returns
    a `ReadResult`. `_entry_value`/`_entry_timestamp` extract `value`/`timestamp`.
14. `server/polarrecorder/units.py` provides `meters_per_second_to_knots` and
    `knots_to_meters_per_second` (factor `1.94384`). Speeds are stored m/s and
    converted to knots at sample build; angles stay degrees
    (`documentation/avnav/keys-and-units.md`).
15. `documentation/avnav/keys-and-units.md` confirms store units: TWA degrees,
    TWS/STW m/s; lists `gps.speed` (SOG, m/s), `gps.track`/`gps.headingTrue`
    (degrees), `gps.windAngle`/`gps.windSpeed` (apparent, degrees/m_s),
    `gps.depthBelowTransducer` (meters) as not-yet-used optional keys. AvNav core also
    defines `gps.depthBelowKeel` (`environment.depth.belowKeel`, m, [avnav_nmea.py:142])
    and `gps.depthBelowWaterline`; R19 defaults to `gps.depthBelowKeel` as the meaningful
    clearance, so Phase 2 adds it (and the other enhanced keys) to the keys-and-units doc.

### Plugin integration, API, counters

16. `plugin.py:87` registers `EDITABLE_PARAMETERS` with `_on_config_change`
    (line 305), which re-parses changed values under the lock and updates
    `self.config` and `self._state.stability_window_seconds`.
17. `plugin.py:137` constructs a `reader.StoreReader(self.api, ...)` each iteration
    and calls `pipeline.run(read_result, self._state, config)` (line 144); commits,
    counters, timeline, and status updates happen under `self._lock` (lines
    155-164). `plugin.py` is **336 non-empty lines** (limit 400).
18. `server/polarrecorder/api_dispatch.py` routes URLs via the `ROUTES` dict
    (line 361). `_status` snapshots under the lock and formats via
    `api_handlers.format_status`. Handlers acquire `plugin._lock`, snapshot, then
    format outside the lock. The file is 380 physical lines.
19. `server/polarrecorder/api_handlers.py:175` `format_config(config)` returns the
    parsed config as native JSON via `ok(...)`; `StatusSnapshot` (used by
    `format_status`, line 66) is the status payload shape.
20. `server/polarrecorder/counters.py` exposes `record_accepted`,
    `record_rejected(reason_codes)`, `record_quarantined(reason_code)`,
    `record_non_candidate(reason_codes)`. `plugin.py:178` `_record_counters` maps
    pipeline decisions onto these by decision and `is_sailing_candidate`.
21. `viewer/settings-ui.js` is **219 non-empty lines** (limit 400) and renders two
    cards (`learnedDataCard`, `presetsCard`) into `#settings-panel`. It uses
    `Polarrecorder.Dom`, `Polarrecorder.ImportUpload`, and `Polarrecorder.FetchJson`.
    `viewer/viewer.html` loads viewer scripts in a fixed, gate-checked order.

### AvNav core contracts (verified in `/home/leobareth/Dokumente/Programmieren/avnav`)

22. `server/avnav_api.py:348` `registerEditableParameters(paramList, changeCallback)`
    documents parameter `type` as one of `STRING, NUMBER, FLOAT, SELECT, BOOLEAN`
    (line 360). `server/avnav_worker.py:52` `ALL_TYPES` confirms the server-side
    enum is `STRING, NUMBER, BOOLEAN, FLOAT, SELECT, FILTER` only. **There is no
    server-side `KEY` parameter type**, so AvNav's plugin-config dialog cannot
    render a store-key picker for a Python-registered parameter.
23. `server/avnav_api.py:336` `saveConfigValues(configDict)` exists: a plugin may
    persist config values programmatically ("values should be strings ... will be
    converted to strings"); the doc says the plugin "should already start using
    those values before writing them here". This is the mechanism for saving
    enhanced settings from the viewer while keeping config as AvNav editable-
    parameter state.
24. `server/avnav_api.py:191` `getDataByPrefix(prefix)` returns "a dict with the
    values found (potentially hierarchical)" for keys under `prefix` (no trailing
    dot). This is the only practical way for the plugin to enumerate
    currently-present store keys; there is **no HTTP endpoint that lists all
    registered keys** (the unused `AVNStore.getRegisteredKeys()` is not exposed).
25. `server/avnav_api.py:201` `getSingleValue(key, includeInfo=False)` returns the
    value, or an object with `value`/`timestamp`/`source`/`priority` when
    `includeInfo=True`. Valid keys are any registered store key; unknown keys
    return `None`.
26. AvNav core exposes **no built-in roll / pitch / heel / attitude store key**
    (grep of `avnav/server` and `avnav/viewer` for `roll`/`pitch`/`heel`/
    `attitude`/`yaw` found none). Heel is therefore necessarily a custom optional
    signal the user maps to whatever their attitude source publishes
    (e.g. a SignalK `navigation.attitude.roll` bridge, an NMEA2000 attitude PGN
    plugin key, or a custom plugin key), expressed in degrees of transverse roll.

### Tests and fixtures present today

27. Validation tests: `tests/test_validation_core.py`, `test_validation_stability.py`,
    `test_validation_heuristic.py`, `test_validation_pipeline.py`,
    `test_poisoning_scenarios.py`; reader/sample tests `test_reader.py`,
    `test_sample.py`; config `test_config.py`; API `test_api_handlers.py`;
    integration `test_plugin_integration.py`.
28. Fixtures: `tests/mock-data/{config.json,status.json,timeline.json,
    rejections.json,polar.json,presets.json,export-windy.csv,export-json.json}`.
    Viewer checks include `tools/test-viewer-*.mjs` and `tools/check-js-coverage.mjs`
    per-file floors.
29. Negative facts (do not exist today): no enhanced parameters in `params.py`/
    `Config`; no enhanced fields on `ReadResult`; no enhanced reads in `reader.py`;
    no executable rules in `rules_enhanced.py`; no `enhanced/*` API routes;
    no heading/COG fields in `WindowEntry`; no Enhanced Rules section in the viewer.

---

## Hard Constraints

1. **No AvNav imports in `server/polarrecorder/`.** The reader keeps reading through
   the `StoreAPI` protocol; `getDataByPrefix`/`saveConfigValues` are called only in
   `plugin.py` (the AvNav boundary). Enhanced rules import nothing from AvNav or
   `plugin.py`.
2. **Pure rules.** Every enhanced rule accepts only the arguments it uses, reads its
   inputs only from `Sample.enhanced` (and `Config` for thresholds), returns
   `RuleResult`, and contains no I/O, locks, sleeps, or real-time dependencies.
3. **Convert units once.** All optional-signal unit conversions happen exactly once,
   at the reader/sample boundary, using `units.py`. Rules consume already-converted,
   canonical-unit values (knots, degrees, meters).
4. **Absent-value discipline.** An absent or stale optional signal is represented by
   its key being **omitted** from `Sample.enhanced` (or `enhanced is None`); never
   `NaN`/`-1`/`0` sentinels. A rule with no signal returns `pass`. No defensive
   `value or default` / `getattr(..., default)` on producer-guaranteed values
   (`check-py-contracts.py`).
5. **Config is AvNav editable-parameter state.** Enhanced settings are registered
   editable parameters parsed by `config.py`; they are never stored in `polar.json`.
   The viewer saves them via the plugin -> `api.saveConfigValues` path; the plugin
   updates `self.config` under the lock *before* persisting (per the AvNav contract
   in baseline fact 23).
6. **Lock ownership unchanged.** Only `plugin.py` holds the lock. New endpoints
   snapshot/mutate config under `self._lock` and format outside it. Reads for live
   status probe the store at the boundary and pass plain data to a pure formatter.
7. **400 non-empty-line limit binds every file.** `plugin.py` (336),
   `api_dispatch.py` (~330 non-empty), `params.py` (166 + ~27 params),
   `settings-ui.js` (219), and `rules_enhanced.py` must each stay under 400. Where a
   phase would breach the limit, split within that phase:
   - `params.py`: if it crosses 400, move the enhanced parameter dicts to a new
     `server/polarrecorder/params_enhanced.py` exporting `ENHANCED_PARAMETERS`, and
     concatenate in `params.py` (`EDITABLE_PARAMETERS = CORE_PARAMETERS + ENHANCED_PARAMETERS`).
   - `plugin.py`: keep new logic in server modules; `plugin.py` only wires.
   - `api_dispatch.py`: if it crosses 400, move enhanced route handlers to a new
     module imported by the `ROUTES` table, mirroring the existing structure.
   - Viewer: the Enhanced Rules section ships as a **new** `viewer/enhanced-settings.js`
     module under `window.Polarrecorder`; `settings-ui.js` only mounts it. This module
     carries the most markup in the plan (7 rules x toggle + 1-2 key pickers + threshold
     inputs + badge, plus fetch/save), so if it would cross 400 non-empty lines, split
     the per-rule row/control construction into a sibling
     `viewer/enhanced-settings-render.js` (`window.Polarrecorder.EnhancedSettingsRender`)
     within the same phase, keeping `enhanced-settings.js` as the orchestrator
     (fetch/save/refresh). Both files then need `/** Module: ... */` headers, accurate
     `Depends:` headers, `viewer.html` load-order entries, and per-file coverage targets.
8. **Layer/dependency headers.** Each new/edited `server/polarrecorder/**` module
   keeps an accurate `Depends:` header and a correct architectural layer
   (`check-py-dependencies.py`). Enhanced rules sit in the same layer as the other
   `validation/rules_*` modules.
9. **No gate weakening.** Do not lower coverage floors, skip checks, or suppress
   smells to go green; add tests and split files instead. Every custom checker rule
   touched gets a positive and clean self-test.
10. **Hot paths stay bounded.** Reading a bounded set of optional keys and running a
    fixed number of O(1) rules per sample must keep `check-performance.py` green; no
    per-sample super-linear work and no committed wall-clock baseline.

---

## Enhanced-signal model (shared design used across phases)

This section is normative for naming and units; phases reference it.

### Optional-signal roles and canonical units (set in the reader)

`Sample.enhanced` keys (all `float`), populated only when at least one rule that
consumes the role is enabled, its key(s) are configured, the store value is present,
and the value is fresh (`age <= config.stale_threshold`, reusing the core stale
threshold). Each role feeds exactly one rule; `current_drift_kt` is consumed only by
R20 (the SOG/STW paddlewheel check), so it is read when `enh_slip_enabled` and
`enh_current_drift_key` is set.

**Coerce-once at the reader.** Custom keys (RPM, engine-state, heel) can arrive from
`getSingleValue` as a bool, a number, or a string. The reader passes every raw
enhanced value through one boundary helper `_coerce_float(value) -> float | None`:
`bool -> 0.0/1.0`, `int`/`float -> float`, a numeric string -> parsed `float`, and a
**non-numeric string -> `None` (signal omitted, fail-open, debug-logged)** —
never a guessed value. (The log is at debug level with no per-key dedup, because the
reader is reconstructed each sample cycle and holds no cross-cycle state; "warn once"
state would have to live in `plugin.py`, which is not worth it for a debug line.) This is the single convert-once step; per-role unit conversion
(below) is applied to the coerced float. It removes the truthiness trap (a string
`"off"`/`"0"` must never read as engine-on) uniformly for every custom key.

| Role key in `enhanced` | Source store key (config field) | Store unit | Canonical unit | Conversion (after `_coerce_float`) |
|---|---|---|---|---|
| `rpm` | `enh_rpm_key` | rpm | rpm | none |
| `engine_signal` | `enh_engine_state_key` | bool/number/voltage | raw numeric (float) | none (rule applies threshold) |
| `depth_m` | `enh_depth_key` | meters | meters | none |
| `sog_kt` | `enh_sog_key` | m/s | knots | `meters_per_second_to_knots` |
| `awa_deg` | `enh_awa_key` | degrees | degrees | none |
| `aws_kt` | `enh_aws_key` | m/s | knots | `meters_per_second_to_knots` |
| `heel_deg` | `enh_heel_key` | degrees | degrees | none (use `abs` in the rule) |
| `current_drift_kt` | `enh_current_drift_key` | m/s | knots | `meters_per_second_to_knots` |
| `heading_deg` | `enh_heading_key` | degrees | degrees | none |
| `cog_deg` | `enh_cog_key` | degrees | degrees | none |

`engine_signal` is stored as the **coerced raw numeric** (a bool becomes `0.0`/`1.0`,
an RPM stays its value, an alternator voltage stays its value); R18 applies
`enh_engine_state_on_threshold` to it, so one knob covers every source type
(boolean -> leave `0.5`; RPM -> `~50`; alternator voltage -> `~13.2`). Mapping to
0/1 at the reader is deliberately avoided because it would discard the magnitude the
threshold needs.

"Definitive engine signal present" means `rpm` or `engine_signal` is present in
`enhanced`. It is used by the R16 enhancement.

### New editable parameters (added to the params list)

Defaults are On for every switch (ROADMAP requirement). String keys default to
`""` (optional / "not configured") except where a standard AvNav key is the natural
default. Numeric ranges are clamp bounds.

**Auto-activation on upgrade is intentional.** Because the depth, SOG, current-drift, and
apparent-wind keys default to their standard AvNav store keys *and* their switches
default On, R19 (depth), R20 (SOG/STW paddlewheel), and R21 (true-wind cross-check), plus
the heading/COG turn-confirmation, go **live on upgrade for any boat that already
publishes those keys** — no user action required.
This is the chosen behavior: these are the highest-value rules and most users want
them working out of the box. The escape hatch is per-rule: toggle a rule Off, or
clear its key, in the Enhanced Rules section. Only the genuinely custom signals
(`enh_rpm_key`, `enh_engine_state_key`, `enh_heel_key`) default to `""` because
AvNav core has no standard key for them. The README and `configuration.md` must call
out this upgrade activation explicitly so it is not a surprise.

| Name | Type | Default | Range | Purpose |
|---|---|---|---|---|
| `enh_rpm_enabled` | BOOLEAN | `true` | - | Enable RPM reject (R17). |
| `enh_rpm_key` | STRING | `""` | - | Store key for engine RPM. |
| `enh_rpm_idle_max` | NUMBER | `900` | 200-4000 | RPM above this rejects (engine driving). |
| `enh_engine_state_enabled` | BOOLEAN | `true` | - | Enable engine-state reject (R18). |
| `enh_engine_state_key` | STRING | `""` | - | Store key for engine state (boolean, RPM, alternator voltage, ...). |
| `enh_engine_state_on_threshold` | FLOAT | `0.5` | 0.0-10000.0 | `engine_signal >= this` means engine on. Boolean source: leave `0.5`; RPM source: `~50`; alternator-voltage source: `~13.2`. |
| `enh_depth_enabled` | BOOLEAN | `true` | - | Enable shallow reject (R19). |
| `enh_depth_key` | STRING | `"gps.depthBelowKeel"` | - | Store key for depth (meters). Defaults to depth-below-keel (the meaningful clearance) rather than depth-below-transducer. |
| `enh_depth_floor_m` | FLOAT | `1.0` | 0.5-50.0 | Clearance below this rejects (shallow-water / squat effects near the bottom). Lowered from 2.0 and keel-referenced to avoid rejecting normal sailing on a depth-below-keel reading. |
| `enh_slip_enabled` | BOOLEAN | `true` | - | Enable STW-implausibly-low reject (R20). |
| `enh_sog_key` | STRING | `"gps.speed"` | - | Store key for SOG. |
| `enh_current_drift_key` | STRING | `"gps.currentDrift"` | - | Store key for current drift (from VDR); used by the SOG/STW paddlewheel check (R20) to test whether current explains the SOG-STW gap. |
| `enh_slip_sog_floor_kt` | FLOAT | `1.0` | 0.3-10.0 | SOG must exceed this for R20 to apply (boat clearly moving). |
| `enh_slip_ratio` | FLOAT | `0.5` | 0.1-0.9 | Reject when `stw_kt < sog_kt * ratio` *and* a present `current_drift_kt < (sog_kt - stw_kt)` shows the current is too small to account for the gap (paddlewheel reads implausibly low vs SOG; follows from R20 needing both SOG and a current-drift reading). |
| `enh_tw_crosscheck_enabled` | BOOLEAN | `true` | - | Enable true-wind cross-check (R21). |
| `enh_awa_key` | STRING | `"gps.windAngle"` | - | Store key for apparent wind angle. |
| `enh_aws_key` | STRING | `"gps.windSpeed"` | - | Store key for apparent wind speed. |
| `enh_tw_twa_tol_deg` | FLOAT | `15.0` | 3.0-45.0 | Allowed TWA disagreement. |
| `enh_tw_tws_tol_kt` | FLOAT | `3.0` | 0.5-15.0 | Allowed TWS disagreement. |
| `enh_heel_enabled` | BOOLEAN | `true` | - | Enable heel-band reject (R22). |
| `enh_heel_key` | STRING | `""` | - | Store key for heel/roll (degrees). |
| `enh_heel_min_deg` | FLOAT | `0.0` | 0.0-45.0 | Reject below this `|heel|` (0 = off, multihull-safe). |
| `enh_heel_max_deg` | FLOAT | `35.0` | 5.0-90.0 | Reject above this `|heel|`. |
| `enh_turnconfirm_enabled` | BOOLEAN | `true` | - | Enable heading/COG turn confirmation. |
| `enh_heading_key` | STRING | `"gps.headingTrue"` | - | Store key for heading. |
| `enh_cog_key` | STRING | `"gps.track"` | - | Store key for COG. |
| `enh_turn_min_roc` | FLOAT | `3.0` | 0.5-30.0 | Heading/COG deg/s at/above which a TWA spike is a real turn; below it the maneuver reject is suppressed. |

### New reason codes and pipeline placement

| Rule | Reason code | Decision | Pipeline group | `is_sailing_candidate` | Rationale |
|---|---|---|---|---|---|
| R17 | `reject_engine_rpm` | reject | pre-candidate | `False` | Motoring is not sailing. |
| R18 | `reject_engine_on` | reject | pre-candidate | `False` | Motoring is not sailing. |
| R19 | `reject_shallow` | reject | pre-candidate | `False` | Shallow-water squat (Bernoulli) slows the boat; like `reject_head_to_wind`, not representative sailing data. |
| R20 | `reject_sog_stw_mismatch` | reject | quality-gate (candidate) | `True` | Boat was sailing; sample/sensor unrepresentative. |
| R21 | `reject_true_wind_crosscheck` | reject | quality-gate (candidate) | `True` | Boat was sailing; wind sensor/calibration error. |
| R22 | `reject_heel_out_of_band` | reject | quality-gate (candidate) | `True` | Boat was sailing; over/underpowered sample. |

Candidacy follows the existing architecture mechanics and the chosen grouping:
R17-R19 are pre-candidate (`is_sailing_candidate=False`, counted via
`record_non_candidate`), treated like `reject_head_to_wind` — conditions under which
the boat is not producing representative polar data: motoring (R17/R18) and
shallow-water squat slowing the boat (R19). R20-R22 are candidate-gate
(`is_sailing_candidate=True`, counted via `record_rejected`): the boat was sailing in a
clean condition but the specific sample or sensor is unrepresentative — R20 (paddlewheel
failure), R21 (wind sensor/calibration), R22 (over/underpowered heel).

**Why there is no current-strength reject.** A polar maps STW (through water) against true
wind over water; AvNav publishes `gps.trueWindAngle` as `angleTrueWater` (computed against
STW), so TWS and STW live in the same water frame. A uniform current is a Galilean
translation of that frame: it changes SOG/COG but leaves the equilibrium relation
`STW = f(TWS_water, heading)` untouched, shifting the recorded TWS and the resulting STW
*together*, so the `(STW, TWS_water)` point stays valid (a following current lowers both;
a head current raises both). A current-*magnitude* reject is therefore unjustified by
physics, and as a wind-against-tide sea-state proxy it is too blunt to be useful (it
cannot tell flat wind-with-tide from rough wind-against-tide). It was removed (see Out of
Scope). Current drift is still read — but only by R20 (SOG/STW) as gap corroboration. No
new counter methods are required by the surviving enhanced rejects.

### Live status states (computed in `plugin.py`, formatted by a pure helper)

A rule's status is computed over its **key set with an explicit combinator**, not a
single key, because two rules need more than one key:

- Single-key rules (R17, R18, R19): one required key.
- R20 (SOG/STW mismatch): requires **both** `enh_sog_key` and `enh_current_drift_key`
  (`all`) — R20 needs a current-drift reading to test whether the current can account
  for the SOG-STW gap, so its badge must show `inactive_key_*` when the current-drift
  key is absent even though the SOG key is present.
- R21 (true-wind cross-check): requires **both** `enh_awa_key` and `enh_aws_key`
  (`all`).
- Turn-confirmation: requires **either** `enh_heading_key` or `enh_cog_key` (`any`).

Each rule declares `(required_keys, combinator)` where combinator is `all` or `any`
(single-key rules are `all` over a one-element set). The state machine then walks the
*set*:

`disabled` (switch off) -> `inactive_key_not_configured` (on, but the combinator
cannot be satisfied by the configured keys: `all` and any key empty, or `any` and all
keys empty) -> `inactive_key_missing` (configured keys present per the combinator, but
the needed `getSingleValue` reads return `None`) -> `inactive_value_missing` (needed
keys read but stale, age > stale_threshold) -> `active` (combinator satisfied with
fresh values). The status row carries the rule's full configured key list (not a
single `key` field) so the viewer badge and key picker can render every key the rule
uses. The pure `enhanced_status` helper (Phase 5) takes the per-key
`(present, fresh)` probe results plus each rule's `(required_keys, combinator)` and
returns the resolved state. **Precedence is deterministic** so the states are
testable: evaluate top-to-bottom and return the first that holds — `disabled`, then
`inactive_key_not_configured`, then `active` (combinator satisfied by the fresh keys),
then `inactive_value_missing` (≥1 configured key read but all such reads stale), then
`inactive_key_missing` (the remaining case: configured but reads returned `None`). The
`value_missing`-before-`key_missing` order means a rule with one stale read and one
absent read reports `inactive_value_missing` (the more-progressed state), under both
`all` and `any`.

---

## Implementation Order

Each phase ends with `tools/check-all.sh` green and the listed fixtures/tests/docs
synced. Phases are ordered so behavior changes land only when their tests land.

### Phase 1 - Enhanced configuration surface (no runtime behavior change)

**Intent.** Add the enhanced editable parameters and parse them into `Config`, with
no rule wired yet, so the gate stays green while the config vocabulary exists.

**Dependencies.** None.

**Deliverables.**
- `server/polarrecorder/params.py`: add the 27 parameters from the table. If the
  file would exceed 400 non-empty lines, create
  `server/polarrecorder/params_enhanced.py` (`ENHANCED_PARAMETERS`) and concatenate
  (`EDITABLE_PARAMETERS = CORE_PARAMETERS + ENHANCED_PARAMETERS`); update
  `Depends:` headers accordingly.
- `server/polarrecorder/config.py`: add the matching fields to `Config` with the
  documented defaults and types (`bool`/`str`/`int`/`float`). `parse_config_values`
  already iterates `EDITABLE_PARAMETERS`; verify `STRING` parsing passes raw values
  through (it does via `_parse_spec_value` returning `raw_value`).
- `documentation/user/configuration.md`: extend the parameter table with the new
  rows and a short paragraph describing the enhanced-rule settings group.
- `documentation/avnav/editable-parameters.md`: update the registered count from 23 to
  50 (both the prose "registers 23 parameters" and the "registers exactly these 23
  parameter names:" list) so the enumerated-name contract stays exact.
- `documentation/TABLEOFCONTENTS.md`: update the "Polar Recorder's 23 settings"
  reference to 50.
- `tests/test_config.py`: assert defaults, clamping for each numeric range, boolean
  parsing, and string pass-through for the key fields.
- `tests/mock-data/config.json`: add the new fields with default values.
- `tests/test_api_handlers.py`: update the `format_config` expectation if it asserts
  the full config shape (it returns native config values).

**Exit conditions.**
- `default_config()` returns the documented defaults for all 27 new enhanced fields
  (50 registered parameters total).
- `parse_config_values` clamps each numeric field to its range and preserves valid
  string keys; invalid numerics fall back to previous/default.
- `tools/check-all.sh` green; no runtime decision changes (no rule reads these yet).

### Phase 2 - Enhanced reader and `Sample.enhanced` population

**Intent.** Read configured optional keys, convert each unit once, and populate
`Sample.enhanced`; still no rule consumes it, so decisions are unchanged.

**Dependencies.** Phase 1.

**Deliverables.**
- `server/polarrecorder/sample.py`:
  - Add an enhanced raw carrier to `ReadResult` (e.g. `enhanced_raw: dict[str, tuple[float, float]] | None`
    mapping role -> `(value, timestamp)`), defaulting to `None`.
  - Extend `build_sample` to convert raw enhanced reads into the canonical
    `Sample.enhanced` dict using `units.py`, dropping any whose `age` exceeds the
    passed stale threshold. `build_sample` gains a parameter for the stale
    threshold (or receives the freshness-filtered dict). Keep absent -> omitted.
- `server/polarrecorder/reader.py`:
  - Add an enhanced-signal spec (role -> config key field, conversion kind, and the
    set of rule-enable fields that consume the role). A role is read when **any** of its
    consuming rules is enabled and its key is configured. Each role maps to one rule;
    `current_drift_kt` is consumed only by R20 (SOG/STW), so it is read when
    `enh_slip_enabled` and `enh_current_drift_key` is set.
    Provide a helper that, given a `Config`, yields the `(role, store_key, conversion)`
    set for every signal at least one enabled rule needs.
  - Read each via `getSingleValue(key, includeInfo=True)` (the existing protocol
    method), capturing value+timestamp. Pass each raw value through a single
    `_coerce_float(value) -> float | None` boundary helper (`bool -> 0.0/1.0`,
    `int`/`float -> float`, numeric string -> parsed, non-numeric string -> `None`
    omitted + debug-logged). Type its parameter as the raw store value (`object`, or a
    `bool | int | float | str` union) — **not** `float` — so the bool/string branches stay
    reachable under `mypy --strict`; the `DataEntryLike.value: float` protocol annotation
    is the optimistic core-read shape and a custom enhanced key may legitimately arrive as
    a bool or string. Drop coerced-`None` roles; assemble `enhanced_raw` from
    the coerced floats. `enhanced_raw` therefore stays `dict[str, tuple[float, float]]`.
  - Keep the reader AvNav-free; it depends only on `StoreAPI`, `sample`, `units`,
    `logger`, and (new) `config` (type-only import). Update `Depends:`/layer.
- **Update the call sites for the new signatures (this phase, not deferred).**
  `build_sample` is invoked at `validation/pipeline.py:56` **and** `plugin.py:167`
  (`_record_suppressed`), and `StoreReader` is constructed at `plugin.py:137` without a
  `Config` today. This phase must: (a) pass the `Config` into the reader so it knows
  which enhanced keys to read (`plugin.py:137`); (b) update both `build_sample` call
  sites consistently with the chosen signature — whether `build_sample` gains a
  stale-threshold parameter or the reader pre-filters freshness into `enhanced_raw`
  (the latter keeps `build_sample`'s signature stable and avoids touching
  `_record_suppressed`, which does not take `config` today). `plugin.py` only wires;
  no domain logic moves into it. These edits change no decision because no rule reads
  `enhanced` until Phase 3.
- `documentation/architecture/data-pipeline.md` and
  `documentation/avnav/keys-and-units.md`: document the enhanced read path, the
  role/unit table, and the freshness rule.
- `tests/test_reader.py`: a fake store returning extra keys; assert
  enabled+configured+fresh keys populate `enhanced` with converted units, and that
  disabled/unconfigured/missing/stale keys are omitted. Assert that `current_drift_kt`
  is populated when `enh_slip_enabled` is on with `enh_current_drift_key` set, and
  omitted when `enh_slip_enabled` is off.
  Cover `_coerce_float` explicitly: `True`/`False` -> `1.0`/`0.0`, numeric value passes
  through, numeric string parses, and a non-numeric string omits the role (engine-state
  as boolean vs RPM vs voltage all land as the coerced numeric `engine_signal`).
- `tests/test_sample.py`: assert `build_sample` conversions and the stale-drop
  behavior; assert `enhanced is None` when no optional signals are configured.

**Exit conditions.**
- With no enhanced keys configured, `Sample.enhanced is None` and every existing
  validation test passes unchanged.
- With keys configured, `enhanced` contains exactly the fresh, converted,
  canonical-unit values; units verified against `units.py`.
- `check-runtime-contracts.py` stays green (no non-finite leak into enhanced).

### Phase 3 - The six pure enhanced rejection rules + pipeline wiring

**Intent.** Implement R17-R22 in `rules_enhanced.py`, wire them into the pipeline in
the documented order and candidacy, and make R16 enhanced-aware.

**Dependencies.** Phases 1-2.

**Deliverables.**
- `server/polarrecorder/validation/rules_enhanced.py`: replace the stub with six
  pure functions, each `(sample: Sample, config: Config) -> RuleResult`:
  - `reject_engine_rpm`: present `rpm` and `rpm > config.enh_rpm_idle_max`.
  - `reject_engine_on`: present `engine_signal` and
    `engine_signal >= config.enh_engine_state_on_threshold`.
  - `reject_shallow`: present `depth_m` and `depth_m < config.enh_depth_floor_m`.
  - `reject_sog_stw_mismatch`: requires present `sog_kt` **and** present
    `current_drift_kt`, with `sog_kt > config.enh_slip_sog_floor_kt`,
    `sample.stw_kt < sog_kt * config.enh_slip_ratio`, **and**
    `current_drift_kt < (sog_kt - sample.stw_kt)`. This is the asymmetric
    paddlewheel-failure case (boat clearly moving per SOG, STW reads implausibly low),
    not a symmetric `abs(sog-stw)` band. STW far below SOG is *also* the signature of a
    strong **following** current (honest data), so R20 fires only when the present
    current is too small to produce the observed SOG-STW gap — i.e.
    `current_drift_kt < (sog_kt - stw_kt)`, the along-track gap a current of that
    magnitude could at most account for — leaving a failing paddlewheel as the remaining
    explanation. With no current-drift signal R20 does not fire, so honest
    following-current samples are never discarded. This gap-relative test is **exact,
    SOG-floor-independent, and self-contained** (no other rule need run first). An earlier
    design used a fixed `current_drift_kt <= max` gate, but because the minimum possible
    gap at the SOG floor (`floor*(1-ratio)`) is smaller than any fixed drift bound, it
    still false-rejected honest light-air-with-current data (e.g. SOG 2.0 / STW 0.8 /
    drift 1.3, gap 1.2 fully explained by 1.3 kt of current); the gap-relative test
    removes that false-reject. Head current never trips R20 (`stw < sog*ratio` is false
    when STW >= SOG).
  - `reject_true_wind_crosscheck`: present `awa_deg` and `aws_kt`; recompute
    expected true wind from apparent wind and `sample.stw_kt`:
    `tws_calc = sqrt(aws^2 + stw^2 - 2*aws*stw*cos(awa))`,
    `twa_calc = atan2(aws*sin(awa), aws*cos(awa) - stw)` (apply `math.degrees` and
    normalize `% 360.0` so `twa_calc` is in the same 0-360 bow convention as
    `gps.trueWindAngle`); reject when circular TWA difference exceeds
    `enh_tw_twa_tol_deg` **or** `abs(tws_calc - sample.tws_kt) > enh_tw_tws_tol_kt`.
    Reuse `angle_math.circular_distance`; do not re-implement it
    (`canonical-helper-redefinition`). Convert `awa_deg` to radians (`math.radians`)
    for the trig; the law-of-cosines argument is non-negative so `sqrt` is safe, and
    R21 only runs after the pre-candidate gate (so `stw_kt > anchored/low-wind floors`).
    Scope to document: `gps.trueWindAngle` is `angleTrueWater` (water-referenced,
    [avnav_nmea.py:130]), so the recompute is dimensionally consistent. In the AvNav-core
    NMEA model true wind is parsed from instrument MWV (ref=T)/MWD sentences
    ([avnav_nmea.py:498-530]) and is computed inside the wind instrument independently of
    `gps.windAngle`/`windSpeed` + STW, so this cross-check has real teeth (it catches a
    miscalibrated wind sensor or a divergent boat-speed feed). It degrades to a
    near-tautology **only** in a SignalK/plugin setup where true wind is derived from the
    *same* AWA/AWS/STW it is checked against; there R21 still has teeth against an
    independent instrument source or a miscalibrated sensor. Note this scope in
    `poisoning-resistance.md`.
  - `reject_heel_out_of_band`: present `heel_deg`; let `h = abs(heel_deg)`; reject
    when `h > config.enh_heel_max_deg` or `h < config.enh_heel_min_deg` (with the
    default `min=0`, only the upper bound is active).
  - Each returns `pass` when its signal is absent. Add `Depends:` (config, sample,
    validation.angle_math) and the correct layer.
- `server/polarrecorder/validation/rules_heuristic.py`: make `engine_heuristic`
  enhanced-aware - suppress the R16 quarantine (`return pass`) **only when the engine
  signal reads off**: `engine_signal` present and `< config.enh_engine_state_on_threshold`,
  or `rpm` present and `<= RPM_OFF_CEILING` (a named module constant for a stopped
  engine, ~0 rpm — not a magic literal, per the magic-threshold smell). When `rpm` is
  present but in the idle band (`0 < rpm <= enh_rpm_idle_max`, i.e. running yet below
  R17's reject ceiling) the signal has not settled the motoring question, so fall
  through and run the existing low-wind/moving heuristic. Engine-*on* is already a
  pre-candidate reject (R17/R18) and never reaches R16. Keep the heuristic unchanged
  for the no-signal case. Do **not** blanket-suppress on mere signal presence.
- `server/polarrecorder/validation/pipeline.py`:
  - Append the three pre-candidate rejects (R17, R18, R19) to
    `_run_pre_candidate_rules` after `anchored_heuristic` — like `reject_head_to_wind`,
    these mark a non-representative situation (`is_sailing_candidate=False`).
  - Insert the three quality-gate rejects in the order **R20, R21, R22** into
    `_run_candidate_rules` after `stability_window` and before `engine_heuristic`, so a
    definitive enhanced reject wins over the R16 quarantine. These yield
    `is_sailing_candidate=True`. The three (SOG/STW, true-wind, heel) are mutually
    independent, so their relative order does not affect correctness.
  - Update the `Depends:` header to include `rules_enhanced`.
- `documentation/filters/rejection-rules.md`: add R17-R22 rows, the candidacy
  column behavior, and the R16 enhancement note.
- `documentation/architecture/data-pipeline.md`: replace the "worked sketches" with
  the implemented behavior; document candidacy per rule.
- `documentation/filters/poisoning-resistance.md`: note how definitive engine/depth
  signals harden the model versus the R16 guess; record **why there is no current-strength
  reject** (a uniform current does not distort a water-referenced (STW, TWS_water) point —
  TWS and STW shift together — and a current-magnitude reject is too blunt a
  wind-against-tide sea-state proxy to be useful); record the R21 true-wind cross-check
  scope (true wind from instrument MWV-T/MWD is independent of `gps.windAngle`/`windSpeed`
  + STW, so the cross-check has teeth in the AvNav-core NMEA model and degrades to a
  near-tautology only under SignalK/plugin-derived true wind); and record the R20 SOG/STW
  rule and its limitations (R20 fires only when the present current is too small to
  account for the SOG-STW gap, `current_drift_kt < (sog_kt - stw_kt)`, so boats without a
  current-drift source get no SOG/STW-mismatch detection — and if the VDR set/drift device
  computes drift from the *same* paddlewheel that feeds `gps.waterSpeed`, a broken log
  inflates the computed drift too and R20 is silently defeated; both are deliberate prices
  of never discarding honest following-current data, which shares the STW-below-SOG
  signature).
- `pyproject.toml`: the `[tool.coverage.report]` note that `rules_enhanced.py` "reaches
  full line coverage via the smoke import in `test_validation_heuristic.py`" goes stale the
  moment real rules land. Update it to record that `rules_enhanced.py` now ships real rules
  exercised by `tests/test_validation_enhanced.py` and held to the validation-package
  95%/95% floor (`tools/check-coverage.py`), not a smoke import.
- Tests:
  - New `tests/test_validation_enhanced.py`: per-rule pass/reject across present,
    absent, boundary, and disabled (key omitted) cases; true-wind math with a known
    apparent/STW triangle; heel band including `min=0`; R20 STW-implausibly-low
    (rejects when `stw < sog*ratio`, `sog > floor`, and a present
    `current_drift_kt < (sog_kt - stw_kt)` shows the current cannot account for the gap;
    passes for healthy STW; passes when `stw < sog*ratio` but `current_drift_kt`
    is **absent** — the following-current safety case; **and passes when
    `current_drift_kt >= (sog_kt - stw_kt)`** — a present current large enough to explain
    the gap, e.g. SOG 2.0 / STW 0.8 / drift 1.3, so honest following current is never
    rejected); R18 `engine_signal`
    against `enh_engine_state_on_threshold` at the
    boundary value for a boolean source (`0.5`), an RPM source (`~50`), and an
    alternator-voltage source (`~13.2`).
  - `tests/test_validation_heuristic.py`: R16 suppressed when the engine signal reads
    **off** (`engine_signal < on_threshold`, or `rpm <= RPM_OFF_CEILING`); R16's
    heuristic **still runs** when `rpm` is present in the idle band
    (`0 < rpm <= enh_rpm_idle_max`) — a low-wind/moving idle-in-gear sample is still
    quarantined, not blanket-accepted; unchanged when no engine signal is present.
    Remove the now-vestigial `rules_enhanced` smoke-import assertion
    (`rules_enhanced.__name__`, currently `test_validation_heuristic.py:4` and `:21`),
    which existed only to give the empty stub coverage; the real rules are now covered by
    `test_validation_enhanced.py`.
  - `tests/test_validation_pipeline.py`: ordering and candidacy
    (`is_sailing_candidate`) for each new reject; enhanced reject precedence over
    R16.
  - `tests/test_poisoning_scenarios.py`: motoring-with-RPM, shallow,
    bad-paddlewheel (SOG/STW), and miscalibrated-wind scenarios reject as expected;
    and a strong-following-current scenario is **accepted** (no current-strength reject
    exists, and R20's gap test does not fire when the drift explains the gap).
  - `tests/mock-data/rejections.json`: add the new reason codes.

**Exit conditions.**
- Each enhanced rule is pure (no AvNav/IO/lock), passes on absent signal, and emits
  exactly its reason code on reject.
- Pipeline order and candidacy match the normative table; R16 is suppressed by a
  present engine signal.
- `check-py-contracts.py`, `check-py-dependencies.py`, `check-performance.py`, and
  coverage floors stay green.

### Phase 4 - Heading/COG turn confirmation (R11/R14 hardening)

**Intent.** Use heading/COG rate-of-change to suppress a false maneuver reject when
a TWA spike is actually a wind shift (boat not turning).

**Dependencies.** Phases 2-3 (needs `heading_deg`/`cog_deg` in `enhanced`).

**Deliverables.**
- `server/polarrecorder/validation/state.py`: extend `WindowEntry` with optional
  `heading_deg: float | None` and `cog_deg: float | None`; `entry_from_sample`
  reads them from `sample.enhanced` (omitted -> `None`). Keep the frozen dataclass
  and prune/window logic unchanged.
- `server/polarrecorder/validation/rules_stability.py`: in `twa_rate_of_change`,
  when `config.enh_turnconfirm_enabled` and a prior+current heading and/or COG is
  available, compute each available signal's circular rate
  (`circular_distance(current, previous) / elapsed`). Conclude "not turning" only when
  **every available signal is below** `config.enh_turn_min_roc` — equivalently, compare
  the **maximum** of the available rates to the threshold: when both heading and COG are
  present they must *both* be below it; when only one is present, that one decides. If
  "not turning" holds while the TWA rate is high, treat it as a wind shift: return `pass`
  and do **not** set `cooldown_expires`. A single available signal at/above the threshold
  is treated as a real turn (reject + cooldown as today), so a swinging COG (current,
  leeway, waves) over a steady heading fails safe toward today's R11 rather than
  suppressing a possibly-real maneuver. When neither heading nor COG is available,
  behavior is exactly as today (fail-open to current R11). Reuse
  `angle_math.circular_distance`.
- `documentation/filters/rejection-rules.md` and
  `documentation/architecture/data-pipeline.md`: document the R11/R14 enhancement
  and that turn-confirm requires heading or COG in `enhanced`.
- Tests:
  - `tests/test_validation_stability.py`: TWA spike + steady heading -> no reject,
    no cooldown set; TWA spike + turning heading -> reject + cooldown as today;
    TWA spike + both heading and COG steady -> no reject; TWA spike + steady heading
    but swinging COG (both present, signals disagree) -> reject + cooldown, because the
    max-of-rates is at/above the threshold and must not suppress; turn-confirm disabled
    or heading/COG absent -> unchanged R11; COG-only and heading-only variants.
  - `tests/test_validation_pipeline.py`: end-to-end wind-shift sample is accepted
    when stability otherwise holds.

**Exit conditions.**
- With no heading/COG signal, every existing stability test passes unchanged.
- A steady-heading TWA spike is no longer rejected and starts no cooldown; a real
  turn still rejects and cools down.

### Phase 5 - Plugin API: available keys, live status, enhanced-settings save

**Intent.** Give the viewer the data and the write path it needs, keeping `plugin.py`
thin and domain logic pure.

**Dependencies.** Phases 1-4.

**Deliverables.**
- New pure module `server/polarrecorder/enhanced_status.py`: given the `Config` and a
  per-key probe result (`present: bool`, `fresh: bool`) computed at the boundary,
  return the per-rule status list (`rule`, `enabled`, `keys` (the rule's full
  configured key list), `status`, threshold fields) using the key-set state machine
  above. Each rule declares its `(required_keys, combinator)` (`all`/`any`); R20 is
  `all` over `enh_sog_key`+`enh_current_drift_key` (it needs a current-drift reading to
  test whether the current can account for the SOG-STW gap), R21 is `all` over AWA+AWS,
  turn-confirm is `any` over
  heading/COG, the rest are `all` over one key. Pure, no AvNav. Assign a layer and
  `Depends:` header.
- `server/polarrecorder/api_handlers.py`: add `format_enhanced_keys(keys)` and
  `format_enhanced_status(status_rows)` formatters (or fold into existing `ok(...)`
  wrappers) returning JSON-serializable payloads.
- `server/polarrecorder/api_dispatch.py`: add routes (if the file would exceed 400
  non-empty lines, move enhanced handlers to a new
  `server/polarrecorder/api_enhanced.py` imported by `ROUTES`):
  - `GET enhanced/keys` -> `plugin` enumerates currently-present keys via
    `self.api.getDataByPrefix(...)` for a small set of prefixes (`gps`, plus any
    configured enhanced-key prefixes), flattens the hierarchical dict to dotted
    keys, sorts, and returns `{keys: [...]}`. Free-text entry is a viewer concern.
  - `GET enhanced/status` -> snapshot `self.config` under the lock; probe each
    configured key via `self.api.getSingleValue(key, includeInfo=True)`
    (present + fresh against `stale_threshold`); call `enhanced_status` outside the
    lock; return the status rows.
  - `GET enhanced/save` -> validate the incoming names against the enhanced
    parameter allowlist (reject unknown names with a clear error envelope,
    fail-closed), then parse them through `parse_config_values` (enhanced names only,
    `previous=self.config` so core fields are preserved). Apply under `self._lock`
    (set `self.config` to the merged config) and **release the lock before** calling
    `self.api.saveConfigValues({...string values...})`. This ordering is safe and
    deliberate: `saveConfigValues` -> `pluginhandler.changeChildConfigDict` only
    persists to disk and does **not** invoke the registered change callback
    (`_on_config_change`) — verified at `server/handler/pluginhandler.py:961`; the
    callback fires only from AvNav's own config-dialog `updateConfig` path
    (`:1051`). So the plugin self-applies first (per AvNav contract fact 23), there is
    no re-entrancy on the non-reentrant `self._lock`, and the disk write does not run
    while the lock is held (it would otherwise block the sample loop). Return the new
    enhanced config (reuse `format_config` shape or a subset).
- `plugin.py`: add only the thin glue (key enumeration call, per-key probe, save
  call). Keep new logic in `enhanced_status.py`/dispatch. If `plugin.py` approaches
  400 non-empty lines, extract the probe/enumeration glue into a small server helper
  invoked from `plugin.py`.
- `documentation/architecture/api.md`: add the three endpoints to the table and a
  paragraph on the save path using `api.saveConfigValues` and the key-enumeration
  limits (only currently-present keys; custom keys via free text).
- Tests:
  - `tests/test_api_handlers.py`: `format_enhanced_keys`/`format_enhanced_status`
    output; `enhanced_status` state machine for every state, including the `all`
    combinator for R20 (SOG present, current-drift key missing -> `inactive_key_*`) and
    R21 (one of AWA/AWS missing -> `inactive_key_*`), and the `any` combinator for
    turn-confirm (heading present, COG missing -> still `active`).
  - New `tests/test_enhanced_status.py` (if logic warrants its own file).
  - `tests/test_plugin_integration.py`: fake AvNav API exposing
    `getDataByPrefix`/`getSingleValue`/`saveConfigValues`; assert `enhanced/keys`
    returns sorted present keys, `enhanced/status` reflects configured/missing/stale,
    and `enhanced/save` persists (saveConfigValues called) and hot-applies
    (`self.config` updated, next sample uses it). Extend the integration fake in
    `tests/plugin_integration_support.py` as needed.
  - `tests/mock-data/status.json`: only if the main status payload changes (it does
    not; enhanced status is a separate endpoint).

**Exit conditions.**
- `enhanced/keys` returns currently-present store keys; `enhanced/status` returns the
  correct state per rule; `enhanced/save` persists via `saveConfigValues` and updates
  `self.config` under the lock before persisting (baseline fact 23).
- Lock discipline preserved; formatters pure; gate green.

### Phase 6 - Viewer Settings "Enhanced Rules" section

**Intent.** Render the third Settings section: per-rule switch, key dropdown +
free-text, threshold inputs, and live status badge; save through `enhanced/save`.

**Dependencies.** Phase 5.

**Deliverables.**
- New `viewer/enhanced-settings.js` (`window.Polarrecorder.EnhancedSettings`),
  plain script, `/** Module: ... */` header, `Depends:` header listing real
  cross-file namespace references (`viewer.js`, `dom.js`, possibly `placeholders.js`):
  - Fetch current config (`GET config`), available keys (`GET enhanced/keys`), and
    status (`GET enhanced/status`); render one row/card per rule with: a toggle, **one
    key `<select>` (dropdown + free-text) per key the rule declares** — two for the
    true-wind cross-check (AWA, AWS) and two for turn-confirmation (heading, COG),
    driven by the status row's `keys` list — the rule's threshold inputs, and a status
    badge from `enhanced/status`.
  - Save via `enhanced/save` (action GET), then re-fetch status to refresh badges.
  - Build markup with DOM APIs only (no `innerHTML`); route all errors to visible
    state; no `console.log`/`var`/loose equality; use `Number.isFinite`; use
    `Polarrecorder.Placeholders` for any absent-value text.
- `viewer/settings-ui.js`: mount the new section as the third card
  (`state.host.appendChild(Polarrecorder.EnhancedSettings.render())` or an `Init`
  call), keeping `settings-ui.js` under 400 lines. Update its `Depends:` header.
- `viewer/viewer.html`: add `enhanced-settings.js` in the gate-checked load order
  (before `settings-ui.js` consumes it).
- `viewer/viewer.css`: add scoped styles for the section and status badges using
  `--polarrecorder-*` custom properties only.
- If `enhanced-settings.js` would cross 400 non-empty lines, split per-rule
  row/control construction into `viewer/enhanced-settings-render.js` within this phase
  (per Hard Constraint 7); add its header, `Depends:`, `viewer.html` load-order entry,
  and coverage target too.
- `tools/check-js-coverage.mjs`: add `viewer/enhanced-settings.js` (and
  `enhanced-settings-render.js` if split) to the per-file coverage target map and
  exercise it via vm-based viewer tests.
- `documentation/architecture/ui.md`: document the third Settings section, the
  key-picker + free-text behavior, and the status badges.
- Tests:
  - vm-based viewer test for `enhanced-settings.js` (render with a contract-valid
    payload; assert no `NaN`/`undefined`/`null` token, status badges render, save
    posts the right params). Keep `check-viewer-contracts.mjs` green.
  - Update `check-smell-contracts.mjs` expectations for the new script + load order.

**Exit conditions.**
- The Settings tab shows the Enhanced Rules section with working toggles, key
  pickers (dropdown + free text), threshold inputs, and live status badges.
- Saving persists and the status badges update; all viewer gates green (namespace,
  patterns, headers, dependencies, duplication, file size, coverage, contracts).

### Phase 7 - README and documentation sync, final gate

**Intent.** Complete the user-facing documentation sync and final verification.

**Dependencies.** Phases 1-6.

**Deliverables.**
- `README.md`: add an Enhanced/Optional Signals section covering what each of the six
  rules does (engine RPM, engine state, shallow, SOG/STW paddlewheel, true-wind
  cross-check, heel — there is **no** current-strength reject; current drift only
  corroborates the SOG/STW check); that all switches default On; that
  depth/SOG/current-drift/apparent-wind/heading/COG keys are **prefilled with standard
  AvNav keys and therefore activate on upgrade** for boats that publish them (with the
  per-rule Off toggle / clear-key escape hatch), while RPM/engine-state/heel default to
  `""` and stay inactive until a custom key is set; the Settings-tab third section, the
  store-key picker + free-text custom keys, and
  the Python 3.9 stdlib / no-pip constraint reaffirmation if needed (Section 9
  categories: configuration + viewer behavior).
- `documentation/TABLEOFCONTENTS.md`: add any new docs/modules introduced
  (`enhanced_status` doc pointer, `api_enhanced`/`params_enhanced` if created).
- Record explicitly deferred/removed sub-scope in this plan only (the
  current-strength reject was evaluated and **removed** for lack of physics basis;
  current-set/drift *compensation* and heel *tagging* were considered and intentionally
  not implemented).
- Re-run `tools/check-all.sh` and confirm green end to end.

**Exit conditions.**
- `README.md` and mapped docs reflect the shipped behavior; `npm run check:docs`
  green; `tools/check-all.sh` green.

---

## Documentation Impact

| Doc | Change | Phase |
|---|---|---|
| `documentation/user/configuration.md` | New enhanced parameters table rows + settings-group paragraph | 1 |
| `documentation/avnav/editable-parameters.md` | Registered count 23 -> 50; extend the exact parameter-name list | 1 |
| `documentation/avnav/keys-and-units.md` | Optional-signal role/unit table; freshness rule | 2 |
| `documentation/architecture/data-pipeline.md` | Enhanced read path, implemented rules, candidacy, R11/R14/R16 enhancements | 2,3,4 |
| `documentation/filters/rejection-rules.md` | R17-R22 rows; R16 enhancement; turn-confirm note | 3,4 |
| `documentation/filters/poisoning-resistance.md` | Definitive signals vs R16 guess | 3 |
| `documentation/architecture/api.md` | `enhanced/keys`, `enhanced/status`, `enhanced/save` endpoints + save path | 5 |
| `documentation/architecture/ui.md` | Settings third section, key picker, status badges | 6 |
| `README.md` | User-facing optional-signals + settings section | 7 |
| `documentation/TABLEOFCONTENTS.md` | "23 settings" -> "50 settings" (Phase 1); link any new docs/modules (Phase 7) | 1,7 |

---

## Acceptance Criteria

### Behavior

- [ ] For any signal whose key is empty or whose value is absent/stale, that rule
      is a no-op (returns `pass`); accept/reject/quarantine decisions are unaffected.
      The prior validation tests, which use no enhanced keys, pass unchanged. Note:
      because the depth/SOG/current-drift/apparent-wind keys default to standard AvNav
      keys with switches On, those rules *do* activate on upgrade for boats that publish
      those keys — this is intentional (see "Auto-activation on upgrade" above), not
      a regression, and is covered by new tests rather than by the legacy no-enhanced
      suite.
- [ ] Each of R17-R22 rejects exactly when its configured, present, fresh signal
      crosses its threshold, and passes when the signal is absent, stale, or its
      switch is off.
- [ ] An engine-*on* signal (RPM above `enh_rpm_idle_max`, or engine-state at/above
      `enh_engine_state_on_threshold`) produces a direct R17/R18 reject; an engine-*off*
      signal (engine-state below threshold, or RPM at/below `RPM_OFF_CEILING`) suppresses
      the R16 quarantine; an RPM in the idle band (`0 < rpm <= enh_rpm_idle_max`) does
      **not** suppress R16, so its heuristic still quarantines a low-wind/moving sample;
      with no engine signal, R16 behaves as today.
- [ ] A TWA spike with steady heading/COG is accepted (no maneuver reject, no
      cooldown); a TWA spike with a real heading/COG turn still rejects and cools
      down; with no heading/COG signal, R11/R14 are unchanged.
- [ ] All optional-signal unit conversions occur once at the reader/sample boundary;
      no downstream re-conversion; absent values are omitted, never sentinels.

### Tests

- [ ] New `tests/test_validation_enhanced.py` covers all six rules incl. the
      true-wind triangle and the heel band (`min=0` and `min>0`).
- [ ] `test_validation_heuristic.py`, `test_validation_stability.py`,
      `test_validation_pipeline.py`, `test_poisoning_scenarios.py`, `test_reader.py`,
      `test_sample.py`, `test_config.py`, `test_api_handlers.py`,
      `test_plugin_integration.py` updated and green.
- [ ] New `enhanced_status` state-machine tests cover every status value.
- [ ] vm-based viewer test for `viewer/enhanced-settings.js`; `check-js-coverage.mjs`
      target added; `check-viewer-contracts.mjs` green.
- [ ] Any custom checker rule touched has a positive and clean self-test.

### Docs

- [ ] All rows in the Documentation Impact table delivered.
- [ ] `README.md` updated for configuration + viewer behavior (Section 9).
- [ ] `npm run check:docs` green; `documentation/TABLEOFCONTENTS.md` updated for any
      new doc.

### Release impact

- [ ] No new runtime dependency; Python 3.9 stdlib only; no target-device pip.
- [ ] `tools/check-all.sh` green at the end of every phase and at handoff.
- [ ] Every changed file is under the 400 non-empty-line limit (with splits applied
      as needed per Hard Constraint 7).

---

## Out of Scope (deferred, recorded here)

- **Current-strength reject (`reject_strong_current`)**: removed. A uniform current does
  not distort a water-referenced `(STW, TWS_water)` polar point (TWS and STW shift
  together), so a current-*magnitude* reject has no physics basis; as a wind-against-tide
  sea-state proxy it is too blunt (it cannot tell flat wind-with-tide from rough
  wind-against-tide) and would discard good data on upgrade. Current drift is still read,
  but only by R20 (SOG/STW) as gap corroboration. Revisit only with a real sea-state
  signal (e.g. wave height / accelerometer), not current magnitude.
- **Current set/drift *compensation*** (vector-correcting STW): rejected because
  compensation mutates samples and conflicts with the convert/validate-once rule.
  Revisit only with a dedicated design.
- **Heel *tagging*** (storing heel per accepted sample): rejected in favor of a
  band reject, because tagging requires a `polar.json` schema bump and migration.
- ROADMAP items 2 (dashboard widgets) and 3 (dyninstruments palette).

---

## Related

- [ROADMAP item 1](../../ROADMAP.md)
- [Data pipeline](../../documentation/architecture/data-pipeline.md)
- [Rejection rules](../../documentation/filters/rejection-rules.md)
- [Configuration](../../documentation/user/configuration.md)
- [AvNav keys and units](../../documentation/avnav/keys-and-units.md)
- [API shape](../../documentation/architecture/api.md)
- [Viewer UI](../../documentation/architecture/ui.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Exec-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- Completed predecessors: `exec-plans/completed/PLAN1.md`, `PLAN2.md`, `PLAN3.md`
</content>
</invoke>
