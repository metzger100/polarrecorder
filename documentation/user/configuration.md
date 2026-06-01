# Configuration

**Status:** Current for version 1.0.0.

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
