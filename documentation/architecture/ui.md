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
  switching, status rendering, and shared caches. Component modules add
  `PolarChart`, `TimelineChart`, `GridEditor`, `ExportUI`, and `SettingsUI`.
- The tabs are Polar, Status, Timeline, Export, and Settings. Export is limited
  to CSV and preset workflows. Settings owns JSON backup, a disabled future
  restore affordance, and destructive reset confirmation.
- Polling is gated to the active tab. The Status tab appends its recent-decision
  strip from the existing status poll and never performs an extra fetch.
- SVG rendering is used for both charts. The polar chart renders only the
  selected preset's TWA columns, draws dots where those preset columns have
  data, and connects datapoints with thin straight segments without pointed
  gap styling or closing 180 degrees back to 0. Radial STW labels include `kn`
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
