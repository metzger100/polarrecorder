# Configuration

**Status:** Current.

## Overview

Polar Recorder uses AvNav editable parameters for persistent runtime configuration. Values are
registered by `plugin.py` from `polarrecorder.params.EDITABLE_PARAMETERS`, stored by AvNav as
strings, and parsed into the runtime `Config` object by `polarrecorder.config`.

## Key Details

`plugin.py` registers editable settings with `api.registerEditableParameters(paramList,
changeCallback)` during construction. AvNav stores the generated worker parameters and calls the
change callback with a dictionary of changed values when a user edits settings.

Each editable parameter dict includes `name` and may include `default`, `type`, `rangeOrList`, and
`description`. AvNav supports the `STRING`, `NUMBER`, `FLOAT`, `BOOLEAN`, and `SELECT` parameter
types used by Polar Recorder. `rangeOrList` supplies numeric min/max bounds for `NUMBER` and
`FLOAT`, or allowed values for `SELECT`.

AvNav persists plugin configuration outside `polar.json`. Polar Recorder reads initial values with
`api.getConfigValue(name, default)` for every registered parameter, using the string defaults from
`polarrecorder.params`. It does not load active runtime configuration from the learned-polar
persistence file; the persistence `config` block is metadata about the saved dataset.

AvNav stores and forwards editable values as strings. Polar Recorder follows AvNav's boolean
convention: a boolean string is true when `value.strip().upper() == "TRUE"` and false otherwise.
Numeric settings are parsed as `int` or `float`, clamped to the registered `rangeOrList`, and invalid
values fall back to the previous value or default.

AvNav's built-in plugin enable switch is named `enabled`. Polar Recorder does not register or use
that name because AvNav reserves it for the coarse plugin start/stop control. The plugin-owned
recording switch is `record_enabled`; when it is false, the sampler keeps running and warming
validation state, but no samples are committed to the learned polar.

| Name | Type | Default | Range | Behavior |
|---|---:|---:|---:|---|
| `record_enabled` | BOOLEAN | `true` | - | Persistent recording switch. `false` records `reject_disabled` diagnostics while keeping the loop alive. |
| `sample_interval` | FLOAT | `1.0` | 0.5-5.0 | Seconds between store reads after NMEA queue wakeups. |
| `percentile` | NUMBER | `65` | 1-99 | Percentile used when extracting learned speed from each histogram. |
| `flush_interval` | NUMBER | `300` | 60-3600 | Seconds between periodic `polar.json` flushes. |
| `stale_threshold` | FLOAT | `3.0` | 1.0-30.0 | Maximum monotonic age for each store value before R3 rejects it as stale. |
| `age_skew_threshold` | FLOAT | `2.0` | 0.5-10.0 | Maximum timestamp spread between TWA, TWS, and STW before R4 rejects. |
| `max_tws` | NUMBER | `60` | 20-60 | Maximum plausible true wind speed in knots for R6. Capped at the bin-grid ceiling. |
| `max_stw` | NUMBER | `40` | 10-80 | Maximum plausible speed through water in knots for R7. |
| `low_wind_threshold` | FLOAT | `3.0` | 0.5-10.0 | TWS below this threshold is rejected by R9. |
| `head_to_wind_threshold` | NUMBER | `10` | 5-30 | Absolute TWA below this threshold is rejected by R8. |
| `anchored_stw_threshold` | FLOAT | `0.3` | 0.1-1.0 | STW below this value with nonzero wind is rejected by R10. |
| `twa_roc_threshold` | FLOAT | `15.0` | 5.0-45.0 | Maximum TWA change in degrees per second before R11 detects a maneuver. |
| `tws_roc_threshold` | FLOAT | `10.0` | 3.0-30.0 | Maximum TWS change in knots per second before R12 rejects a spike. |
| `stw_roc_threshold` | FLOAT | `2.0` | 0.5-10.0 | Maximum STW acceleration in knots per second before R13 rejects. |
| `cooldown_seconds` | NUMBER | `30` | 5-120 | Time R14 rejects after a TWA maneuver detection. |
| `stability_window_seconds` | NUMBER | `15` | 5-60 | Time span of stable prior samples required by R15. |
| `stability_twa_range` | FLOAT | `20.0` | 5.0-45.0 | Maximum TWA range in the stability window. |
| `stability_tws_range` | FLOAT | `10.0` | 3.0-20.0 | Maximum TWS range in the stability window. |
| `stability_stw_range` | FLOAT | `4.0` | 1.0-10.0 | Maximum STW range in the stability window. |
| `engine_tws_ceil` | FLOAT | `5.0` | 2.0-15.0 | TWS ceiling for the R16 engine-suspected quarantine. |
| `engine_stw_floor` | FLOAT | `3.0` | 1.0-10.0 | STW floor for the R16 engine-suspected quarantine. |
| `min_samples_for_export` | NUMBER | `10` | 3-100 | High-confidence export floor used when that export mode is requested. |
| `debug_logging` | BOOLEAN | `false` | - | Enables one debug log line per pipeline iteration with decision and reason codes. |

### Enhanced (optional-signal) rule settings

Polar Recorder also reads optional boat signals beyond the three core signals (TWA/TWS/STW) and
uses them to reject samples those signals prove unrepresentative. Each rule fires only when its
switch is on, its store key(s) are configured, and the value is present and fresh; otherwise the
rule is a no-op (fail-open per signal). Every switch defaults on.

The depth, SOG, current-drift, apparent-wind, heading, and COG keys default to standard AvNav store
keys, so those rules (R19 shallow, R20 SOG/STW paddlewheel, R21 true-wind cross-check, and the
heading/COG turn confirmation) **activate automatically on upgrade** for any boat that already
publishes those keys. To opt out, toggle the rule off or clear its key in the Settings tab's
Enhanced Rules section. The genuinely custom signals (`enh_rpm_key`, `enh_engine_state_key`,
`enh_heel_key`) default to empty and stay inactive until you map a key, because AvNav core has no
standard key for them.

| Name | Type | Default | Range | Behavior |
|---|---:|---:|---:|---|
| `enh_rpm_enabled` | BOOLEAN | `true` | - | Enable the engine-RPM reject (R17). |
| `enh_rpm_key` | STRING | `""` | - | Store key for engine RPM. |
| `enh_rpm_idle_max` | NUMBER | `900` | 200-4000 | RPM above this rejects the sample as motoring. |
| `enh_engine_state_enabled` | BOOLEAN | `true` | - | Enable the engine-state reject (R18). |
| `enh_engine_state_key` | STRING | `""` | - | Store key for engine state (boolean, RPM, or alternator voltage). |
| `enh_engine_state_on_threshold` | FLOAT | `0.5` | 0.0-10000.0 | `engine_signal` at/above this means engine on (boolean 0.5, RPM ~50, voltage ~13.2). |
| `enh_depth_enabled` | BOOLEAN | `true` | - | Enable the shallow-water reject (R19). |
| `enh_depth_key` | STRING | `"gps.depthBelowKeel"` | - | Store key for depth in meters (keel clearance). |
| `enh_depth_floor_m` | FLOAT | `1.0` | 0.5-50.0 | Clearance below this rejects the sample (shallow-water squat). |
| `enh_slip_enabled` | BOOLEAN | `true` | - | Enable the STW-implausibly-low reject (R20). |
| `enh_sog_key` | STRING | `"gps.speed"` | - | Store key for speed over ground. |
| `enh_current_drift_key` | STRING | `"gps.currentDrift"` | - | Store key for current drift; corroborates R20. |
| `enh_slip_sog_floor_kt` | FLOAT | `1.0` | 0.3-10.0 | SOG must exceed this for R20 to apply. |
| `enh_slip_ratio` | FLOAT | `0.5` | 0.1-0.9 | Reject when STW < SOG * ratio and current cannot explain the gap. |
| `enh_tw_crosscheck_enabled` | BOOLEAN | `true` | - | Enable the true-wind cross-check reject (R21). |
| `enh_awa_key` | STRING | `"gps.windAngle"` | - | Store key for apparent wind angle. |
| `enh_aws_key` | STRING | `"gps.windSpeed"` | - | Store key for apparent wind speed. |
| `enh_tw_twa_tol_deg` | FLOAT | `15.0` | 3.0-45.0 | Allowed TWA disagreement for the cross-check. |
| `enh_tw_tws_tol_kt` | FLOAT | `3.0` | 0.5-15.0 | Allowed TWS disagreement for the cross-check. |
| `enh_heel_enabled` | BOOLEAN | `true` | - | Enable the heel-band reject (R22). |
| `enh_heel_key` | STRING | `""` | - | Store key for heel/roll in degrees. |
| `enh_heel_min_deg` | FLOAT | `0.0` | 0.0-45.0 | Reject below this absolute heel (0 disables it, multihull-safe). |
| `enh_heel_max_deg` | FLOAT | `35.0` | 5.0-90.0 | Reject above this absolute heel. |
| `enh_turnconfirm_enabled` | BOOLEAN | `true` | - | Enable heading/COG turn confirmation for R11/R14. |
| `enh_heading_key` | STRING | `"gps.headingTrue"` | - | Store key for heading. |
| `enh_cog_key` | STRING | `"gps.track"` | - | Store key for course over ground. |
| `enh_turn_min_roc` | FLOAT | `3.0` | 0.5-30.0 | Heading/COG deg/s at/above which a TWA spike is treated as a real turn. |

Config changes are hot-swapped. AvNav calls the registered change callback with changed string
values; `plugin.py` acquires its single lock, parses and clamps the new values, and replaces the
`Config` object. The sampling loop snapshots the current config once per iteration, so a change
takes effect on the next sample cycle rather than halfway through a read/validate/update sequence.

Validation state is not reset on config changes. The rolling stability window, cooldown timer, and
previous sample continue from their current contents. If `stability_window_seconds` is increased,
R15 naturally warms up until the retained buffer spans the new window; if it is decreased, older
entries simply fall outside the new window.

Known limitation: keep `cooldown_seconds >= stability_window_seconds` if you want the post-maneuver
stability guarantee. The plugin does not cross-validate these two settings. If cooldown is shorter
than the stability window, the first accepted sample after a maneuver can still have maneuver-era
values inside its stability window.

## Related

- [Plugin lifecycle](../architecture/plugin-lifecycle.md)
- [API shape](../architecture/api.md)
- [Data pipeline](../architecture/data-pipeline.md)
