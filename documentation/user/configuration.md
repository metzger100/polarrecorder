# Configuration

**Status:** Phase 2 editable-parameter reference only; the complete Polar Recorder parameter table is planned for Phase 7.

## Overview

Polar Recorder uses AvNav editable parameters for persistent runtime configuration. This document covers the AvNav parameter mechanism and the reserved `enabled` behavior that affects Polar Recorder naming.

## Key Details

- Plugins register editable settings with `api.registerEditableParameters(paramList, changeCallback)`; AvNav stores the generated `WorkerParameter` objects and the change callback (`handler/pluginhandler.py:481-505`).
- The `AVNApi` interface says `registerEditableParameters()` is typically called in the plugin constructor and calls `changeCallback` with changed values as a dictionary (`avnav_api.py:348-355`).
- Each parameter dict must include `name`; `default` is optional and a missing or `None` default makes the parameter mandatory; `type` defaults to `STRING`; `rangeOrList` supplies select lists or numeric ranges; and `description` supplies user-facing text (`avnav_api.py:356-366`, `handler/pluginhandler.py:481-496`).
- AvNav's editable parameter types include `STRING`, `NUMBER`, `FLOAT`, `BOOLEAN`, and `SELECT` (`avnav_worker.py:45-54`). `FILTER` also exists in AvNav, but Polar Recorder's Phase 2/PLAN1 editable-parameter design uses the five listed user configuration types (PLAN1 section 7 editable-parameter system).
- AvNav converts parameter values according to `WorkerParameter._getValue`: `NUMBER` to `int`, `FLOAT` to `float`, `BOOLEAN` to a boolean, and other values to strings (`avnav_worker.py:87-98`).
- The AvNav boolean string convention is uppercase comparison with `"TRUE"`; string values are parsed as true only when `val.upper() == "TRUE"` (`avnav_worker.py:92-97`). Polar Recorder design uses `value.strip().upper() == "TRUE"` in its own parser for incoming config strings (PLAN1 section 7 editable-parameter system).
- AvNav range checks `NUMBER` and `FLOAT` values against a two-item `rangeOrList`, and checks `SELECT` values against the configured list (`avnav_worker.py:186-215`).
- `api.saveConfigValues(configDict)` persists plugin config changes through `changeChildConfigDict()` (`handler/pluginhandler.py:477-479`). The `AVNApi` interface says values should be strings and are converted to strings in any case (`avnav_api.py:336-346`).
- `api.getConfigValue(key, default=None)` reads the plugin's current config value, allows an environment override, and returns the supplied default if no stored value exists (`handler/pluginhandler.py:311-327`).
- AvNav defines a built-in `ENABLE_PARAMETER` named `enabled` for plugins (`handler/pluginhandler.py:744-748`).
- AvNav adds that built-in `enabled` parameter to editable child parameters when the plugin has a stop handler or is JavaScript/CSS-only (`handler/pluginhandler.py:990-999`).
- During config update, AvNav consumes `enabled`: it persists the new value, calls `api.stop()` when disabling, deletes `param['enabled']`, and may restart the plugin thread without forwarding `enabled` to the plugin's change callback (`handler/pluginhandler.py:1030-1047`, `handler/pluginhandler.py:1048-1055`).
- Polar Recorder design therefore uses `record_enabled` for the plugin-owned recording switch and reserves `enabled` for AvNav's coarse plugin enable/disable toggle (PLAN1 section 6.B4).
- Phase 2 does not list Polar Recorder's final parameter table or hot-swap details. Phase 7 completes this document with every parameter, type, range, default, and runtime behavior (PLAN1 section 12).

## Related

- [Plugin lifecycle](../architecture/plugin-lifecycle.md)
- [API shape](../architecture/api.md)
- [AvNav keys and units](../avnav/keys-and-units.md)
