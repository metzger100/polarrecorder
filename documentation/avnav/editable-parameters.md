# AvNav Editable Parameters

**Status:** Current | Host editable-parameter contract and Polar Recorder mapping.

## Overview

AvNav editable parameters are the persistent runtime settings exposed for a plugin. Polar Recorder registers 50 parameters and parses AvNav's string values into a typed `Config`.

## Key Details

AvNav plugin editable-parameter contract:

- Plugins register editable settings with `api.registerEditableParameters(paramList, changeCallback)`.
- Each item in `paramList` is a dictionary.
- `name` is mandatory and is the persisted configuration key.
- `default`, `type`, `rangeOrList`, `description`, and `condition` are optional host-facing metadata.
- Supported Polar Recorder types are `BOOLEAN`, `NUMBER`, `FLOAT`, and `STRING` (store-key fields).
- AvNav stores and forwards configuration values as strings.
- When a user changes values, AvNav calls the registered callback with only the changed key/value pairs.
- The plugin must validate and start using new values before saving them as durable configuration.

Polar Recorder registration and parsing:

| Concern | Owner |
|---|---|
| Editable parameter specs | `server/polarrecorder/params.py` |
| Runtime typed config | `server/polarrecorder/config.py` |
| Initial value read | `plugin.py` via `api.getConfigValue(name, default)` |
| Hot-change callback | `plugin.py` parses changed strings while holding its lock |
| User-facing setting reference | [Configuration](../user/configuration.md) |

Parsing rules:

- `BOOLEAN` is true only when the stripped upper-case string is `TRUE`.
- `NUMBER` values parse as integers and are clamped to `rangeOrList`.
- `FLOAT` values parse as floats and are clamped to `rangeOrList`.
- `STRING` values pass through unchanged; they hold optional store keys for the enhanced rules.
- Invalid changed values keep the previous runtime value; invalid initial values fall back to defaults.
- `record_enabled` is plugin-owned and distinct from AvNav's built-in enable/disable switch.
- `polar.json` stores learned-model metadata, not active AvNav editable settings.

Polar Recorder registers exactly these 50 parameter names:

| Group | Parameters |
|---|---|
| Recording and persistence | `record_enabled`, `sample_interval`, `flush_interval`, `debug_logging` |
| Model/export | `percentile`, `max_tws`, `max_stw`, `min_samples_for_export` |
| Freshness and candidacy gate | `stale_threshold`, `age_skew_threshold`, `low_wind_threshold`, `head_to_wind_threshold`, `anchored_stw_threshold` |
| Rate/cooldown stability gate | `twa_roc_threshold`, `tws_roc_threshold`, `stw_roc_threshold`, `cooldown_seconds`, `stability_window_seconds`, `stability_twa_range`, `stability_tws_range`, `stability_stw_range` |
| Quarantine heuristic | `engine_tws_ceil`, `engine_stw_floor` |
| Enhanced engine (R17/R18) | `enh_rpm_enabled`, `enh_rpm_key`, `enh_rpm_idle_max`, `enh_engine_state_enabled`, `enh_engine_state_key`, `enh_engine_state_on_threshold` |
| Enhanced depth (R19) | `enh_depth_enabled`, `enh_depth_key`, `enh_depth_floor_m` |
| Enhanced SOG/STW (R20) | `enh_slip_enabled`, `enh_sog_key`, `enh_current_drift_key`, `enh_slip_sog_floor_kt`, `enh_slip_ratio` |
| Enhanced true-wind (R21) | `enh_tw_crosscheck_enabled`, `enh_awa_key`, `enh_aws_key`, `enh_tw_twa_tol_deg`, `enh_tw_tws_tol_kt` |
| Enhanced heel (R22) | `enh_heel_enabled`, `enh_heel_key`, `enh_heel_min_deg`, `enh_heel_max_deg` |
| Enhanced turn confirm (R11/R14) | `enh_turnconfirm_enabled`, `enh_heading_key`, `enh_cog_key`, `enh_turn_min_roc` |

## Related

- [Configuration](../user/configuration.md)
- [Plugin lifecycle](plugin-lifecycle.md)
- [Polar Recorder plugin lifecycle](../architecture/plugin-lifecycle.md)
- [Rejection rules](../filters/rejection-rules.md)
