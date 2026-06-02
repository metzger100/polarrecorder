# Rejection Rules

**Status:** Current.

## Overview

The validation pipeline classifies each core TWA/TWS/STW read as accepted, rejected, or
quarantined. R1 and R2 run before `Sample` construction. R3 through R16 run on a built
`Sample`, with R11 through R15 reading `ValidationState`.

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
| R16 | `engine_heuristic` | quarantine | `quarantine_engine_suspected` | TWS `< engine_tws_ceil`, default 5 kt, and STW `> engine_stw_floor`, default 3 kt. | P-TWA/TWS/STW |

R1, R2, and R3 report every offending core value in one result. R4 through R16 emit one
reason code. Individual rules return `pass`, `reject`, or `quarantine`; only the runner
emits the final `accepted` decision.

R11 through R13 use the actual elapsed monotonic time since `state.previous_sample`. If
there is no previous sample, or elapsed time is zero or negative, no rate is computable and
the rule passes.

R15 evaluates the rolling buffer before the current sample is appended. A warming-up result
is not a sailing candidate; `reject_unstable` is a quality-gate rejection and is a sailing
candidate.

Two pre-pipeline reason codes are emitted by plugin integration: `reject_user_paused`
and `reject_disabled`. They are not emitted by the pure validation runner.

## Related

- [Data pipeline](../architecture/data-pipeline.md)
- [Configuration](../user/configuration.md)
- [Polar model](../architecture/polar-model.md)
