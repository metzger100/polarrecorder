# Troubleshooting

**Status:** Current for version 1.0.0.

## Overview

This guide explains known limitations and recovery behavior for Polar Recorder.
It focuses on cases where the plugin is working as designed but the learned
polar, status display, or export workflow may surprise the user.

## Key Details

### Conditions the plugin cannot reliably detect

Polar Recorder learns from true wind angle, true wind speed, and speed through
water. With only those signals, some real-world conditions can look like normal
sailing:

- Motor-sailing can produce plausible wind and boat-speed values.
- Waves and swell can distort speed through water without a reliable signature.
- Reefing and sail changes change performance but still look like valid sailing.
- Current is not directly visible from speed through water alone.
- Shallow water can reduce performance without a depth signal.
- Bad sail trim is indistinguishable from a slower boat at the same TWA/TWS.

The validation pipeline rejects many detectable problems, and percentile-based
learning reduces the effect of moderate bad samples, but it cannot turn these
undetectable conditions into perfect ideal-performance data. For best results,
record mostly representative sailing and pause recording when you knowingly
motor-sail, sail under unusual trim, or collect data in conditions you do not
want in the learned polar.

### Corrupt file recovery

The learned polar is stored in `<plugin_dir>/data/polar.json`. On startup, Polar
Recorder tries that file first. If it is missing or corrupt, it tries
`polar.backup.json`. If the backup loads, the plugin starts from that recovered
dataset. If both files are missing or corrupt, the plugin starts with an empty
model and counters.

User export presets are stored in `<plugin_dir>/data/presets.json`. If that file
is missing, corrupt, or from a newer unsupported schema, Polar Recorder discards
the user presets for that run and keeps only the built-in Windy preset. Preset
save operations write a fresh `presets.json`.

### Maneuver cooldown and stability window

Keep `cooldown_seconds >= stability_window_seconds` if you rely on the
post-maneuver stability guarantee. The plugin does not cross-validate those two
settings.

When cooldown is at least as long as the stability window, maneuver-era samples
age out before the first post-cooldown sample can be accepted. If a user lowers
`cooldown_seconds` below `stability_window_seconds`, the first accepted sample
after a maneuver may still have maneuver-era readings in its stability window.

### System clock corrections

The sampling loop uses a monotonic clock, but some displays use wall-clock time.
After a system clock correction, such as an NTP step on a Raspberry Pi without a
real-time clock, wall-clock displays can briefly look wrong:

- Timeline buckets may appear in an unexpected minute.
- Status text such as "last flush N min ago" may be temporarily misleading.

These displays self-heal. Out-of-range timeline buckets age out within the
4-hour timeline window, and `last_flush_wall` is re-stamped on the next flush.
The only lasting timestamp is `created_wall`, which records when the dataset was
first written. It is debug/future-restore metadata and is not shown in the
Status tab.

### Lowering `max_tws` and export presets

`max_tws` is a validation and inline-editor limit, not the projection grid
ceiling. If `max_tws` is lowered below a preset's largest TWS column, the Export
tab flags that column as out of range for inline editing, inline download, and
saving.

Preset-mode export is unaffected. `GET /api/export?format=<name>` still works
for saved presets because projection sweeps the fixed 0-60 kt bin grid rather
than the active `max_tws` limit.

## Related

- [Configuration](configuration.md)
- [Export and import](export-import.md)
- [Data pipeline](../architecture/data-pipeline.md)
