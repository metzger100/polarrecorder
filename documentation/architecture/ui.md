# UI Architecture

**Status:** Current.

## Overview

The Polar Recorder viewer is a standalone static user app served from the plugin
directory. It uses plain HTML, CSS, JavaScript, and SVG so it can run inside
AvNav without a build step, network access, or runtime dependencies.

## Key Details

- `viewer/viewer.html` provides the shell, five tab panels, Material-style navigation,
  and fixed script load order.
- `viewer/viewer.css` owns fallback day/night tokens and the Material
  You-inspired shape, type, elevation, state-layer, card, chip, and responsive
  layout rules. `viewer/theme.js` derives AvNav colors and font family from the
  same-origin parent viewer when embedded, mirrors AvNav's surrounding
  `.nightMode` page state into the standalone viewer body, and falls back to the
  local tokens when no parent AvNav document is available.
- `viewer/*.js` files are plain scripts that register functionality only on
  `window.Polarrecorder`. `viewer/viewer.js` owns startup, API access, polling, tab
  switching, status rendering, and shared caches. `viewer/placeholders.js` owns
  shared absent-value display text so chart and status rendering reuse one
  vocabulary. Component modules add
  `PolarChart`, `TimelineChart`, `GridEditor`, `ExportUI`, and `SettingsUI`.
  `viewer/presets.js` adds `Presets`, owning the built-in fallback list and
  display labels so `viewer.js` stays within its line budget.
- The viewer defaults to the `DefaultStarboard180` preset (label "Default
  (Starboard 180°)"). The preset selector also offers `DefaultPort180` ("Default
  (Port 180°)", the mirrored 180-360 deg half), `Default360` ("Default (360°)"),
  and the legacy `windy` ("Windy Passage Planner"); `Presets.Fallback()` mirrors
  all four when the `presets` fetch fails. The pre-rename `Default180` selection
  still resolves to the starboard half server-side.
- The tabs are Polar, Status, Timeline, Export, and Settings. Export is limited
  to CSV and preset workflows. Settings owns JSON backup, a disabled future
  restore affordance, and destructive reset confirmation.
- A single two-second heartbeat is the only timer and the shared sync anchor. It
  always fetches `status`, which carries the monotonic `generation` token, and
  keeps the recent-decision strip filled without any extra fetch. The active tab
  refreshes off that heartbeat: Status re-renders every beat; Polar refetches
  only when `generation` advances, so new curves and TWS bands appear within one
  beat of the sample entering the model; the Export CSV preview, once shown,
  silently refreshes when `generation` advances; Timeline refetches once per
  minute. Switching tabs immediately fetches that tab's data, so every tab shows
  the same model state within one beat.
- New TWS bands merge into the current chip selection and appear selected; band
  selection only resets on a format/preset change or an explicit reset, so a live
  band arriving never wipes the user's chip choices.
- SVG rendering is used for both charts. The polar chart renders only the
  selected preset's TWA columns, draws dots where those preset columns have
  data, and connects datapoints with thin straight segments only between
  adjacent TWA grid columns, so a column the selected preset can hold but has no
  data leaves a true gap with no connecting line. The chart picks one of three
  modes from the resolved TWA grid, mirroring the server projection. A
  `starboard` grid (no column above 180 deg) draws only the starboard spokes
  `[0, 30, 60, 90, 120, 150, 180]`, plots the starboard half, and does not close
  the curve back to 0 deg. A `port` grid (no column below 180 deg) is the mirror:
  it draws the spokes `[180, 210, 240, 270, 300, 330, 360]`, plots the port half,
  and likewise stays open. A `full` grid (columns on both sides of 180 deg) draws
  both half spokes plus the absolute-degree port labels `210, 240, 270, 300, 330`,
  plots port cells (geometry is already full-circle via `sin`/`cos`), and closes
  the full-circle curve by joining the last grid column back to the 0 deg/360 deg
  head-to-wind origin only when both columns adjacent to that origin hold data. A
  full-circle curve that ends at 180 deg (no learned port cells) therefore leaves
  the seam open instead of cutting a straight line across to 0 deg. The server
  anchors
  each populated band at 0 deg TWA / 0 STW (the chart center), and the viewer
  treats the 0 deg point as full confidence regardless of its sample count so the
  zero-sample anchor never dims the curve. Radial TWA angle labels sit a fixed
  distance outside the outer ring at every scale. Radial STW labels include `kn`
  units, while tooltips include explicit TWA, TWS, STW, and sample units. It
  skips redraws only when requested format, returned format, generation,
  percentile, TWS bands, and the preset TWA grid still describe the same view.
  When no polar data can be plotted, the empty grid remains visible and a
  centered overlay box reports that no data is available yet.
- The timeline chart draws server-supplied one-minute buckets with colored
  swatches for Accepted, Rejected, and Quarantined and a time scale with
  range-relative ticks.
- `tools/mock-server.py` serves the static viewer and deterministic in-memory
  API responses generated from one shared mock polar dataset. Pause/resume,
  preset save/delete, and confirmed reset mutate only process-local state:
  preset changes affect later `presets`, `polar`, and `export` calls, while
  confirmed reset makes later model/export/status/backup responses show an
  empty learned model. Static fixtures in `tests/mock-data/` mirror the same
  initial model for manual browser review.

## Related

- [API shape](api.md)
- [Coding standards](../conventions/coding-standards.md)
