# UI Architecture

**Status:** Current.

## Overview

The Polar Recorder viewer is a standalone static user app served from the plugin directory. It uses plain HTML, CSS,
JavaScript, and SVG so it can run inside AvNav without a build step, network access, or runtime dependencies.

## Key Details

- `viewer/viewer.html` provides the shell, five tab panels, Material-style navigation, and fixed script load order.
- Four CSS files, loaded by `viewer/viewer.html` in this cascade order, together own fallback day/night tokens and the
  Material You-inspired shape, type, elevation, state-layer, card, chip, and responsive layout rules:
  `viewer/viewer-shell.css` (tokens, resets, app header, tabs, cards, loading state), `viewer/viewer-nav-actions.css`
  (bottom nav, buttons/actions, form controls, chips), `viewer/viewer-status-and-chart.css` (status/decision UI, the
  polar chart SVG, and tooltips), and `viewer/viewer-settings-and-responsive.css` (grid editor, switches,
  settings/enhanced/advanced groups, and the responsive media queries). Split from one file to stay under the 400-line
  budget; splitting preserved cascade order exactly, since `<link>` load order is the only thing that matters for
  equal-specificity rules. `viewer/theme.js` derives AvNav colors and font family from the same-origin parent viewer
  when embedded, mirrors AvNav's surrounding `.nightMode` page state into the standalone viewer body, and falls back to
  the local tokens when no parent AvNav document is available.
- Every shipped `plugin.js`, `plugin.mjs`, and `viewer/*.js` file is fully JSDoc-typed and strictly no-emit
  `checkJs`-checked (`tsconfig.checkjs.json`; `npm run typecheck:source`) with no runtime build step or emitted output.
  `types/polarrecorder-globals.d.ts` currently declares the shared `window.Polarrecorder` namespace loosely (`any`) as
  an interim ambient contract; each module's own functions and locally consumed DOM/API shapes are precisely typed via
  JSDoc typedefs regardless. `viewer/dom.js`'s `RequireById(id)` fails loudly instead of returning `null` for elements
  `viewer/viewer.html` always provides, keeping DOM lookups non-nullable without runtime guards that exist only to
  placate the checker.
- `viewer/*.js` files are plain scripts that register functionality only on `window.Polarrecorder`. `viewer/viewer.js`
  owns startup, API access, polling, tab switching, preset/polar/timeline/export/settings orchestration, actions, and
  shared caches (`ApiBase`, `PresetsCache`, `ConfigCache`). `viewer/dom.js` owns shared DOM construction helpers
  (`Node`, `Clear`, `Button`, `ActionRow`, `Download`) plus `ShowTooltip`, a lower-layer helper both the shell and
  status rendering call without creating a namespace cycle between them. `viewer/status-ui.js` owns the Status tab:
  recent-decision derivation and the `RecentDecisions` cache, the state/values/counters/persistence cards, decision
  strip coloring, and status-local duration/last-flush text, driven by
  `StatusUI.Render(host, data, { runAction, fetchStatus })` and `StatusUI.AppendRecentDecision(data)`; `viewer.js`
  passes its own `runAction` and `fetchStatus` in as callbacks rather than status-ui.js reaching back into the shell's
  namespace. `viewer/placeholders.js` owns shared absent-value display text so chart and status rendering reuse one
  vocabulary. Component modules add `PolarChart`, `TimelineChart`, `GridEditor`, `ExportUI`, and `SettingsUI`.
  `viewer/polar-chart-geometry.js` adds `PolarChartGeometry` (`SvgNode`, `AddGrid`, `AddCurve`, `BandColor`), the SVG
  grid/curve drawing math that `polar-chart.js` calls into so its own state/orchestration logic stays under the
  file-size budget. `viewer/export-fields.js` adds `ExportFields` (`Section`, `Header`, `Field`, `ConfidenceField`,
  `PercentileHelp`, `QualityControls`, `MessageNode`, `SetMessage`), the Export-tab field builders and per-format
  message channel `export-ui.js` composes so its preset/CSV orchestration logic stays under the file-size budget.
  `QualityControls(format, defaultPercentile, minSamples)` builds one percentile-override field, its help text, and one
  high-confidence switch bound to the passed format state, and `MessageNode(format)` / `SetMessage(format, text, kind)`
  render and update that format's own message line by its `messageId`, so each export card gets its own controls and its
  own message area from one builder set instead of a copied block. `viewer/export-presets.js` adds `ExportPresets`,
  owning the selected-preset name and the TWA/TWS `GridEditor` instances (`Configure`, `All`, `Sorted`, `Selected`,
  `SetSelected`, `SelectedPreset`, `Editors`, `LoadSelected`, `IsValid`) so `export-ui.js` stays under its file-size
  budget. The Export tab holds two strictly separated format cards: **Routing POL (.pol)** first, then **Tack-aware CSV
  (.csv)**. Each card is self-contained and carries its own percentile override, high-confidence switch, action row, and
  message line (`#export-pol-message`, `#export-csv-message`); `ExportUI` keeps a separate `pol` and `csv` format state,
  so a setting or a failure in one card never applies to or appears in the other. Neither card's copy refers to the
  other: POL states its fixed 30-180 deg tack-merged grid, CSV states its user-chosen tack-separate grid, and both say
  their settings apply to that download only. Presets, the TWA/TWS grid editors, the preview textarea, and the CSV grid
  validity gate (`.preview-button`, `.download-button`, `.save-button`) belong to the CSV card alone; the POL button
  (`.pol-download-button`) is never disabled by CSV grid state. `viewer/advanced-settings.js` adds `SourceSettings`, the
  Settings tab's first card, and `AdvancedSettings`, its fifth card. `viewer/enhanced-settings.js` adds
  `EnhancedSettings`, the Settings tab's fourth card, mounted by `settings-ui.js` so the transport-heavy markup stays
  out of the Settings budget. `viewer/presets.js` adds `Presets`, owning the built-in fallback list and display labels
  so `viewer.js` stays within its line budget. `viewer/import-upload.js` adds `ImportUpload`, the shared chunked-upload
  helper (`UploadBackup(kind, text, onSummary, onError)`) used by both Settings restore cards, keeping the transport in
  one place and `settings-ui.js` under its budget.
- The viewer defaults to the `DefaultStarboard180` preset (label "Default (Starboard 180°)"). The preset selector also
  offers `DefaultPort180` ("Default (Port 180°)", the mirrored 180-360 deg half), `Default360` ("Default (360°)"), and
  the legacy `windy` ("Windy Passage Planner"); `Presets.Fallback()` mirrors all four when the `presets` fetch fails.
  The pre-rename `Default180` selection still resolves to the starboard half server-side.
- The tabs are Polar, Status, Timeline, Export, and Settings. Export provides routing POL plus CSV/preset workflows.
  Settings starts with a **Data Sources** card whose TWA, TWS, and STW selectors default to `gps.trueWindAngle`,
  `gps.trueWindSpeed`, and `gps.waterSpeed`. The selected keys are saved through the runtime-config endpoint and apply
  on the next sampling cycle. Two maintenance cards follow: a **Learned Data** card with Download, Restore, and Reset
  subsections, and a **Presets** card with Download and Restore subsections. Each subsection is a `.settings-group` (the
  Reset one carries `.settings-group-danger`). Each restore subsection has a hidden file input behind a "Choose Backup
  File" button, a chosen-filename label, a "Type RESTORE to confirm" field, and a danger button; on confirmation it
  reads the file and drives `ImportUpload.UploadBackup(kind, ...)`, which uploads the JSON in chunks and shows the
  server's summary or its precise rejection. Reset still requires the `RESET` confirmation.
- Settings also owns a fourth **Enhanced Rules** card (`EnhancedSettings.Render()`), rendered from `GET enhanced/keys`
  and `GET enhanced/status`. Each rule shows an Enabled switch (the shared `.switch-field` control also used by the
  Export tab), one editable text input per configured key field backed by a `<datalist>` of currently-present store keys
  (SignalK keys appear as `gps.signalk.*`; arbitrary custom keys can be typed, and an already-configured key stays
  selected even when it is not publishing), the rule's threshold inputs, and a live status badge whose primary
  vocabulary is `active`, `disabled`, or `unavailable`, with the detailed cause (`no key set`, `key not in store`,
  `value stale`, or `value invalid`) retained as supporting text. R20's fail-closed invalid-drift case is labeled
  active, and the API retains each role's source state. A single "Save Enhanced Settings" button validates that every
  threshold is a finite number (`Number.isFinite`) before collecting every control into one `GET enhanced/save` call and
  then re-fetching status to refresh the badges; a non-numeric threshold blocks the save with a visible error. The badge
  classes are `.enhanced-badge-<status>`, each with its own `--polarrecorder-*` treatment: `active` reads
  accepted-green, `value stale` quarantined-amber, `key not in store` rejected-red, `no key set` a dashed neutral
  outline, and `disabled` the muted second-color.
- A fifth **Advanced Settings** card (`AdvancedSettings.Render()`) sits below Enhanced Rules and is rendered from
  `GET advanced/settings`. It exposes the safe runtime-tuning settings from the server allowlist, grouped as Sampling
  and Persistence, Sensor Freshness, Core Filters, Stability and Maneuvers, and Engine Heuristic. Numeric fields use
  readable labels, short descriptions, and the server's min/max bounds; `debug_logging` renders as a switch. Internal
  config keys are only used as hidden save wiring. The save button validates finite in-range numbers before sending one
  `GET advanced/save` request and then re-fetching the groups.
- The Status tab and Enhanced Settings use `enhanced-rule-display.js` as the single source of user-facing rule,
  availability, and cause labels; internal API identifiers are not shown as headings. `engine-warning.js` performs one
  startup check only: when no definitive engine-state rule is active, or protection status cannot be verified, it offers
  Close or browser-local Never show again. RPM-only protection remains partial because values at or below its idle
  ceiling do not prove that propulsion is disengaged. The warning never changes plugin configuration or persistence. Its
  modal has dialog semantics, a backdrop, initial and contained focus, Escape handling, focus restoration, and an inert
  background. It is content-sized, centered, viewport-constrained, and layered above the app navigation and overlays.
  Storage failures remain local to the modal rather than using a global browser error listener.
- Status diagnostic headings use the card's shared inset, so Enhanced Rule Availability and the reason/predicate
  sections align with their card content rather than the rounded border.
- Export grid controls reserve room for the browser's numeric spinner as well as a three-digit TWA value, so port-side
  angles through `359` remain fully visible while the row continues to scroll horizontally when needed. Its add/remove
  controls do not shrink, preserving their circular touch targets at every grid width.
- A single two-second heartbeat is the only timer and the shared sync anchor. It always fetches `status`, which carries
  the monotonic `generation` token, and keeps the recent-decision strip filled without any extra fetch. The active tab
  refreshes off that heartbeat: Status re-renders every beat; Polar refetches only when `generation` advances, so new
  curves and TWS bands appear within one beat of the sample entering the model; the Export CSV preview, once shown,
  silently refreshes when `generation` advances; Timeline refetches once per minute. Switching tabs immediately fetches
  that tab's data, so every tab shows the same model state within one beat.
- New TWS bands merge into the current chip selection and appear selected; band selection only resets on a format/preset
  change or an explicit reset, so a live band arriving never wipes the user's chip choices.
- SVG rendering is used for both charts. The polar chart renders only the selected preset's TWA columns, draws dots
  where those preset columns have data, and connects datapoints with thin straight segments only between adjacent TWA
  grid columns, so a column the selected preset can hold but has no data leaves a true gap with no connecting line. The
  chart picks one of three modes from the resolved TWA grid, mirroring the server projection. A `starboard` grid (no
  column above 180 deg) draws only the starboard spokes `[0, 30, 60, 90, 120, 150, 180]`, plots the starboard half, and
  does not close the curve back to 0 deg. A `port` grid (no column below 180 deg) is the mirror: it draws the spokes
  `[180, 210, 240, 270, 300, 330, 360]`, plots the port half, and likewise stays open. A `full` grid (columns on both
  sides of 180 deg) draws both half spokes plus the absolute-degree port labels `210, 240, 270, 300, 330`, plots port
  cells (geometry is already full-circle via `sin`/`cos`), and closes the full-circle curve by joining the last grid
  column back to the 0 deg/360 deg head-to-wind origin only when both columns adjacent to that origin hold data. A
  full-circle curve that ends at 180 deg (no learned port cells) therefore leaves the seam open instead of cutting a
  straight line across to 0 deg. The server anchors each populated band at 0 deg TWA / 0 STW (the chart center), and the
  viewer treats the 0 deg point as full confidence regardless of its sample count so the zero-sample anchor never dims
  the curve. Radial TWA angle labels sit a fixed distance outside the outer ring at every scale. Radial STW labels
  include `kn` units, while tooltips include explicit TWA, TWS, STW, and sample units. It skips redraws only when
  requested format, returned format, generation, percentile, TWS bands, and the preset TWA grid still describe the same
  view. When no polar data can be plotted, the empty grid remains visible and a centered overlay box reports that no
  data is available yet.
- The timeline chart draws server-supplied one-minute buckets with colored swatches for Accepted, Rejected, and
  Quarantined and a time scale with range-relative ticks.
- `tools/mock-server.py` serves the static viewer and deterministic in-memory API responses generated from one shared
  mock polar dataset. Pause/resume, preset save/delete, and confirmed reset mutate only process-local state: preset
  changes affect later `presets`, `polar`, and `export` calls, while confirmed reset makes later
  model/export/status/backup responses show an empty learned model. Static fixtures in `tests/mock-data/` mirror the
  same initial model for manual browser review.

## Related

- [API shape](api.md)
- [Import and restore](import-restore.md)
- [Coding standards](../conventions/coding-standards.md)
