# Data Pipeline

**Status:** Current.

## Overview

The runtime data path is `ReadResult -> Sample -> validation pipeline -> model dispatch`.
Plugin integration then updates model bins, counters, timeline state, persistence, and
AvNav-visible status.

## Key Details

The reader produces `ReadResult`, which may contain missing raw values. The pipeline owns
R1 and R2 against that raw object so it can preserve granular non-finite and missing-value
reason codes. If R1 or R2 rejects, the runner returns a rejected `PipelineResult` and
`Sample` is `None`.

After R1 and R2 pass, the runner calls `build_sample(read_result)`. The resulting `Sample`
has non-optional float fields, TWS/STW converted to knots, TWA normalized for model use, and
freshness ages computed from the store timestamps. R3 through R22 operate on that `Sample`.

The candidacy gate consists of R1 through R10, the R15 warming-up carve-out, and the
pre-candidate enhanced rejects R17 through R19. These outcomes mean the pipeline cannot make a
usable sailing-quality assessment, so `is_sailing_candidate` is false. Quality-gate outcomes are
accepted samples, R11 through R14 rejections, R15 `reject_unstable`, R16 quarantine, and the
enhanced quality-gate rejects R20 through R22; these set `is_sailing_candidate` true.

`ValidationState.observe(sample)` is maintenance, not rule execution. The runner never calls
it. Plugin integration calls it once per built sample after the pipeline returns, or after
direct `build_sample` use during pause/disabled loops. This ordering keeps R11 through R13
reading the previous sample, lets R15 evaluate only the prior buffer, and lets the UI warming
flag call `state.is_warming_up(now)` against the same buffer R15 just judged.

Model dispatch consumes `(PipelineResult, Sample | None)`. Accepted samples enter the
histogram. Quality-gate rejections and quarantines update per-bin diagnostics. Candidacy-gate
rejections and `reject_warming_up` do not touch the model.

Optional signal hooks read a bounded set of configured store keys alongside the three core
keys. When a `Config` is supplied, `StoreReader` reads each enabled, configured optional key
via `getSingleValue`, coerces it through `reader._coerce_float` (bool -> `0.0`/`1.0`, numbers
pass through, numeric strings parse, non-numeric/non-finite values are omitted and
debug-logged), drops any reading older than `stale_threshold`, and carries the survivors in
`ReadResult.enhanced_raw` (store units + timestamp). `build_sample` converts each role to its
canonical unit once (`units.py`) and stores it in `Sample.enhanced`; absent or stale roles are
omitted, and `Sample.enhanced` is `None` when nothing was read. Enhanced rules read only from
`Sample.enhanced` (and `Config`), return `RuleResult`, and keep the same no-AvNav, no-I/O,
no-threading purity as the core rules. The role/unit table lives in
[AvNav keys and units](../avnav/keys-and-units.md).

Implemented enhanced rules and candidacy:

- Pre-candidate (`is_sailing_candidate=False`), appended after `anchored_heuristic`:
  R17 `reject_engine_rpm` (`rpm > enh_rpm_idle_max`), R18 `reject_engine_on`
  (`engine_signal >= enh_engine_state_on_threshold`), R19 `reject_shallow`
  (`depth_m < enh_depth_floor_m`). Motoring and shallow-water squat are non-representative
  conditions, treated like `reject_head_to_wind`.
- Quality-gate (`is_sailing_candidate=True`), inserted into `_run_candidate_rules` after
  `stability_window` and before `engine_heuristic` (so they win over the R16 quarantine):
  R20 `reject_sog_stw_mismatch` (STW implausibly low versus SOG, with a present current drift
  too small to explain the gap: `stw_kt < sog_kt * enh_slip_ratio` and
  `current_drift_kt < sog_kt - stw_kt`), R21 `reject_true_wind_crosscheck` (true wind
  recomputed from `awa_deg`/`aws_kt`/STW disagrees with reports beyond the configured TWA/TWS
  tolerances), R22 `reject_heel_out_of_band` (`abs(heel_deg)` outside `[min, max]`).
- R16 enhancement: `engine_heuristic` defers to a definitive engine signal — suppressed when
  the signal reads off, unchanged in the idle band and when no signal is present. Engine-on is
  already an R17/R18 pre-candidate reject.
- R11/R14 enhancement (turn confirmation): `WindowEntry` carries optional `heading_deg`/`cog_deg`
  from `Sample.enhanced`. When turn confirmation is enabled and a prior+current heading and/or
  COG is available, `twa_rate_of_change` treats a high TWA rate with steady heading/COG (the
  maximum available rate below `enh_turn_min_roc`) as a wind shift: it passes and sets no
  cooldown. It requires heading or COG in `enhanced`; without either, R11/R14 are unchanged.

Each enhanced rule passes when its signal is absent, so a boat that does not publish a given
key keeps the exact pre-enhanced behavior for that rule.

## Related

- [Rejection rules](../filters/rejection-rules.md)
- [Polar model](polar-model.md)
- [AvNav keys and units](../avnav/keys-and-units.md)
