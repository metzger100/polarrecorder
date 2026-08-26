# Data Pipeline

**Status:** Current.

## Overview

The runtime data path is `ReadResult -> Sample -> validation pipeline -> model dispatch`. Plugin integration then
updates model bins, counters, timeline state, persistence, and AvNav-visible status.

## Key Details

The reader produces `ReadResult`, whose raw core values and source timestamps are untrusted objects and may be missing,
nonnumeric, boolean, non-finite, or too large to convert safely. One total timestamp coercer accepts only finite numeric
timestamps (not booleans or strings) before freshness arithmetic. A shared classifier permits at most 0.5 seconds of
future skew, matching the lowest supported sampling cadence; larger offsets fail freshness. Invalid core timestamps
reject in R1/R2, implausibly future core timestamps reject in R3, and invalid or future enhanced timestamps make that
optional acquisition unusable. If R1 or R2 rejects, the runner returns a rejected `PipelineResult` and `Sample` is
`None`.

After R1 and R2 pass, the runner calls `build_sample(read_result)`. The resulting `Sample` has non-optional float
fields, TWS/STW converted to knots, TWA normalized for model use, and freshness ages computed from the store timestamps.
R3 through R22 operate on that `Sample`.

The candidacy gate consists of R1 through R10, the R15 warming-up carve-out, and the pre-candidate enhanced rejects R17
through R19. These outcomes mean the pipeline cannot make a usable sailing-quality assessment, so `is_sailing_candidate`
is false. Quality-gate outcomes are accepted samples, R11 through R14 rejections, R15 `reject_unstable`, R16 quarantine,
and the enhanced quality-gate rejects R20 through R22; these set `is_sailing_candidate` true.

Validation-state observation is maintenance, not rule execution. The runner never calls it. Plugin integration retains
each built numeric sample separately as the previous observation for R11-R13, but appends it to R15 history only after
the pre-candidate gates pass. Missing, malformed, stale, out-of-range, head-to-wind, low-wind, anchored, motoring, and
shallow observations break R15 continuity. Pausing or resuming also clears R15 history, so recovery always requires a
fresh stability warm-up. Accepted samples, R11-R14 failures, and R15 warm-up/instability retain history. R16 quarantine
and R20-R22 sensor-quality failures clear it so a bad episode cannot pre-prove stability for its recovery sample. This
history policy examines every triggered predicate, independently of which earlier rule supplies the public primary
reason.

R15 evaluation is pure over a retained-state snapshot plus the current sample. The deeply immutable evaluation used for
the decision is carried on `PipelineResult`; structured debug formatting serializes that object and never prunes,
reconfigures, or otherwise mutates live validation state. Its observation-density floor uses the configured sample
interval with a bounded 10% scheduler-slippage allowance, while the separate three-interval maximum-gap rule still
rejects sparse history. Diagnostic records also retain JSON-safe raw core scalar values, core source timestamps/ages,
enhanced raw/normalized values with timestamps/ages, acquisition states, invalid causes, and a record schema. Schema 5
preserves strings and booleans as actually received while replacing unsupported or non-finite objects with `null`; it
also includes R15's largest observed gap, allowed gap, observed/required sample counts, and the active sample interval,
making the recorded decision inspectable. Diagnostic emission follows canonical state, model, counter, timeline, and
status accounting, so logging cannot change the recorded decision. One record is emitted for each completed store read,
including a read discarded after a configuration change. A reader exception that produces no `ReadResult` is reported
through the normal AvNav loop error path instead. These are structured decision diagnostics, not a promise of literal
full-pipeline replay across arbitrary configuration changes.

Model dispatch consumes `(PipelineResult, Sample | None)`. Accepted samples enter the histogram. Quality-gate rejections
and quarantines update per-bin diagnostics. Candidacy-gate rejections and `reject_warming_up` do not touch the model.
The primary reason remains the first decisive rule; `failed_predicates` retains all same-phase evidence in rule order
and is recorded in global and per-bin diagnostic histograms.

Optional signal hooks read a bounded set of configured store keys alongside the three core keys. Configured SOG is
always acquired because R10 consumes it independently of R20; current drift remains conditional on R20. When a `Config`
is supplied, `StoreReader` reads each applicable configured optional key through its store protocol and classifies it
through the canonical `enhanced_input.assess_enhanced_input` contract as missing, stale, invalid, or usable. That
contract parses finite values and finite numeric timestamps, converts speed roles to knots, rejects conversion overflow,
applies the bounded future-skew policy and role-specific lower and upper physical bounds, and is shared by the live
enhanced-status endpoint. RPM, engine-state numeric values, depth, SOG, current-drift magnitude, and AWS reject negative
values; AWA and heel remain signed. Boolean values are accepted only for the `engine_signal` role. Numeric strings are
accepted as signal values but never as timestamps. `ReadResult.enhanced_inputs` retains every acquisition state for
diagnostics, while `ReadResult.enhanced_values` contains only usable canonical values with timestamps. `build_sample`
copies those already-normalized values into `Sample.enhanced`; absent, stale, and invalid roles are omitted, while
invalid role identity is retained separately so corrupt evidence cannot masquerade as an unavailable optional source.
Enhanced rules read only from the built `Sample` (and `Config`), return `RuleResult`, and keep the same no-AvNav,
no-I/O, no-threading purity as the core rules. The role/unit table lives in
[AvNav keys and units](../avnav/keys-and-units.md).

Implemented enhanced rules and candidacy:

- Pre-candidate (`is_sailing_candidate=False`), appended after `anchored_heuristic`: R17 `reject_engine_rpm`
  (`rpm > enh_rpm_idle_max`), R18 `reject_engine_on` (`engine_signal >= enh_engine_state_on_threshold`), R19
  `reject_shallow` (`depth_m < enh_depth_floor_m`). Motoring and shallow-water squat are non-representative conditions,
  treated like `reject_head_to_wind`.
- Quality-gate (`is_sailing_candidate=True`), inserted into `_run_candidate_rules` after `stability_window` and before
  `engine_heuristic` (so they win over the R16 quarantine): R20 `reject_sog_stw_mismatch` (the slower of SOG/STW is
  below the configured ratio of the faster and present current drift is too small to explain their gap), R21
  `reject_true_wind_crosscheck` (true wind recomputed from `awa_deg`/`aws_kt`/STW disagrees with reports beyond the
  configured TWA/TWS tolerances), R22 `reject_heel_out_of_band` (`abs(heel_deg)` outside `[min, max]`).
- R16 enhancement: `engine_heuristic` is suppressed when a configured engine-state signal reads off or RPM is at the
  stopped-engine ceiling. RPM in the idle band remains ambiguous, so the heuristic still runs there. Engine-on above the
  configured RPM/state threshold is already an R17/R18 pre-candidate reject.
- R11/R14 enhancement (turn confirmation): `WindowEntry` carries optional `heading_deg`/`cog_deg` from
  `Sample.enhanced`. When turn confirmation is enabled and a prior+current heading and/or COG is available,
  `twa_rate_of_change` treats a high TWA rate with steady heading/COG (the maximum available rate below
  `enh_turn_min_roc`) as a wind shift: it passes and sets no cooldown. It requires heading or COG in `enhanced`; without
  either, R11/R14 are unchanged.

Each enhanced rule passes when its signal is genuinely absent, so a boat that does not publish a given key keeps the
pre-enhanced behavior for that rule. R20 is the deliberate invalid-data exception: an invalid configured current-drift
source cannot explain away a SOG/STW mismatch, while a missing or stale drift source remains fail-open.

## Related

- [Rejection rules](../filters/rejection-rules.md)
- [Polar model](polar-model.md)
- [AvNav keys and units](../avnav/keys-and-units.md)
