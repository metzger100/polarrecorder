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
freshness ages computed from the store timestamps. R3 through R16 operate on that `Sample`.

The candidacy gate consists of R1 through R10 plus the R15 warming-up carve-out. These
outcomes mean the pipeline cannot make a usable sailing-quality assessment, so
`is_sailing_candidate` is false. Quality-gate outcomes are accepted samples, R11 through R14
rejections, R15 `reject_unstable`, and R16 quarantine; these set `is_sailing_candidate` true.

`ValidationState.observe(sample)` is maintenance, not rule execution. The runner never calls
it. Plugin integration calls it once per built sample after the pipeline returns, or after
direct `build_sample` use during pause/disabled loops. This ordering keeps R11 through R13
reading the previous sample, lets R15 evaluate only the prior buffer, and lets the UI warming
flag call `state.is_warming_up(now)` against the same buffer R15 just judged.

Model dispatch consumes `(PipelineResult, Sample | None)`. Accepted samples enter the
histogram. Quality-gate rejections and quarantines update per-bin diagnostics. Candidacy-gate
rejections and `reject_warming_up` do not touch the model.

Optional signal rules will be added through `rules_enhanced.py` after the MVP core rules.
They should read optional values from `Sample.enhanced`, return `RuleResult`, and keep the
same no-AvNav, no-I/O, no-threading purity as the core rules.

Worked enhanced sketches:

- RPM reject: if `sample.enhanced["rpm"]` exists and exceeds a configured idle threshold,
  return `reject_engine_rpm`; otherwise pass. This turns suspected engine use into a direct
  reject when the signal exists.
- Depth reject: if `sample.enhanced["depth_m"]` exists and is below a configured shallow
  floor, return `reject_shallow`; otherwise pass. This covers shallow-water squat without
  guessing from STW.
- SOG/STW mismatch: if enhanced SOG exists and `abs(sog_kt - sample.stw_kt)` exceeds a
  configured slip threshold, return `reject_sog_stw_mismatch`; otherwise pass. This is the
  future current/sensor-mismatch hook.
- AWA/AWS cross-check: if enhanced apparent wind angle and speed exist, recompute an
  expected true-wind vector from AWA/AWS and STW, compare it with reported TWA/TWS, and
  return `reject_true_wind_crosscheck` when the difference exceeds configured tolerances.

## Related

- [Rejection rules](../filters/rejection-rules.md)
- [Polar model](polar-model.md)
- [AvNav keys and units](../avnav/keys-and-units.md)
