# PLAN1 — Polar Data Quality Diagnostics and Filter Hardening

## Status

Implemented through all six phases and seven implementation-review remediation passes.

### Amendment — 2026-08-26: seventh implementation-review remediation

A fresh archive review found that R20 could reject when usable SOG was paired with invalid current drift while its live
status incorrectly reported unavailable; multi-source status rows also hid secondary invalid causes. Completion now
additionally requires an explicit `active_invalid_corroboration` R20 state with normalized availability `active`,
per-source status states, canonical `ReadResult.enhanced_values` naming, diagnostic invalid causes, trimmed persisted
source keys, unconditional configuration-transaction guard cleanup, a mechanical acquisition/rule-registry consistency
test with the shared SOG exception, and corrected lifecycle/API/README contracts. Structured logging is specified as
decision diagnostics for completed store reads, not literal full-pipeline replay; reader exceptions remain ordinary
AvNav loop errors. `plugin.py` remains at its hotspot ceiling, so future integration growth requires planned
decomposition before new responsibilities are added. Optional-source timing skew remains an investigation item because
the available evidence still does not establish a safe threshold.

**Seventh-review exit evidence:** `npm run check:all` exited successfully with 453 Python tests, 365 tooling tests, 61
viewer tests, 1 plugin test, 96.33% aggregate Python coverage, and 92.75% viewer/plugin line coverage. The focused
status, diagnostics, configuration, acquisition, validation, poisoning, API, and integration suite passed 163 Python
tests; focused enhanced/advanced viewer coverage passed 6 tests. The smell scan checked 333 files with zero findings,
and strict typing, packaging, documentation, duplication, complexity, scaling, file-size, and coverage-inventory checks
all passed. `plugin.py` remains unchanged at its 379-non-empty-line hotspot ceiling.

### Amendment — 2026-08-26: sixth implementation-review remediation

A fresh archive review found that optional speed conversion could overflow after acquisition had already classified the
raw value as usable, overlapping persist-before-install configuration saves could leave runtime and persisted state
different, source-key changes retained observations from the old source, cross-field setting relationships were not
validated, and a read discarded after a configuration change produced no diagnostic record. Completion now additionally
requires canonical one-time enhanced normalization with role-specific upper bounds shared by sampling and live status;
poison-resistant R20 handling for invalid current corroboration; one in-flight configuration transaction using the
existing plugin lock; complete-config heel/cooldown validation; source-dependent history reset; explicit
`config_superseded` diagnostics; synchronized README/docs; focused deterministic regressions; and a green full gate.

The review's enhanced-source timing-skew observation remains an investigation item rather than a behavior change: the
available evidence does not establish a safe cross-source skew threshold for optional signals.

**Sixth-review exit evidence:** `npm run check:all` exited successfully with 448 Python tests, 365 tooling tests, 61
viewer tests, 1 plugin test, 96.31% aggregate Python coverage, and 92.75% viewer/plugin line coverage. The focused
acquisition, poisoning, configuration, status, diagnostic, and integration suite passed 81 tests before the full gate;
strict typing, packaging, documentation, smell, duplication, complexity, scaling, hotspot, file-size, and coverage-
inventory checks all passed. `plugin.py` remains at 379 non-empty lines, exactly within its enforced hotspot budget.

### Amendment — 2026-08-24: fifth implementation-review remediation

A fresh archive review found that enhanced settings bypassed strict server validation, a failed configuration write
could leave runtime state ahead of persisted state, negative unsigned enhanced signals remained usable, RPM-only
protection was described as definitive despite its intentional idle band, and future core timestamps displayed as
fresh in Status. Completion now additionally requires one validator shared by both settings endpoints; persist-before-
install transaction semantics; role-specific nonnegative acquisition bounds; an explicit partial-RPM product contract
whose startup warning requires a real engine-state source; canonical future-time Status classification; synchronized
README/docs; and focused regression coverage. The review also exposed a written file-size-policy mismatch, resolved by
making the existing `exec-plans/` exemption explicit in the highest-precedence principles and authoring guide.

**Fifth-review exit evidence:** `npm run check:all` exited successfully with 438 Python tests, 365 tooling tests, 61
viewer tests, 1 plugin test, 96.29% aggregate Python coverage, and 92.75% viewer/plugin line coverage. The focused
configuration, acquisition, status, warning, and heuristic suite passed 62 Python and 10 viewer tests before the full
gate; strict typing, packaging, dependency, runtime-contract, documentation, smell, duplication, complexity, scaling,
file-size, and coverage-inventory checks all passed.

### Amendment — 2026-08-24: fourth implementation-review remediation

A fresh archive review found a recursive-lock regression with nested paused-path acquisition, unsafe arithmetic on
untrusted core and enhanced timestamps, R16/R20-R22 outcomes incorrectly retaining R15 history, an R15 continuity rule
that two sparse endpoints could satisfy at slower configured sampling, incomplete diagnostic evidence, stale lifecycle
prose, duplicated mutable window duration, and shallowly immutable decision evidence. Completion now additionally
requires exactly one mechanically enforced ordinary plugin lock with external callbacks after release; total finite
timestamp boundaries; outcome-specific stability-history retention; time-span, gap, and observation-density continuity;
diagnostic schema 4; one config-owned stability duration; tuple-backed decision evidence; synchronized docs and README;
focused counterexamples; and a green full quality gate.

**Fourth-review exit evidence:** `npm run check:all` exited successfully with 422 Python tests, 365 tooling tests, 61
viewer tests, 1 plugin test, 96.14% aggregate Python coverage, and 92.74% viewer/plugin line coverage. Focused
timestamp, history, stability, diagnostic, integration, and checker regressions passed before the full gate; the pattern
checker reported zero findings, duplication reported zero clones, and `plugin.py` remained below its hotspot budget at
377 non-empty lines.

### Amendment — 2026-08-24: third implementation-review remediation

A fresh archive review found a paused malformed-input crash, non-candidate observations warming R15, sparse endpoints
satisfying the R15 span, boolean physical inputs passing as numbers, an enhanced integer-overflow escape, misleading
core readiness, and stale R20 configuration prose. Completion now additionally requires total core/enhanced boundaries,
role-aware boolean handling, separate transition and sailing-eligible history, a three-interval R15 continuity bound,
fresh usable core readiness, synchronized user documentation, focused regressions, and a green full quality gate.

**Third-review exit evidence:** `npm run check:all` exited successfully with 401 Python tests, 364 tooling tests, 61
viewer tests, 1 plugin test, 96.02% aggregate Python coverage, and 92.74% viewer/plugin line coverage. The focused
input, pipeline, stability, diagnostics, status, and plugin-integration regression suite passed 117 tests before the
full gate.

### Amendment — 2026-08-24: second implementation-review remediation

A fresh review found that enhanced status accepted fresh but unusable values, diagnostic formatting could interrupt
decision accounting for nonnumeric core input, checker guards were narrower than their documented contracts, and several
user-facing descriptions still described earlier behavior. Completion now additionally requires one canonical
missing/stale/invalid/usable enhanced-input contract shared by reading and status, observational diagnostic schema v2
emitted after canonical accounting, deeply immutable R15 predicate evidence, category-level catch and host-boundary
checks with negative tests, synchronized anchoring/stability/SOG descriptions, and a green full quality gate.

**Second-review exit evidence:** `npm run check:all` exited successfully with 392 Python tests, 364 tooling tests, 61
viewer tests, 1 plugin test, 96.09% aggregate Python coverage, and 92.74% viewer/plugin line coverage.

### Amendment — 2026-08-24: implementation-review remediation

Post-implementation review proved that several acceptance conditions did not hold despite the earlier green gate. The
following are confirmed defects and are required before this plan can return to Implemented status:

1. Suppressed iterations construct a predicate-bearing result but bypass the canonical counter recorder, so their
   predicate histogram is not updated.
2. The catch-fallback checker accepts a boundary marker that the suppression checker forbids. The marker escape is
   removed; a catch may instead return an explicit structured failure result or update visible failure state.
3. Browser-local warning suppression relies on a global error listener and a fake that does not model thrown storage
   errors. Storage reads/writes must use an explicit boundary result, with read and write failures tested.
4. Host store adapters and direct `getSingleValue`/`getDataByPrefix` calls leaked into domain modules. All host API
   spelling stays in `plugin.py`, and the architecture checker must enforce that boundary.
5. Diagnostic R15 formatting re-runs an evaluator that prunes and reconfigures live validation state. The pipeline
   result must carry the immutable evaluation used for the decision, and formatting must leave all live state unchanged.
6. SOG acquisition is incorrectly disabled with R20 even though R10 consumes SOG independently. A configured fresh SOG
   is always acquired for anchoring; current drift remains conditional on R20.
7. Enhanced availability collapses mixed missing/stale causes. Cause resolution must be deterministic: unconfigured,
   missing, stale, then active, while any-key rules remain active when any configured source is fresh.
8. Replay diagnostics lose individually available raw core reads and omit source timestamps/ages, enhanced raw metadata,
   and a record schema version.
9. The warning needs dialog semantics, a backdrop, initial focus, focus containment, Escape/Close restoration, and
   non-interactive background content.
10. Status exposes internal rule/status identifiers while Settings owns a separate label map. One shared viewer module
    must render user-facing rule and cause labels in both screens.
11. Restore histogram validation mislabels predicate failures as rejection failures, and ROADMAP content appears after
    its terminal Related section.
12. R10's SOG-authoritative behavior can reject real sailing against strong adverse current. This remains the specified
    behavior, but a counterexample test and user documentation must state the limitation rather than implying certainty.

This is one review-remediation phase and one commit. It changes no validation threshold or primary-decision ordering,
adds no new reject rule, and does not expand persistence or runtime configuration. Its exit conditions are:

- focused Python tests prove suppressed reason/predicate accounting, diagnostic state purity and complete decision fields,
  SOG/R10 independence from R20, deterministic enhanced causes, the adverse-current counterexample, corrected restore
  labels, and host-boundary enforcement;
- focused viewer/tool tests prove explicit storage failure handling, accessible modal behavior, shared labels, and the
  removal of the contradictory marker escape;
- maintained README/docs describe only user-relevant behavior and the known R10 limitation; ROADMAP ordering is valid;
- generated inventories are refreshed with `npm run inventory:write` if the test/file set changes;
- `npm run check:all` exits successfully before the single remediation commit.

**Review-remediation exit evidence:**

1. Accounting, diagnostics, SOG/R10, availability, restore, boundary, and poisoning tests:
   `venv/bin/python -m pytest tests/test_diagnostics.py tests/test_reader.py tests/test_enhanced_status.py tests/test_restore.py tests/test_py_contracts_checker.py tests/test_plugin_integration.py tests/test_validation_core.py tests/test_validation_stability.py tests/test_validation_pipeline.py tests/test_poisoning_scenarios.py -q`
   — **152 passed**.
2. Warning/modal, shared-label, viewer integration, and checker contracts:
   - focused viewer command — **5 files, 17 tests passed** before the unknown-identifier coverage case was added;
   - focused tool command — **2 files, 37 tests passed**;
   - final full viewer suite — **12 files, 60 tests passed**.
3. Inventory regeneration: `npm run inventory:write` — **exit 0**; the executable test file set was already current.
4. Core quality proof: `npm run check:core` — **exit 0**, including **385 Python tests**, **363 tooling tests**, **60
   viewer tests**, **1 plugin test**, **26 scaling tests**, strict typing, packaging, docs, suppression, complexity,
   smell, focus, and unchanged file/hotspot limits.
5. Completion proof: `npm run check:all` — **exit 0**. Python coverage was **95.95%** aggregate; viewer/plugin coverage
   was **92.72% lines**, **91.47% statements**, **86.58% functions**, and **74.81% branches**. The new shared label
   module measured **100% lines/functions** and **87.5% branches**. Coverage inventory passed.

### Amendment — 2026-08-24: quality baseline restored

The committed README baseline was discovered at 381 non-empty lines, exceeding its enforced hotspot budget of 380.
Rather than weaken the budget or its ratchet, the README was consolidated around user-facing installation, operation,
configuration, and troubleshooting guidance; implementation detail and duplicated reference material were removed in
favor of the maintained documentation links. The README now has 208 non-empty lines,
`npx vitest run --project tools tests/js/hotspot-budgets.test.mjs` passes all 7 tests, and `npm run check:all` exits 0.

This plan is the implementation source of truth for the data-quality changes derived from findings **#2, #6, #9, #10,
and #11, #17, #18, #19, #22, #23, #25, and #28**. Observable behavior, compatibility requirements, and the validation
semantics below are prescriptive. Internal helper names and small file-local refactors are flexible when needed to
satisfy repository layering, complexity, duplication, and file-size gates.

Explicit exclusions are also prescriptive: finding #12 does not change the head-to-wind rule; finding #6 does not add a
new slow-sample reject; finding #22 does not implement segment-based learning; finding #24 is only a prior summary and
creates no separate work item.

## Goal

After completion, Polar Recorder will:

1. Make it clear in the Status UI that `total_seen` means sailing **Candidates**, not every reader iteration, and
   explain that non-candidate diagnostics such as missing inputs are outside the candidate denominator.
2. Preserve the current primary decision/reason behavior while additionally recording every triggered validation
   predicate, including `unstable_twa`, `unstable_tws`, and `unstable_stw` for R15.
3. Evaluate the current sample as part of the R15 stability window before accepting it.
4. Prefer fresh SOG for anchored detection, fall back to STW only when SOG is unavailable, and change the existing
   `anchored_stw_threshold` default from `0.3` to `0.5` kn without renaming the saved config key.
5. Make the R20 SOG/STW consistency check symmetric so implausibly high STW can be rejected as well as implausibly low
   STW, while retaining the existing current-drift escape and reason code.
6. Expose each enhanced rule with a normalized `active` / `disabled` / `unavailable` availability state while retaining
   the existing detailed status cause.
7. Show a startup engine-protection popup when no definitive engine-state rule is active, with exactly **Close** and
   **Never show again** actions; RPM-only protection remains explicitly partial.
8. Expand the existing `debug_logging` mode into one structured diagnostic log record per completed store read containing
   raw/normalized sample values, available enhanced inputs, the primary decision, all triggered predicates, and R15
   rolling-window metrics suitable for later threshold analysis.
9. Add two explicit post-MVP items to `ROADMAP.md`: an investigation of isolated slow accepted samples despite P65
   protection (finding #6), and stable-segment/block learning as a possible future architecture (finding #22).
10. Keep the head-to-wind default and behavior at **10 degrees**.

## Finding-to-Deliverable Map

| Finding | Planned result                                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| #2      | Rename `Seen` to `Candidates`, clarify denominator/diagnostic semantics, and surface triggered-check diagnostics.                              |
| #6      | No new reject rule. Add a ROADMAP **Investigation** for multi-day evidence on isolated slow accepted samples; P65 remains the protection now.  |
| #9      | R15 stability ranges include the current sample before the decision is made.                                                                   |
| #10     | R15 emits diagnostic predicate codes `unstable_twa`, `unstable_tws`, and/or `unstable_stw` while its primary reason remains `reject_unstable`. |
| #11     | Prefer fresh SOG for R10 anchoring; otherwise use STW. Change `anchored_stw_threshold` default to `0.5` kn.                                    |
| #17     | Startup engine-protection popup with **Close** and **Never show again**.                                                                       |
| #18     | Enhanced rule rows expose `active` / `disabled` / `unavailable` availability and the Status tab displays all rules.                            |
| #19     | R20 becomes a symmetric SOG/STW mismatch check using the existing ratio, movement floor, and current-drift input.                              |
| #22     | Do not implement segment learning. Add it to `ROADMAP.md`.                                                                                     |
| #23     | Apply only the STW fallback default change (`0.3` -> `0.5` kn); keep head-to-wind at `10` degrees.                                             |
| #25     | Keep current primary reason semantics and additionally record all triggered predicates globally and per candidate bin.                         |
| #28     | Implement structured raw diagnostic logging through the existing `debug_logging` switch; no separate unbounded log file.                       |

## Verified Baseline

1. `exec-plans/active/` contains no numbered plan, so this is the next plan as `PLAN1.md`.
2. `server/polarrecorder/config.py` currently defaults `head_to_wind_threshold=10`, `anchored_stw_threshold=0.3`, and
   `debug_logging=False`.
3. `server/polarrecorder/params.py` independently declares the persisted/default value of `anchored_stw_threshold` as
   `0.3` with an allowed range of `0.1` to `1.0`; the head-to-wind default there is `10`.
4. `server/polarrecorder/validation/rules_core.py::anchored_heuristic` currently classifies anchoring only from
   `STW < anchored_stw_threshold` while wind is present; it does not inspect SOG.
5. Fresh optional SOG and current-drift values already enter `Sample.enhanced` through `StoreReader`; stale optional
   values are omitted before validation. SOG/current reads are tied to `enh_slip_enabled` and the configured enhanced
   keys.
6. `server/polarrecorder/validation/rules_stability.py::stability_window` prunes and evaluates only entries already in
   `ValidationState.window`; the current sample is not included in its TWA/TWS/STW ranges.
7. `plugin.py::_run_iteration` calls `pipeline.run(...)`, derives warming state, and only then calls
   `ValidationState.observe(sample)`, confirming that the current sample is appended after the pipeline decision.
8. `RuleResult` and `PipelineResult` currently carry decision reason codes only; there is no independent field for
   triggered/failed predicates.
9. `_run_pre_candidate_rules` and `_run_candidate_rules` build tuples of rule results before selecting the first
   non-pass result. Python therefore already evaluates all rules in that phase in order, including the existing state
   side effect where TWA ROC can start cooldown before the cooldown predicate is evaluated. The implementation must
   preserve that evaluation order and side-effect behavior while retaining all predicate diagnostics.
10. R15 currently collapses all out-of-range TWA/TWS/STW cases to the single reason `reject_unstable`.
11. `server/polarrecorder/validation/rules_enhanced.py::reject_sog_stw_mismatch` currently rejects only when STW is
    implausibly **low** relative to SOG and current drift is too small to explain the difference.
12. R20 currently requires both fresh SOG and fresh current drift; if either is absent it passes. This fail-open
    availability behavior remains required.
13. `server/polarrecorder/enhanced_status.py` currently returns detailed statuses (`active`, `disabled`,
    `inactive_key_not_configured`, `inactive_key_missing`, `inactive_value_missing`) but no normalized three-state
    availability field.
14. `viewer/enhanced-settings.js` already renders enhanced-rule status badges in Settings; the Status tab does not show
    enhanced-rule availability.
15. `viewer/status-ui.js` labels `counters.total_seen` as **Seen** and calculates/displays acceptance rate from that
    candidate total. It also renders `top_rejections`, whose global histogram can contain non-candidate diagnostics.
16. `server/polarrecorder/counters.py` persists candidate totals plus one global `rejection_histogram`. It has no
    predicate histogram. Per-bin state likewise records decision rejection reasons but no predicate histogram.
17. Persistence schema version 1 serializes counters and sparse bins; existing deserializers tolerate missing optional
    nested fields through default construction. Any new predicate histogram must therefore be additive and default to
    empty for existing backups; this plan does not require a schema-version bump.
18. The viewer currently has no popup/modal module and no local-storage preference for engine warnings.
19. The engine RPM and engine-state rules already have live enhanced-status rows. On default config their keys are
    empty, so a fresh install can have those rules enabled but unavailable.
20. `debug_logging` currently emits one short line per completed store read containing only decision and reason codes.
    User configuration documentation explicitly describes one debug line per completed read.
21. `viewer/viewer.html` statically orders all viewer scripts and styles; any new viewer module must be added there and
    remain a plain script under `window.Polarrecorder`.
22. `tools/release-archive.mjs` automatically includes `viewer/*.js` and `viewer/*.css`, so an isolated warning module
    can ship without a new release allowlist entry, but packaging tests must still prove it is present.
23. Existing targeted tests cover validation pipeline ordering, R15, R20, enhanced status, counters/persistence, Status
    UI, Enhanced Settings, and the integrated viewer harness. These are the primary extension points for regression
    coverage.
24. `ROADMAP.md` currently contains neither the isolated-slow-sample investigation nor stable-segment learning.
25. `README.md` and maintained docs currently describe R10 as STW-only, R15 as using the prior window, R20 as
    STW-implausibly-low, the anchor default as `0.3` kn, and `debug_logging` as decision/reason-only logging; all must
    be synchronized with the implementation.

## Hard Constraints

1. **Do not change `head_to_wind_threshold` from 10 degrees** in code, parameter defaults, documentation, fixtures, or
   tests. Finding #12 is explicitly rejected for implementation.
2. **Do not add a new slow-sample/outlier rejection rule for finding #6.** P65 remains the current protection. The only
   deliverable for #6 is a ROADMAP investigation.
3. **Do not implement segment-based learning for finding #22.** The only deliverable for #22 is a ROADMAP item.
4. Keep existing decision semantics and public reason codes backward-compatible. In particular:
   - R15 primary reason remains `reject_unstable`.
   - R20 primary reason remains `reject_sog_stw_mismatch`.
   - existing `reason_codes` fields remain available to current API/model/timeline consumers.
5. Add predicate diagnostics as a parallel contract; do not replace current reason histograms with the new histogram.
6. Preserve current rule evaluation order and side effects. Refactoring the eager tuples into named evaluated-result
   collections is allowed only if every rule still executes in the same order within the reached phase.
7. Pre-candidate rejection still prevents candidate-phase evaluation. Phase-A R1/R2 behavior remains multi-reason and
   non-candidate.
8. R15 must inspect the current sample **without committing it to `ValidationState` before the pipeline finishes**.
   `state.observe(sample)` remains the post-pipeline state update.
9. Keep the saved config key name `anchored_stw_threshold` for compatibility. Its new `0.5` kn value is used as the
   anchoring speed floor for fresh SOG when present and as the STW fallback when SOG is absent.
10. R10 keeps the existing `TWS > 0` requirement. When fresh SOG exists, SOG is authoritative for R10 and STW is not
    used as a second anchor predicate; STW is the fallback only when SOG is unavailable.
11. R20 remains fail-open when SOG is unavailable or current drift is missing/stale. Invalid configured current drift
    cannot corroborate the gap, so usable SOG may still produce the existing R20 rejection. No new enhanced source or
    threshold is added for the symmetric check.
12. The symmetric R20 formula is prescriptive:

    ```text
    faster = max(SOG, STW)
    slower = min(SOG, STW)
    gap = faster - slower
    moving = faster > enh_slip_sog_floor_kt
    ratio_mismatch = slower < faster * enh_slip_ratio
    current_too_small = current_drift < gap
    reject iff moving AND ratio_mismatch AND current_too_small
    ```

13. Keep the existing enhanced detailed status strings for compatibility and add a normalized availability field:
    `active`, `disabled`, or `unavailable`. The R20-only `active_invalid_corroboration` detail maps to `active`; all
    `inactive_*` detailed states map to `unavailable`. Every row exposes its per-source states.
14. The engine warning is a viewer-startup check, not a heartbeat popup. It may be evaluated once per page load and is
    suppressed only when `reject_engine_on` has normalized availability `active`; an active RPM rule alone is partial.
15. The engine warning has exactly two user actions:
    - **Close**: dismiss for the current page load only; do not persist suppression.
    - **Never show again**: persist a versioned browser-local suppression key and dismiss.
16. The warning suppression is browser-local, not Polar Recorder runtime configuration and not `polar.json` state. If
    browser storage cannot persist the preference, do not silently claim success; show a visible message that the
    preference could not be saved and allow **Close**.
17. Use the existing `debug_logging` switch for #28. Do not add a second diagnostics switch, a background writer, an
    unbounded NDJSON file, a new lock, or a new timer.
18. Diagnostic logs remain one line per completed store read and must serialize finite JSON-compatible values only;
    unavailable values are `null`, never NaN/Infinity sentinels. Reader exceptions before a `ReadResult` use the AvNav
    loop error path.
19. Keep runtime Python 3.9+ stdlib-only and maintain the single-lock boundary in `plugin.py`.
20. New domain modules must receive the mandatory module header and a valid layer assignment in
    `tools/check-py-dependencies.py`; no AvNav imports may enter `server/polarrecorder/`.
21. New viewer code is plain JavaScript under `window.Polarrecorder`, no modules, no unsafe DOM APIs, no extra timer,
    and no duplicated helper implementation.
22. No release/version bump or release artifact creation is part of this plan. Packaging validation is required because
    viewer runtime files change.
23. No suppression comments, skipped/focused tests, lowered coverage floors, or threshold relaxations may be used to get
    green.

## Expected Affected Files

The implementation should stay within this set unless a repository gate proves an adjacent owner must change:

### Validation and state

- `server/polarrecorder/sample.py`
- `server/polarrecorder/validation/pipeline.py`
- `server/polarrecorder/validation/rules_core.py`
- `server/polarrecorder/validation/rules_stability.py`
- `server/polarrecorder/validation/rules_enhanced.py`
- `server/polarrecorder/validation/state.py`
- `server/polarrecorder/config.py`
- `server/polarrecorder/params.py`

### Diagnostics, model, persistence, and API

- `server/polarrecorder/counters.py`
- `server/polarrecorder/bins.py`
- `server/polarrecorder/polar_model.py`
- `server/polarrecorder/commit.py`
- `server/polarrecorder/persistence.py`
- `server/polarrecorder/restore.py`
- `server/polarrecorder/enhanced_status.py`
- `server/polarrecorder/api_handlers.py`
- `server/polarrecorder/api_dispatch.py`
- `server/polarrecorder/diagnostics.py` (new, if a dedicated formatter is the cleanest layer owner)
- `plugin.py`
- `tools/check-py-dependencies.py` only if a new Python module is added and needs layer registration

### Viewer

- `viewer/viewer.js`
- `viewer/status-ui.js`
- `viewer/enhanced-settings.js`
- `viewer/viewer.html`
- `viewer/engine-warning.js` (new)
- `viewer/engine-warning.css` (new; preferred over growing unrelated CSS owners)
- `tools/viewer-harness.mjs` and/or its `tools/viewer-harness/` helpers for the local-storage fake

### Tests and fixtures

- `tests/test_validation_pipeline.py`
- `tests/test_validation_stability.py`
- `tests/test_validation_core.py`
- `tests/test_validation_enhanced.py`
- `tests/test_poisoning_scenarios.py`
- `tests/test_enhanced_status.py`
- `tests/test_counters.py`
- `tests/test_polar_model.py`
- `tests/test_persistence.py`
- `tests/test_restore.py`
- `tests/test_api_handlers.py`
- `tests/test_plugin_integration.py`
- `tests/js/viewer-enhanced.test.mjs`
- `tests/js/viewer-smoke.test.mjs`
- `tests/js/viewer-engine-warning.test.mjs` (new, preferred for focused popup behavior)
- `tests/js/viewer-render-contract.test.mjs` when the new Status output changes render-contract fixtures
- `tests/mock-data/status.json` and other mock fixtures whose documented API shape changes
- test inventory/coverage policy files only when the canonical inventory/coverage checker requires them; never lower a
  floor

### Documentation verification

- `README.md`
- `ROADMAP.md`
- `documentation/filters/rejection-rules.md`
- `documentation/filters/poisoning-resistance.md`
- `documentation/architecture/data-pipeline.md`
- `documentation/architecture/persistence.md`
- `documentation/architecture/api.md`
- `documentation/architecture/ui.md`
- `documentation/user/configuration.md`

No new maintained documentation page is planned, so `documentation/TABLEOFCONTENTS.md` should not need a new link.

## Implementation Order

## Execution Prerequisite

The required targeted Python commands invoke `python -m pytest`. On 2026-08-24, the repository execution environment's
`/usr/bin/python` reported `No module named pytest`. Before Phase 1 may begin, provision the project's approved
development test environment so that this exact command resolves `pytest`; do not replace the targeted commands with an
unplanned alternative. Re-run the Phase 1 targeted command successfully as the prerequisite evidence.

### Phase 1 — Add parallel predicate diagnostics without changing primary decisions

**Intent:** Implement findings #10 and #25 first, and the status clarity part of #2, so later validation changes can be
observed without replacing existing reason-code contracts.

**Dependencies:** None.

**Deliverables:**

1. Extend `RuleResult` with a default-empty predicate-code collection. Existing two-argument construction must remain
   source-compatible.
2. Define rule-result helper behavior so:
   - a simple rejecting/quarantining rule records its existing reason code as its predicate code;
   - a pass records no predicate code;
   - R15 can record `reject_unstable` as the decision reason while independently recording one or more of
     `unstable_twa`, `unstable_tws`, `unstable_stw`.
3. Extend `PipelineResult` with `failed_predicates` (or an equivalently named field if type/lint conventions demand it).
   The current `reason_codes` contract remains untouched.
4. Refactor the pre-candidate and candidate result selection so all already-reached rule results are retained, the first
   non-pass result still supplies the primary decision/reason, and predicate codes from all non-pass results in that
   reached phase are aggregated in deterministic rule order without duplicates caused solely by aggregation.
5. Add R15 sub-predicate calculation without yet changing its prior-window behavior; this isolates telemetry changes
   from the behavioral R15 change in the next phase.
6. Add a global `predicate_histogram` to `Counters`. Record pipeline predicates exactly once per iteration after the
   decision is known. Reset and copy semantics must include the new histogram.
7. Add per-bin predicate histograms for rejected/quarantined sailing candidates so later backup analysis can answer
   where a predicate fires by TWA/TWS bin. Accepted samples do not create predicate counts; non-candidates remain global
   only because they are not committed to model bins today.
8. Persist global and per-bin predicate histograms as additive schema-v1 fields. Existing backups missing the fields
   load with empty predicate histograms; restore validation accepts both old and new shapes. Do not bump
   `CURRENT_SCHEMA_VERSION`.
9. Extend status/API formatting with a bounded `top_predicates` list while preserving existing `top_rejections` for
   compatibility.
10. Change Status UI wording:
    - `Seen` -> `Candidates`;
    - `Acceptance rate` -> `Candidate acceptance rate`;
    - label the current primary reason list as diagnostic/decision reasons and state explicitly that non-candidate input
      and sailing exclusions are not part of the candidate denominator, so their counts can exceed Candidates;
    - render the new top triggered predicates separately so R15 causes become visible.
11. Do **not** invent a historical `total_read_attempts` counter in this phase. Existing persisted data cannot
    reconstruct it exactly because one read can produce multiple non-candidate reason codes. The UI clarification must
    not present a synthetic count as fact.

**Tests/evidence:**

- Extend `tests/test_validation_pipeline.py` with cases where multiple same-phase predicates trigger but the first
  reason/decision remains unchanged.
- Extend `tests/test_validation_stability.py` to assert each R15 sub-predicate and multi-cause instability.
- Extend `tests/test_counters.py`, `tests/test_polar_model.py`, `tests/test_persistence.py`, and `tests/test_restore.py`
  for predicate histogram recording, reset, copy, old-backup defaulting, and round-trip behavior.
- Extend status API and viewer tests to prove `Candidates`, candidate-rate wording, primary reasons, and triggered
  predicates render without `undefined`, `null`, or NaN tokens.
- Targeted commands:
  - `python -m pytest tests/test_validation_pipeline.py tests/test_validation_stability.py tests/test_counters.py tests/test_polar_model.py tests/test_persistence.py tests/test_restore.py tests/test_api_handlers.py -q`
  - `npx vitest run --project viewer tests/js/viewer-smoke.test.mjs tests/js/viewer-render-contract.test.mjs`
  - `npm run check:patterns`
  - `npm run check:python-contracts`

**Exit condition:** Existing primary decisions/reason codes are unchanged in regression tests, new predicate diagnostics
round-trip through backup/restore, Status clearly says Candidates, and `npm run check:all` is green.

### Phase 2 — Harden R15, R10, and R20 validation behavior

**Intent:** Implement findings #9, #11, #19, and the STW-only part of #23 using the diagnostic foundation from Phase 1.

**Dependencies:** Phase 1.

**Deliverables:**

1. Introduce one canonical R15 evaluation helper/structure that can report:
   - whether the rolling window is filled;
   - window span;
   - TWA circular range;
   - TWS linear range;
   - STW linear range;
   - which of `unstable_twa`, `unstable_tws`, `unstable_stw` are triggered.
2. R15 must build its evaluation from the retained prior window **plus the current sample** without appending the
   current sample to live state. The subsequent `ValidationState.observe(sample)` call remains the only commit of that
   sample.
3. Keep the existing warm-up duration and threshold comparisons (`>=` threshold is unstable). The only R15 behavioral
   change is that the current sample participates in the ranges.
4. Update R10 anchoring:
   - if fresh `sog_kt` is present in the sample, compare SOG to the existing `anchored_stw_threshold` value and do not
     also use STW for that sample;
   - if SOG is absent, use STW as the fallback exactly as today;
   - keep `TWS > 0` as a required condition;
   - keep reason code `reject_anchored`.
5. Change the default `anchored_stw_threshold` from `0.3` to `0.5` in both `Config` and the canonical parameter
   declaration. Keep its valid range unchanged and keep the persisted key name for compatibility.
6. Update the Advanced Settings label/description so users understand that the value is the anchoring speed floor,
   applied to SOG when available and to STW as fallback, while the internal key remains `anchored_stw_threshold`.
7. Add a hard regression assertion that `head_to_wind_threshold` remains `10` in `default_config()` and parameter
   metadata.
8. Replace the one-sided R20 mismatch predicate with the symmetric formula from Hard Constraint 12. Keep both enhanced
   inputs mandatory/fresh, keep the current drift escape, keep existing config fields/defaults, and keep the reason code
   `reject_sog_stw_mismatch`.
9. Update the Enhanced Settings label/help from “STW implausibly low” semantics to bidirectional “SOG/STW consistency”
   semantics without adding a new threshold.

**Tests/evidence:**

- R15 regression: a stable prior window plus an unstable current sample must now reject on that same sample and expose
  the correct sub-predicate(s).
- R15 regression: an in-range current sample still passes, warm-up semantics remain unchanged, and `state.window` is not
  appended by `pipeline.run`.
- R10 cases: low SOG/high STW rejects as anchored; available moving SOG prevents STW fallback; absent SOG uses STW;
  threshold equality semantics are explicit; default is `0.5`; head-to-wind remains `10`.
- R20 cases: implausibly low STW rejects, implausibly high STW rejects, healthy ratios pass, large enough current drift
  passes in either direction, unavailable/stale enhanced inputs remain fail-open, and the movement floor is based on the
  faster of SOG/STW as specified.
- Extend poisoning-scenario coverage with a high-STW sensor-failure case and a current-explained counterexample.
- Targeted commands:
  - `python -m pytest tests/test_validation_core.py tests/test_validation_stability.py tests/test_validation_enhanced.py tests/test_validation_pipeline.py tests/test_poisoning_scenarios.py tests/test_config.py tests/test_api_config.py -q`
  - `npx vitest run --project viewer tests/js/viewer-advanced.test.mjs tests/js/viewer-enhanced.test.mjs`
  - `npm run check:scaling`
  - `npm run check:python-contracts`

**Exit condition:** The first unstable current sample is rejected, SOG-preferred anchor behavior and the `0.5` default
are covered, R20 rejects both mismatch directions without new settings, head-to-wind remains `10`, and
`npm run check:all` is green.

### Phase 3 — Expose rule availability and add the engine-protection startup popup

**Intent:** Implement findings #17 and #18 as user-visible diagnostics, using the existing enhanced-status API rather
than inventing another polling system.

**Dependencies:** Phases 1-2.

**Deliverables:**

1. Extend each enhanced-status row with normalized `availability`:
   - detailed `active` -> `active`;
   - detailed `disabled` -> `disabled`;
   - every detailed `inactive_*` state -> `unavailable`. Keep the existing detailed `status` field unchanged for
     Settings and troubleshooting.
2. Update `viewer/enhanced-settings.js` so the primary badge vocabulary is **active**, **disabled**, or **unavailable**,
   while the existing detailed cause remains visible as supporting text/title (for example no key set, key missing, or
   stale value).
3. Add an Enhanced Rule Availability card/section to the Status tab listing every enhanced rule. It must show the
   normalized availability and enough detailed cause text to explain `unavailable` without requiring the user to infer
   it from a zero reject count.
4. Do not add another timer. When Status is active, the existing two-second heartbeat may also refresh
   `enhanced/status`; when Status is inactive no enhanced-status heartbeat request is required.
5. Add `viewer/engine-warning.js` as the isolated owner of startup engine-warning behavior and
   `viewer/engine-warning.css` as its isolated styling owner. Add both to `viewer/viewer.html` in dependency-safe order.
6. On viewer startup, perform one enhanced-status check and show the modal unless `reject_engine_on` has
   `availability === "active"`. Do not re-open it later during the same page load even if status changes.
7. Popup copy must explain the actual limitation: RPM rejects only above its configured idle ceiling, so lower readings
   cannot reliably distinguish motoring from good sailing; the user should pause recording while motoring or configure
   a definitive engine-state rule in Settings > Enhanced Rules.
8. The popup has exactly two buttons:
   - **Close**: remove the popup only.
   - **Never show again**: persist a versioned `localStorage` preference then remove the popup.
9. A stored suppression preference prevents future startup popup checks from rendering the modal. The enhanced Status
   availability card remains visible regardless of suppression.
10. Add a local-storage fake to the shared viewer harness rather than building one inside a single test. Storage failure
    behavior must be testable and visibly reported as required by Hard Constraint 16.
11. If the startup `enhanced/status` request fails, normal viewer startup continues and the connection/error behavior
    remains non-blocking; the engine warning must never prevent Polar/Status/Timeline/Export/Settings from loading.

**Tests/evidence:**

- `tests/test_enhanced_status.py`: every detailed state maps to the correct three-state availability.
- `tests/js/viewer-enhanced.test.mjs`: Settings renders normalized availability plus detailed cause.
- New `tests/js/viewer-engine-warning.test.mjs` covers:
  - warning appears when no definitive engine-state rule is active, including when RPM alone is active;
  - warning does not appear when the engine-state rule is active;
  - **Close** dismisses without writing suppression;
  - reopening a fresh harness after **Close** can show it again;
  - **Never show again** writes the versioned storage key and suppresses later page loads;
  - storage-write failure is visible and does not crash startup;
  - enhanced-status fetch failure does not block the viewer.
- Status viewer tests prove all enhanced rules render Active/Disabled/Unavailable without breaking the normal heartbeat.
- If a new viewer test file is added, run `npm run inventory:write` and commit only the canonical inventory changes that
  command requires.
- Targeted commands:
  - `python -m pytest tests/test_enhanced_status.py tests/test_api_handlers.py tests/test_plugin_integration.py -q`
  - `npx vitest run --project viewer tests/js/viewer-enhanced.test.mjs tests/js/viewer-engine-warning.test.mjs tests/js/viewer-smoke.test.mjs tests/js/viewer-render-contract.test.mjs`
  - `npm run typecheck:source`
  - `npm run check:complexity`
  - `npm run package:check`

**Exit condition:** The three-state availability is consistent in API/Settings/Status, startup warning behavior exactly
matches the two-button persistence contract, no extra timer exists, and `npm run check:all` is green.

### Phase 4 — Make `debug_logging` a structured decision-diagnostic stream

**Intent:** Implement finding #28 using the telemetry and R15 metrics already built in Phases 1-2, without creating a
new persistence subsystem.

**Dependencies:** Phases 1-3.

**Deliverables:**

1. Add one pure diagnostics formatter in `server/polarrecorder/` (prefer a dedicated `diagnostics.py` if that is the
   cleanest dependency owner). It must not import AvNav or own I/O.
2. The formatter produces one compact JSON-compatible payload per completed reader iteration with at least:
   - `timestamp_wall` and `timestamp_monotonic`;
   - core values sufficient for decision inspection: TWA degrees plus TWS/STW in knots when a normalized sample exists,
     and explicit `null` for unavailable normalized values;
   - available normalized enhanced roles from the sample (SOG, current drift, AWA, AWS, heading, COG, RPM, engine-state,
     depth, heel) without inventing absent keys/values;
   - pipeline `decision`, `reason_codes`, `failed_predicates`, and `is_sailing_candidate`;
   - R15 metrics evaluated with the same current-sample-inclusive helper used by the live rule: filled state, window
     span, TWA range, TWS range, STW range;
   - enough config context to interpret the R15/R10/R20 diagnostics if those thresholds are changed during a session (at
     minimum the stability ranges/window, anchoring threshold, R20 movement floor, and R20 ratio).
3. Replace the existing simple `debug_logging` message with exactly one prefixed compact structured line per completed
   read,
   for example `diagnostic_sample=<json>`. Do not emit an additional second per-sample line.
4. Missing/non-finite core reads must still be loggable without calling `build_sample` unsafely or serializing NaN/Inf;
   unsafe raw values are represented as `null` plus their applicable decision/predicate codes.
5. When `debug_logging` is false, no per-read diagnostic payload is formatted or logged on the hot path beyond the
   existing validation work.
6. If a new `diagnostics.py` module is introduced, add it to the canonical Python dependency layer map and add focused
   tests. Keep the module under the project line/complexity limits.

**Tests/evidence:**

- Unit tests for the formatter prove accepted, rejected, quarantined, warming-up, missing-input, enhanced-input, and
  multi-predicate cases produce deterministic finite payloads.
- Plugin integration tests prove exactly one structured debug line is emitted per completed read when enabled and none when
  disabled.
- R15 logged ranges must equal the ranges used for the live R15 decision in the same test sample.
- Runtime-contract tests must prove no NaN/Infinity reaches the diagnostic JSON payload.
- Targeted commands:
  - `python -m pytest tests/test_plugin_integration.py tests/test_validation_stability.py tests/test_validation_pipeline.py tests/test_config.py -q`
  - `npm run check:python-contracts`
  - `npm run check:scaling`

**Exit condition:** `debug_logging` yields one deterministic finite structured record per completed read with decision-relevant
values and predicates, remains zero-output when disabled, and `npm run check:all` is green.

### Phase 5 — Synchronize ROADMAP and maintained documentation

**Intent:** Implement the documentation-only outcomes for findings #6 and #22 and make every changed public contract
accurate in README/docs.

**Dependencies:** Phases 1-4.

**Deliverables:**

1. Add a `ROADMAP.md` item titled as an **Investigation** for finding #6. It must state:
   - isolated slow accepted samples can exist inside otherwise strong bins;
   - P65 is intentionally the current protection and this plan adds no second outlier reject;
   - the investigation should use multi-day/raw diagnostic evidence to determine whether these samples are sensor
     artifacts, transient sailing states, or legitimate low-performance modes before considering any filter change.
2. Add a separate `ROADMAP.md` post-MVP item for finding #22: stable-segment/block learning. It must describe the
   possible future approach without implying it is implemented or scheduled.
3. Update `README.md` for all user-visible changes: Candidates terminology, triggered predicates, current-sample R15,
   SOG-preferred anchoring, `0.5` kn default, symmetric R20, enhanced availability, startup engine warning, and
   structured debug logging.
4. Update `documentation/filters/rejection-rules.md`:
   - R10 SOG-preferred/STW-fallback semantics and `0.5` default;
   - R15 current-sample-inclusive window and diagnostic sub-predicates;
   - R20 symmetric formula while preserving current-drift fail-open behavior;
   - reason vs predicate terminology.
5. Update `documentation/filters/poisoning-resistance.md` for the improved first-bad-sample R15 behavior, symmetric
   speed-log failure detection, and the remaining engine-signal limitation.
6. Update `documentation/architecture/data-pipeline.md` for primary reason vs all predicates, current-sample stability
   evaluation, post-pipeline observation, and predicate recording.
7. Update `documentation/architecture/persistence.md` for additive global/per-bin predicate histograms and old-backup
   defaults, explicitly stating schema version remains 1.
8. Update `documentation/architecture/api.md` for `top_predicates` and enhanced-rule `availability` while documenting
   retained compatibility fields.
9. Update `documentation/architecture/ui.md` for Candidates wording, enhanced-rule Status display, startup popup and
   local browser suppression, and the no-extra-timer rule.
10. Update `documentation/user/configuration.md` for the `0.5` anchoring default/semantics and expanded `debug_logging`
    record. Explicitly retain head-to-wind at `10` degrees.
11. Do not add a new documentation page. Therefore the Table of Contents should remain structurally unchanged unless a
    doc-link checker reveals an existing link that must be repaired.

**Tests/evidence:**

- `npm run docs:check`
- `npm run check:patterns`
- `npm run check:filesize`
- Search evidence confirms no maintained doc still describes R10 as STW-only, R15 as prior-window-only, R20 as
  low-STW-only, or anchor default as `0.3`.
- Search evidence confirms all maintained configuration references still state head-to-wind default `10`.

**Exit condition:** ROADMAP contains exactly the two requested non-implementation items, all maintained public docs
match shipped behavior, documentation/file-size gates pass, and `npm run check:all` is green.

### Phase 6 — Final integration and quality gate

**Intent:** Prove the complete implementation works as one coherent data-quality system and leaves no accidental scope
expansion.

**Dependencies:** Phases 1-5.

**Deliverables:**

1. Run the full test inventory regeneration only if tests/files require it: `npm run inventory:write`.
2. Run targeted poisoning/integration suites once more after docs/fixtures settle.
3. Run the repository completion gate: `npm run check:all`.
4. Review the final diff against this plan's finding map and explicit exclusions.
5. Confirm no release notes, version bump, release archive, or unrelated roadmap/code cleanup entered the change.

**Exit condition:** `npm run check:all` exits successfully with no suppressions, skipped/focused tests, lowered floors,
packaging drift, documentation failures, or unplanned behavior changes.

## Documentation Impact

The following documentation updates are required because behavior/defaults/UI change:

| File                                            | Required synchronization                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                     | Candidate terminology; R10/R15/R20 behavior; `0.5` anchor default; predicate diagnostics; engine popup; enhanced availability; structured debug logging. |
| `ROADMAP.md`                                    | Finding #6 Investigation and finding #22 stable-segment/block-learning item only.                                                                        |
| `documentation/filters/rejection-rules.md`      | Exact R10, R15, R20 contracts; predicate-vs-reason semantics.                                                                                            |
| `documentation/filters/poisoning-resistance.md` | Data-quality consequences and remaining engine limitation.                                                                                               |
| `documentation/architecture/data-pipeline.md`   | Current-sample R15, primary decision + all predicates, state observation order.                                                                          |
| `documentation/architecture/persistence.md`     | Additive predicate histograms and old-backup behavior.                                                                                                   |
| `documentation/architecture/api.md`             | `top_predicates`, enhanced `availability`, compatibility fields.                                                                                         |
| `documentation/architecture/ui.md`              | Candidates wording, enhanced status card, popup/storage behavior, heartbeat contract.                                                                    |
| `documentation/user/configuration.md`           | `anchored_stw_threshold=0.5`, SOG/STW semantics, head-to-wind remains 10, structured `debug_logging`.                                                    |

`documentation/TABLEOFCONTENTS.md` needs no new entry because no new maintained documentation page is planned.

## Acceptance Criteria

### Behavior

- `head_to_wind_threshold` remains exactly `10` by default and its rule behavior is unchanged.
- `anchored_stw_threshold` defaults to exactly `0.5` kn in every canonical default source.
- With fresh SOG, R10 uses SOG as the anchor speed; without SOG it falls back to STW; it never evaluates both as
  independent anchor predicates for the same sample.
- R15 includes the current sample in the evaluated stability ranges without observing/committing it early.
- R15 primary reason remains `reject_unstable`, with `unstable_twa`, `unstable_tws`, and `unstable_stw` available as
  independent predicate diagnostics.
- Existing first-match primary decision/reason ordering remains unchanged across all rules.
- All triggered predicates in the reached phase are retained and recorded globally; candidate-bin predicate counts are
  recorded for rejected/quarantined candidate samples.
- Old schema-v1 backups without predicate histograms still load and restore successfully with empty new histograms.
- R20 catches both low-STW/high-SOG and high-STW/low-SOG ratio failures when current drift cannot explain the gap. It
  passes when SOG is unavailable, drift is missing/stale, or valid drift is sufficient; invalid drift cannot suppress
  rejection.
- Status uses **Candidates** terminology and does not imply missing-input reason counts are candidate counts.
- Every enhanced rule has normalized availability `active`, `disabled`, or `unavailable`, with the detailed cause still
  accessible.
- The engine popup is checked only at viewer startup, appears when no definitive engine-state rule is active, has exactly
  **Close** and **Never show again**, and browser-local suppression works across page loads.
- No engine popup preference is written to Polar Recorder runtime config or `polar.json`.
- `debug_logging=false` keeps per-read diagnostics off; `debug_logging=true` emits exactly one finite structured
  diagnostic record per completed read containing the required raw/normalized values, decision, predicates, and R15
  metrics.
- No new slow-sample filter and no segment-learning implementation are introduced.

### Tests and quality

- Python validation coverage remains at or above the checked validation floor; no coverage floor is lowered.
- Viewer/plugin JS family coverage remains above repository floors; a new warning module is measured by real tests.
- New test files, if any, are included by the canonical test inventory.
- No test is skipped, focused, xfailed, or suppressed.
- `npm run test:focus:check` passes.
- `npm run check:suppressions` passes.
- `npm run check:patterns` passes.
- `npm run check:python-contracts` passes.
- `npm run check:complexity` passes.
- `npm run check:scaling` passes.
- `npm run package:check` passes and includes any new viewer runtime files.
- `npm run docs:check` passes.
- `npm run check:all` passes as the final completion gate.

### Documentation

- README and maintained docs contain no stale `0.3` anchor default.
- README/docs explicitly retain the `10` degree head-to-wind default.
- R15 docs state that the current sample participates in stability evaluation.
- R20 docs describe bidirectional SOG/STW mismatch detection, missing/stale drift fail-open behavior, and invalid-drift
  fail-closed behavior.
- Debug logging docs describe the structured one-line diagnostic record, not the old decision-only line.
- ROADMAP contains the finding #6 Investigation and finding #22 stable-segment idea, both clearly unimplemented.

### Release impact

- No version bump, release note, release zip, or publish step is part of completion.
- Runtime packaging still includes all new viewer JS/CSS through the existing release manifest logic.

## Related

- [Project standards](../../AGENTS.md)
- [Documentation index](../../documentation/TABLEOFCONTENTS.md)
- [Core principles](../../documentation/core-principles.md)
- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Rejection rules](../../documentation/filters/rejection-rules.md)
- [Poisoning resistance](../../documentation/filters/poisoning-resistance.md)
- [Data pipeline](../../documentation/architecture/data-pipeline.md)
- [Persistence](../../documentation/architecture/persistence.md)
- [API architecture](../../documentation/architecture/api.md)
- [Viewer architecture](../../documentation/architecture/ui.md)
- [User configuration](../../documentation/user/configuration.md)
- [Roadmap](../../ROADMAP.md)
