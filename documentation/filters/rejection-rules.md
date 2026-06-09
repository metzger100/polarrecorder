# Rejection Rules

**Status:** Current.

## Overview

The validation pipeline classifies each core TWA/TWS/STW read as accepted, rejected, or
quarantined. R1 and R2 run before `Sample` construction. R3 through R22 run on a built
`Sample`, with R11 through R15 reading `ValidationState`. R17 through R22 are optional
enhanced rules that read additional signals from `Sample.enhanced`.

## Key Details

| Rule | Function | Decision | Reason code(s) | Threshold or condition | Detectability |
|---|---|---|---|---|---|
| R1 | `finite_values` | reject | `reject_non_finite_twa`, `reject_non_finite_tws`, `reject_non_finite_stw` | Non-None raw values must be numeric and finite. | D-TWA/TWS/STW |
| R2 | `required_keys` | reject | `reject_missing_twa`, `reject_missing_tws`, `reject_missing_stw` | All three raw core values must be present. | D-TWA/TWS/STW |
| R3 | `stale_values` | reject | `reject_stale_twa`, `reject_stale_tws`, `reject_stale_stw` | Each value age must be `<= stale_threshold`, default 3.0 s. | D-TWA/TWS/STW |
| R4 | `age_skew` | reject | `reject_age_skew` | Core timestamp age skew must be `< age_skew_threshold`, default 2.0 s. | D-TWA/TWS/STW |
| R5 | `twa_range` | reject | `reject_twa_range` | Raw TWA must be from 0 to 360 deg inclusive. | D-TWA/TWS/STW |
| R6 | `tws_range` | reject | `reject_tws_range` | TWS must be from 0 to `max_tws`, default 60 kt. | D-TWA/TWS/STW |
| R7 | `stw_range` | reject | `reject_stw_range` | STW must be from 0 to `max_stw`, default 40 kt. | D-TWA/TWS/STW |
| R8 | `head_to_wind` | reject | `reject_head_to_wind` | Absolute TWA must be `>= head_to_wind_threshold`, default 10 deg. | D-TWA/TWS/STW |
| R9 | `low_wind` | reject | `reject_low_wind` | TWS must be `>= low_wind_threshold`, default 3 kt. | P-TWA/TWS/STW |
| R10 | `anchored_heuristic` | reject | `reject_anchored` | STW `< anchored_stw_threshold`, default 0.3 kt, and TWS `> 0`. | P-TWA/TWS/STW |
| R11 | `twa_rate_of_change` | reject | `reject_twa_roc` | Circular TWA rate must be `<= twa_roc_threshold`, default 15 deg/s. | D-TWA/TWS/STW |
| R12 | `tws_rate_of_change` | reject | `reject_tws_roc` | TWS rate must be `<= tws_roc_threshold`, default 10 kt/s. | D-TWA/TWS/STW |
| R13 | `stw_acceleration` | reject | `reject_stw_roc` | STW rate must be `<= stw_roc_threshold`, default 2 kt/s. | D-TWA/TWS/STW |
| R14 | `maneuver_cooldown` | reject | `reject_maneuver_cooldown` | Current monotonic time must be after `cooldown_expires`. | D-TWA/TWS/STW |
| R15 | `stability_window` | reject | `reject_warming_up`, `reject_unstable` | Prior buffer must span `stability_window_seconds`, default 15 s; filled ranges must stay below TWA 20 deg, TWS 10 kt, STW 4 kt defaults. | P-TWA/TWS/STW |
| R16 | `engine_heuristic` | quarantine | `quarantine_engine_suspected` | TWS `< engine_tws_ceil`, default 5 kt, and STW `> engine_stw_floor`, default 3 kt. Suppressed when a definitive engine signal reads off (see below). | P-TWA/TWS/STW |
| R17 | `reject_engine_rpm` | reject | `reject_engine_rpm` | Optional `rpm > enh_rpm_idle_max`, default 900. Pre-candidate (motoring). | Enhanced: RPM |
| R18 | `reject_engine_on` | reject | `reject_engine_on` | Optional `engine_signal >= enh_engine_state_on_threshold`, default 0.5. Pre-candidate (motoring). | Enhanced: engine state |
| R19 | `reject_shallow` | reject | `reject_shallow` | Optional `depth_m < enh_depth_floor_m`, default 1.0 m. Pre-candidate (shallow-water squat). | Enhanced: depth |
| R20 | `reject_sog_stw_mismatch` | reject | `reject_sog_stw_mismatch` | Optional `sog_kt > enh_slip_sog_floor_kt` and `stw_kt < sog_kt * enh_slip_ratio` and `current_drift_kt < sog_kt - stw_kt`. Quality-gate (paddlewheel failure). | Enhanced: SOG + current drift |
| R21 | `reject_true_wind_crosscheck` | reject | `reject_true_wind_crosscheck` | Optional: true wind recomputed from `awa_deg`/`aws_kt`/STW disagrees with reports beyond `enh_tw_twa_tol_deg` (15) or `enh_tw_tws_tol_kt` (3). Quality-gate (wind sensor/calibration). | Enhanced: AWA + AWS |
| R22 | `reject_heel_out_of_band` | reject | `reject_heel_out_of_band` | Optional `abs(heel_deg) > enh_heel_max_deg` (35) or `< enh_heel_min_deg` (0, off by default). Quality-gate (over/underpowered). | Enhanced: heel |

R1, R2, and R3 report every offending core value in one result. R4 through R22 emit one
reason code. Individual rules return `pass`, `reject`, or `quarantine`; only the runner
emits the final `accepted` decision.

Enhanced rules (R17-R22) are optional. Each fires only when its rule is enabled, its store
key(s) are configured, and a fresh value is present in `Sample.enhanced`; an absent or stale
signal leaves the rule a no-op (`pass`). R17-R19 are pre-candidate
(`is_sailing_candidate=False`, counted via `record_non_candidate`) because motoring and
shallow-water squat are non-representative conditions, like `reject_head_to_wind`. R20-R22 are
quality-gate rejects (`is_sailing_candidate=True`, counted via `record_rejected`): the boat was
sailing in a clean condition but the specific sample or sensor is unrepresentative. R20-R22 run
in `_run_candidate_rules` after `stability_window` and before R16, so a definitive enhanced
reject wins over the R16 quarantine.

R16 enhancement: when a definitive engine signal is configured, R16 defers to it. Engine-on is
already a pre-candidate R17/R18 reject and never reaches R16. When the signal reads **off**
(`engine_signal < enh_engine_state_on_threshold`, or `rpm <= RPM_OFF_CEILING`, a named
stopped-engine constant of 50 rpm) the R16 quarantine is suppressed. A present-but-idling RPM in
the band `RPM_OFF_CEILING < rpm <= enh_rpm_idle_max` does **not** settle the motoring question,
so R16's low-wind/moving heuristic still applies there. With no engine signal, R16 is unchanged.

R11/R14 enhancement (turn confirmation): when `enh_turnconfirm_enabled` and a prior+current
heading and/or COG (`enh_heading_key`/`enh_cog_key`) is available, R11 computes each available
signal's circular rate and concludes "not turning" only when the **maximum** of the available
rates is below `enh_turn_min_roc` (default 3 deg/s). A high TWA rate while not turning is treated
as a wind shift: R11 passes and starts no cooldown, so R14 does not reject the following samples.
A single available signal at/above the threshold is treated as a real turn (reject + cooldown, as
before), so a swinging COG over a steady heading fails safe toward the original R11. With no
heading or COG available, R11/R14 behave exactly as before.

R11 through R13 use the actual elapsed monotonic time since `state.previous_sample`. If
there is no previous sample, or elapsed time is zero or negative, no rate is computable and
the rule passes.

R15 evaluates the rolling buffer before the current sample is appended. A warming-up result
is not a sailing candidate; `reject_unstable` is a quality-gate rejection and is a sailing
candidate.

The rolling buffer keeps one boundary anchor sample just outside the active window when a newer
sample is present. This lets normal sampling jitter, such as a one-second loop running slightly
late, prove that the prior data spans the configured window while still resetting warm-up after a
gap longer than the window.

One pre-pipeline reason code is emitted by plugin integration: `reject_user_paused`. It is not
emitted by the pure validation runner.

## Related

- [Data pipeline](../architecture/data-pipeline.md)
- [Configuration](../user/configuration.md)
- [Polar model](../architecture/polar-model.md)
