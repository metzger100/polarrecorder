# AvNav Editable Parameters

**Status:** Current | Host editable-parameter contract and Polar Recorder mapping.

## Overview

AvNav editable parameters are settings exposed in AvNav's plugin configuration dialog. Polar
Recorder registers none of its own; AvNav still shows its built-in `enabled` start/stop switch
because the plugin registers a restart handler. The 49 runtime tuning values are stored as AvNav
plugin configuration values and edited from the viewer Settings tab.

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
| AvNav editable parameter specs | `server/polarrecorder/params.py` (`EDITABLE_PARAMETERS`) |
| Runtime configuration specs | `server/polarrecorder/params.py` (`CONFIG_PARAMETERS`) |
| Runtime typed config | `server/polarrecorder/config.py` |
| Initial runtime value read | `plugin.py` via `api.getConfigValue(name, default)` |
| Viewer save path | Settings-tab API handlers self-apply values and then call `api.saveConfigValues` |
| Hot-change callback | `plugin.py` registers `_on_config_change` for the AvNav contract; runtime edits now arrive through the viewer save path |
| User-facing setting reference | [Configuration](../user/configuration.md) |

Parsing rules:

- `BOOLEAN` is true only when the stripped upper-case string is `TRUE`.
- `NUMBER` values parse as integers and are clamped to `rangeOrList`.
- `FLOAT` values parse as floats and are clamped to `rangeOrList`.
- `STRING` values pass through unchanged; they hold optional store keys for the enhanced rules.
- Invalid changed values keep the previous runtime value; invalid initial values fall back to defaults.
- Polar Recorder registers no editable parameters of its own (`EDITABLE_PARAMETERS` is empty).
- AvNav still surfaces its built-in `enabled` start/stop switch because the plugin registers a
  restart handler; that switch is owned by AvNav, not by Polar Recorder.
- `polar.json` stores learned-model metadata, not active AvNav plugin configuration settings.

The only switch in the AvNav plugin configuration dialog is the AvNav-provided plugin enable
control (Polar Recorder registers no editable parameters):

| Group | Parameter | Owner |
|---|---|---|
| Plugin activation | `enabled` | AvNav built-in (auto-shown when a restart handler is registered) |

Polar Recorder's internal runtime configuration schema contains these 49 names:

| Group | Parameters |
|---|---|
| Recording and persistence | `sample_interval`, `flush_interval`, `debug_logging` |
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
