# Export and Import

**Status:** Current.

## Overview

Polar Recorder exports a tack-folded routing POL, tack-aware CSV, a full JSON backup, and a user-preset JSON backup. POL
targets NavimetriX and compatible routing applications; CSV remains the inspection, spreadsheet, custom-grid, and
port/starboard format. The JSON backups round-trip through the Settings tab and restore strictly by replacement.

## Key Details

Four built-in presets are always available and cannot be overwritten or deleted. All four share TWS columns
`[4, 6, 8, 10, 12, 14, 16, 20, 25]`:

- `DefaultStarboard180` (the default, label "Default (Starboard 180°)") uses TWA rows `[0, 15, 30, ... , 180]` (every 15
  deg), covering the starboard half only.
- `DefaultPort180` (label "Default (Port 180°)") uses TWA rows `[180, 195, ... , 345]` (every 15 deg), the mirror image
  covering the port half only. Starboard samples are excluded from a port grid, not folded onto it.
- `Default360` uses TWA rows `[0, 15, 30, ... , 345]` (every 15 deg, wrapping at 360 deg back to 0 deg), covering the
  full circle so port and starboard export separately. A `Default360` CSV is not Windy.com-importable by design.
- `windy` uses the irregular Windy.com angles `[0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]` and remains
  the Windy-import grid.

User presets are stored in `<plugin_dir>/data/presets.json`, separate from the learned `polar.json`. Preset names are
trimmed, case-sensitive, 1-30 characters, and may contain letters, digits, spaces, and hyphens. The names
`DefaultStarboard180`, `DefaultPort180`, `Default360`, and `windy` are reserved case-insensitively, as is the pre-rename
`Default180` (it still resolves to the starboard half). TWA values must be integers 0-359; values above 180 deg capture
port-side data. TWS values must be integers 1 through the active `max_tws`. Values are sorted on save.

### Routing POL

`GET /api/export/pol` returns `{pol}` containing a conventional absolute-TWA routing table. The Export tab downloads it
as `polarrecorder-routing.pol`. Its fixed grid is:

- TWA rows: `[30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]`.
- TWS columns: `[4, 6, 8, 10, 12, 14, 16, 20, 25]` knots, trimmed to the columns at or below the active `max_tws`.

Recording rejects true wind above `max_tws`, so a column above that ceiling could never fill and would fail every
export. `max_tws` is a 20-60 knot setting, so at `max_tws=20` or `22` the 25-knot column is dropped and the table is
12x8; at 25 and above it is the full 12x9. Nothing else about the grid varies.

The table starts with `TWA/TWS`, the spelling Adrena's and SailGrib's published `.pol` examples use and one of the two
qtVlm documents as accepted; Polar Recorder CSV keeps its own `TWA\TWS` first cell, so the two formats do not share a
header. POL places TWS across columns and TWA down rows, separates every field with a tab, formats STW in knots to one
decimal, and uses CRLF line endings. The browser writes UTF-8 text without a BOM. No row exceeds 180 deg. The grid
reuses the practical Windy sailing angles but deliberately omits its artificial 0 deg origin row: NavimetriX does not
document a requirement for 0 deg, published Adrena examples begin at a sailing angle, and SailGrib describes 0 deg as
recommended rather than mandatory.

POL folding is export-only; stored learned data remains true 0-359 deg and tack-aware. For each source bin, POL computes
`min(twa, 360 - twa)`, assigns that absolute angle and its TWS to the target cell, merges the underlying port and
starboard STW histograms and sample counts, then applies the percentile and sample floor to the merged population.

Projection runs on `[0, 30, 40, ... , 180]` while serialization emits only 30 deg and above. That hidden head-to-wind
point is a boundary, not an exported row: without it the first exported angle's midpoint interval would stretch down to
0 deg and samples nearer the bow than any sailing angle would set the 30 deg boat speed. With it, folded angles 0-14 deg
land in the discarded 0 deg bucket and 15-34 deg in the 30 deg row, matching the CSV projection's midpoint semantics.
`head_to_wind_threshold` is configurable down to 5 deg, so accepted samples below 15 deg are real, not hypothetical. It
never averages separately calculated tack speeds. The optional `percentile=1..99` override and
`high_confidence=yes|true|1` have the same meanings as CSV, but the Export tab keeps them per format: the POL card's
percentile and confidence settings apply to the POL download only, and the CSV card's apply to the CSV preview and
download only.

NavimetriX's public documentation specifies tab-separated `.pol` and identifies it as the format used by SailGrib,
Adrena, and other navigation applications, but does not specify blank-cell acceptance, arbitrary-grid limits, encoding,
newline style, exact first-cell spelling, or a mandatory 0 deg row. Polar Recorder therefore does not fabricate,
interpolate, or extrapolate missing performance. Every cell of the active grid (108 at `max_tws` 25 or above, 96 below
it) must meet the selected sample floor; otherwise export fails with the number of insufficient cells. This is
intentionally conservative until NavimetriX documents incomplete matrices.

Format references:

- [NavimetriX FAQ: polar import and CSV-to-POL conversion](https://navimetrix.com/en/faq/)
- [Adrena: creating a POL table](https://www.adrena-software.com/en/2-how-can-i-create-a-pol-file-from-data-in-table/)
- [SailGrib WR guide](https://www.sailgrib.com/wp-content/uploads/2020/06/sailgrib_wr_help_faq_tips_fr_20200624-compressed.pdf)
- [qtVlm documentation: CSV and tab-separated POL formats](https://download.meltemus.com/qtvlm/qtVlm_documentation_en.pdf)

### Tack-aware CSV

CSV export supports two modes:

- Preset mode: `GET /api/export?format=DefaultStarboard180` or any built-in/user preset name.
- Inline mode: `GET /api/export?twa=0,30,60,90,120,150,180&tws=4,8,12,16,20`.

If neither mode is supplied, export defaults to `DefaultStarboard180`. Supplying `format` with inline `twa` or `tws` is
an error, as is supplying only one inline grid.

CSV format is semicolon-delimited UTF-8 text without a BOM. The first row is `TWA\TWS;<tws...>`. The first column of
each later row is TWA. A circular grid (any TWA above 180 deg) emits TWA rows above 180 deg. STW values are knots
rounded to one decimal. Insufficient-data cells are blank. Rows use CRLF line endings and have no trailing semicolon.

Projection is shared with the polar API and never folds: a non-circular (180 deg) grid merges starboard bins by linear
midpoint boundaries and excludes port bins, while a circular grid assigns each raw bin to its nearest grid point on the
circle. Each populated cell uses the configured percentile. Default CSV export uses the display floor
`MIN_SAMPLES_DISPLAY = 3`. Adding `high_confidence=yes`, `true`, or `1` uses the stricter `min_samples_for_export`
setting.

When the requested TWA grid includes 0 deg, each populated TWS band is anchored to 0 STW at TWA 0 (head to wind),
matching the polar diagram through the shared `anchor_origin` boundary condition. Bands with no data, and grids without
a 0 deg row, leave that cell blank.

`GET /api/export/json` returns the full persistence JSON shape used by `polar.json`. `GET /api/export/presets` returns
the user presets in the `presets.json` backup shape (built-ins excluded). Both are intended for backup, inspection, and
restore.

## Restore

The Settings tab can restore both backups. Each restore is **replace-only** and requires typing `RESTORE` to confirm,
mirroring the Reset confirmation:

- **Learned-data restore** fully replaces the learned model and counters with a valid `export/json` backup. The backup's
  bin grid must match this build's grid, and its schema must not be newer than this plugin supports; an older schema is
  migrated. The backup's `percentile`/`max_tws` metadata never changes your live AvNav settings. Restoring also recovers
  a plugin that booted from a corrupt or too-new `polar.json`. On success you see how many bins and accepted samples
  were restored.
- **Presets restore** fully replaces your user presets with a valid `export/presets` backup. Built-in presets are never
  affected. Preset names must be valid and non-reserved, and each preset's TWS values must fit the current `max_tws`. On
  success you see how many user presets were restored.

Both imports are fail-closed and all-or-nothing: a wrong file, corrupted JSON, a foreign bin grid (learned data), a
too-new schema, a reserved/built-in preset name, or any out-of-range value is rejected with a precise reason and your
current state is left completely untouched. Backups are uploaded in chunks over several GET requests (AvNav plugins
cannot receive POST). The import size cap is 4 MiB. See [import and restore](../architecture/import-restore.md) for the
full rules.

## Related

- [API shape](../architecture/api.md)
- [Import and restore](../architecture/import-restore.md)
- [Persistence](../architecture/persistence.md)
- [Configuration](configuration.md)
