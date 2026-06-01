# Export and Import

**Status:** Current for version 1.0.0.

## Overview

Polar Recorder can export the learned polar as Windy-compatible CSV or as a
full JSON backup. CSV export is for planners and spreadsheets. JSON export is a
backup of the internal persistence schema. Import/restore is Post-MVP.

## Key Details

The built-in `windy` preset is always available and cannot be overwritten or
deleted. It uses TWA rows `[0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165,
180]` and TWS columns `[4, 6, 8, 10, 12, 14, 16, 20, 25]`.

User presets are stored in `<plugin_dir>/data/presets.json`, separate from the
learned `polar.json`. Preset names are trimmed, case-sensitive, 1-30 characters,
and may contain letters, digits, spaces, and hyphens. The name `windy` is
reserved case-insensitively. TWA values must be integers 0-180. TWS values must
be integers 1 through the active `max_tws`. Values are sorted on save.

CSV export supports two modes:

- Preset mode: `GET /api/export?format=windy` or a user preset name.
- Inline mode: `GET /api/export?twa=0,30,60,90,120,150,180&tws=4,8,12,16,20`.

If neither mode is supplied, export defaults to Windy. Supplying `format` with
inline `twa` or `tws` is an error, as is supplying only one inline grid.

CSV format is semicolon-delimited UTF-8 text without a BOM. The first row is
`TWA\TWS;<tws...>`. The first column of each later row is TWA. STW values are
knots rounded to one decimal. Insufficient-data cells are blank. Rows use CRLF
line endings and have no trailing semicolon.

Projection is shared with the polar API: raw 0-359 TWA bins fold to 0-180,
neighboring raw bins merge by midpoint boundaries across the requested TWA/TWS
grid, and each populated cell uses the configured percentile. Default CSV export
uses the display floor `MIN_SAMPLES_DISPLAY = 3`. Adding
`high_confidence=yes`, `true`, or `1` uses the stricter
`min_samples_for_export` setting.

`GET /api/export/json` returns the full persistence JSON shape used by
`polar.json`. It is intended for backup and inspection. Restore/import from this
backup is Post-MVP and is not implemented in version 1.0.0.

## Related

- [API shape](../architecture/api.md)
- [Persistence](../architecture/persistence.md)
- [Configuration](configuration.md)
