# Export and Import

**Status:** Current.

## Overview

Polar Recorder can export the learned polar as CSV or as a full JSON backup. CSV
export is for planners and spreadsheets. JSON export is a backup of the internal
persistence schema. Import/restore is not implemented.

## Key Details

Three built-in presets are always available and cannot be overwritten or
deleted. All three share TWS columns `[4, 6, 8, 10, 12, 14, 16, 20, 25]`:

- `Default180` (the default) uses TWA rows `[0, 15, 30, ... , 180]` (every
  15 deg), covering the starboard half only.
- `Default360` uses TWA rows `[0, 15, 30, ... , 345]` (every 15 deg, wrapping at
  360 deg back to 0 deg), covering the full circle so port and starboard export
  separately. A `Default360` CSV is not Windy.com-importable by design.
- `windy` uses the irregular Windy.com angles `[0, 30, 40, 52, 60, 75, 90, 110,
  120, 135, 150, 165, 180]` and remains the Windy-import grid.

User presets are stored in `<plugin_dir>/data/presets.json`, separate from the
learned `polar.json`. Preset names are trimmed, case-sensitive, 1-30 characters,
and may contain letters, digits, spaces, and hyphens. The names `Default180`,
`Default360`, and `windy` are reserved case-insensitively. TWA values must be
integers 0-359; values above 180 deg capture port-side data. TWS values must
be integers 1 through the active `max_tws`. Values are sorted on save.

CSV export supports two modes:

- Preset mode: `GET /api/export?format=Default180` or any built-in/user preset name.
- Inline mode: `GET /api/export?twa=0,30,60,90,120,150,180&tws=4,8,12,16,20`.

If neither mode is supplied, export defaults to `Default180`. Supplying `format`
with inline `twa` or `tws` is an error, as is supplying only one inline grid.

CSV format is semicolon-delimited UTF-8 text without a BOM. The first row is
`TWA\TWS;<tws...>`. The first column of each later row is TWA. A circular grid
(any TWA above 180 deg) emits TWA rows above 180 deg. STW values are knots
rounded to one decimal. Insufficient-data cells are blank. Rows use CRLF line
endings and have no trailing semicolon.

Projection is shared with the polar API and never folds: a non-circular (180 deg)
grid merges starboard bins by linear midpoint boundaries and excludes port bins,
while a circular grid assigns each raw bin to its nearest grid point on the
circle. Each populated cell uses the configured percentile. Default CSV export
uses the display floor `MIN_SAMPLES_DISPLAY = 3`. Adding
`high_confidence=yes`, `true`, or `1` uses the stricter
`min_samples_for_export` setting.

When the requested TWA grid includes 0 deg, each populated TWS band is anchored
to 0 STW at TWA 0 (head to wind), matching the polar diagram through the shared
`anchor_origin` boundary condition. Bands with no data, and grids without a 0 deg
row, leave that cell blank.

`GET /api/export/json` returns the full persistence JSON shape used by
`polar.json`. It is intended for backup and inspection. Restore/import from this
backup is not implemented.

## Related

- [API shape](../architecture/api.md)
- [Persistence](../architecture/persistence.md)
- [Configuration](configuration.md)
