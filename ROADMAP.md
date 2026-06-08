# Roadmap

**Status:** Current.

## Overview

The MVP is shipped: learned polar recording, validation, persistence, API,
viewer, and packaging. This roadmap tracks only Post-MVP ideas — the features
under consideration once the MVP baseline is stable. Each idea below states a
single goal, the user-visible outcome, and the main areas it touches. Nothing
here is committed or scheduled; ordering does not imply priority.

## Key Details

### 1. Optional signal hooks (enhanced rejection rules)

**Goal:** Improve recorded-data quality by rejecting samples that extra boat
sensors prove are unrepresentative.

The pipeline already reserves a hook for optional signals through
`Sample.enhanced` and `rules_enhanced.py`, but the current reader does not
populate it. With only TWA/TWS/STW the MVP can only *guess* at engine use, current,
and shallow water (R16 quarantines low-wind/high-STW as suspected motoring). This
idea wires real optional signals into the hook and turns those guesses into direct,
fail-closed rejects when the signal exists.

Rules to implement (each fires only when its optional signal is present; absent
signals leave the sample untouched):

- **Engine RPM** → `reject_engine_rpm`. Signal: custom `rpm` key (selectable from the available store keys list in the settings tab). Reject when RPM
  exceeds a configured idle threshold — the definitive engine-use reject that R16
  only approximates.
- **Engine state** → `reject_engine_on`. Signal: custom engine on/off key (selectable from the available store keys list in the settings tab). Reject
  any sample taken while the engine is running, for boats that expose a boolean
  state rather than RPM.
- **Depth** → `reject_shallow`. Signal: `gps.depthBelowTransducer`. Reject samples
  below a configured depth floor, where shallow-water squat distorts STW.
- **SOG/STW mismatch** → `reject_sog_stw_mismatch`. Signal: SOG (`gps.speed`).
  Reject when `abs(sog_kt - stw_kt)` exceeds a configured slip threshold, catching
  strong current and faulty paddle-wheel logs.
- **AWA/AWS true-wind cross-check** → `reject_true_wind_crosscheck`. Signals: AWA
  (`gps.windAngle`) + AWS (`gps.windSpeed`). Recompute expected TWA/TWS from
  apparent wind and STW; reject when the reported true wind disagrees beyond
  configured tolerances, catching wind-sensor and calibration errors.
- **Heading / COG turn confirmation** → reuses `reject_twa_roc` / `reject_unstable`.
  Signals: heading (`gps.headingTrue`) and/or COG (`gps.track`). Use heading/COG
  rate-of-change to confirm a real turn, hardening the existing maneuver reject so
  a pure wind shift is no longer mistaken for a turn.
- **Heel / roll** — infer overpowered/underpowered sailing state; could reject or
  tag samples once the rule is defined. Heel is the vessel roll angle, so the
  signal can come from a roll/attitude source (NMEA 2000 attitude PGN, SignalK
  `navigation.attitude`, or a custom plugin) (selectable from the available store keys list in the settings tab); AvNav core exposes no built-in
  heel/pitch/roll store key today, so it remains a custom optional signal.
- **Current set/drift** (`gps.currentSet`, `gps.currentDrift`) — detect and
  potentially compensate for current; this is more than a reject and needs design.

Any enhanced rule must keep the same no-AvNav, no-I/O, no-threading purity as the
core rules, accept only the arguments it uses, read its inputs only from
`Sample.enhanced`, and return the shared `RuleResult` type.

### 2. AvNav dashboard widgets

**Goal:** Surface Polar Recorder data directly on the AvNav dashboard through one
widget with three selectable kinds, themed to fit AvNav without fighting its CSS
and responsive across any dashboard cell size.

This is the most ambitious roadmap item. The reference implementation is the
sibling `dyninstruments` plugin, which registers configurable instrument widgets
with a `kind` selector. We copy its registration, kind-dispatch, theming, and
responsiveness *patterns*, but deliberately stay far simpler: `renderHtml` only
(no canvas), three kinds, and a small theme-token set. The notes below say what
to implement and how.

#### 2.1 Single widget, three kinds

Register exactly one widget through the AvNav plugin API:
`avnav.api.registerWidget(definition, editableParameters)` (see
`dyninstruments/runtime/widget-registrar.js:112` and the flow in its
`ARCHITECTURE.md`). The widget definition carries `name`, `description`,
`storeKeys`, `className`, and the lifecycle callbacks `initFunction`,
`renderHtml`, and `finalizeFunction`; the second argument is the
`editableParameters` object.

A `kind` SELECT parameter chooses what the single widget shows, exactly like
`dyninstruments/config/clusters/speed.js`:

```js
kind: {
  type: "SELECT",
  list: [
    { name: "Polar diagram", value: "polar" },
    { name: "Recording status", value: "status" },
    { name: "Timeline", value: "timeline" },
  ],
  default: "polar",
  name: "View",
}
```

`renderHtml` reads the resolved `kind` from its props and dispatches to one of
three pure render functions. Keep dispatch a plain `switch` in `renderHtml` —
do **not** copy the dyninstruments cluster-route / mapper / deferred-host-commit
machinery (`cluster/ClusterWidget.js`, `runtime/cluster/*`); it solves a
multi-surface, many-widget problem we do not have.

#### 2.2 Per-kind configuration (editable parameters)

Each kind exposes only its own options, using AvNav's conditional-parameter
visibility. A parameter is shown only when its `condition` matches the current
config; a `condition` **array** is OR, a `condition` **object** is AND (verified
in `dyninstruments/config/clusters/speed.js`). Parameter types we need are
`SELECT`, `BOOLEAN`, and `NUMBER`/`FLOAT`.

- **`polar`** — a preset selector (`SELECT`) listing the built-in presets plus
  user presets, reusing the same preset source as the viewer/export
  ([export-import.md](documentation/user/export-import.md)). Condition:
  `{ kind: "polar" }`.
- **`status`** — one `BOOLEAN` per toggleable field (e.g. recording active,
  total accepted samples, recent accept/reject counts, last decision), each with
  condition `{ kind: "status" }`, so the user checks which fields appear.
- **`timeline`** — a time-window control (`SELECT` or `NUMBER`) for how far back
  the timeline reaches, condition `{ kind: "timeline" }`.

#### 2.3 Data sourcing (key divergence from dyninstruments)

`dyninstruments` binds widgets to AvNav store keys via `storeKeys`. Polar
Recorder's data is **not** in the AvNav store — it lives behind the plugin's own
HTTP API (the same endpoints the viewer already calls:
[api.md](documentation/architecture/api.md)). The widget must therefore fetch
its data from those endpoints rather than from `storeKeys`:

- `polar` consumes the polar/preset projection endpoint.
- `status` consumes the status endpoint.
- `timeline` consumes the timeline endpoint.

Implement polling in `initFunction` (a single interval per widget instance,
cleared in `finalizeFunction`), cache the latest response on the widget context,
and have `renderHtml` render from that cache. This keeps `renderHtml` pure and
synchronous. The plugin must serve these endpoints to the dashboard origin
exactly as it already does for the viewer; no new lock or threading behaviour is
introduced because the API already snapshots live state under the `plugin.py`
lock.

#### 2.4 Rendering and safety

All three kinds render with `renderHtml` (no canvas). The polar and timeline are
drawn as inline **SVG** so they scale cleanly; status is plain HTML. Because the
viewer rendering rules forbid `innerHTML` assignment and unsafe DOM mutation
([smell-prevention.md](documentation/conventions/smell-prevention.md)), the
returned markup must be built safely: interpolate only numeric/whitelisted values
into SVG path/coordinate strings, and escape any text content. Reuse the existing
viewer polar-drawing logic where possible instead of reimplementing it. All
browser code stays under the `window.Polarrecorder` namespace and plain-script
rules; only `plugin.mjs` may be a module.

#### 2.5 Theming without clashing with AvNav CSS

Follow the dyninstruments approach (`plugin.css`, README "Theming"):

- Scope **every** CSS rule under the widget's own class — for Polar Recorder that
  is `.widget.polarrecorder` (no naked selectors that could leak into AvNav).
- Drive all colors, fonts, and weights through `--polarrecorder-` custom
  properties (the project's mandated prefix) with sensible defaults, so a user
  `user.css` can override them.
- Inherit AvNav day/night by providing matching `.nightMode .widget.polarrecorder`
  overrides, mirroring the documented dyninstruments day+night recipe.
- If AvNav's native widget header/value rows are unwanted, hide them only inside
  our widget via a scoped class (dyninstruments uses a `*-hide-native-head`
  class), never globally.

#### 2.6 Responsiveness across aspect ratios and sizes

The widget must look correct in any dashboard cell, from a tiny square to a wide
strip:

- For the SVG kinds, use a fixed `viewBox` with `preserveAspectRatio` so the
  drawing scales to the cell; size the polar from `min(width, height)` so it
  stays circular and centered in non-square cells.
- For `status`/`timeline`, use fluid CSS (percentages, `clamp()`, flex/grid) that
  reflows rather than overflows.
- Where layout must change by shape (e.g. stacked vs inline), switch on the cell
  aspect ratio. dyninstruments measures this in JS for its canvas widgets
  (`shared/widget-kits/...`); our renderHtml widgets should prefer CSS container
  queries or a simple ratio check, and only measure via `ResizeObserver` if CSS
  cannot express the breakpoint.

#### 2.7 Scope discipline

Copy from dyninstruments: single-widget registration, the `kind` SELECT,
conditional editable parameters, `.widget.<plugin>`-scoped CSS variables, and
day/night theming. Do **not** copy: canvas rendering and HiDPI setup, the
component registry/loader, cluster routes + mappers + viewmodels, route-activation
controllers, deferred host commit, per-unit parameter generation, and the large
geometry-token catalog. Those exist for a many-widget, multi-surface product;
this is three `renderHtml` views.

### 3. Adopt the dyninstruments color set

**Goal:** Replace Polar Recorder's current viewer palette with the default
`dyninstruments` color palette for both day and night, because it looks better
and reads more clearly than today's colors.

Today the viewer defines a day palette in `:root` and a night palette under
`.nightMode` ([viewer.css](viewer/viewer.css)), and [theme.js](viewer/theme.js)
mirrors AvNav's live `--avnav-*` colors into the `--polarrecorder-*` tokens and
toggles `.nightMode` from AvNav.

This idea re-bases the `--polarrecorder-*` tokens on the dyninstruments **default**
palette (only the default color set — not the `darkmode`, `bold`, or other
presets). We keep our mandated `--polarrecorder-` prefix and adopt the *values*,
not the `--dyni-` names:

- **Semantic colors** map to the dyninstruments default set: ok `#70F3AF` →
  `accepted`, alarm `#FA584A` → `rejected`, warning `#e7c66a` → `quarantined`,
  info `#70B0F3` → accent/links, pointer `#ff2b2b` → highlight. (Our current
  accepted/rejected/quarantined values are already close; this aligns them
  exactly and gives one shared, named semantic set.)
- **Day surface** uses the dyninstruments default light foreground/background/
  border tokens.
- **Night** reuses the same default semantic colors over a dark surface variant
  of those default tokens — i.e. the same palette, not a separate preset.

Implementation notes:

- Set the `--polarrecorder-*` tokens from the dyninstruments default values
  instead of mirroring AvNav's `--avnav-*` colors in [theme.js](viewer/theme.js);
  keep the existing `.nightMode` detection so the night variant still activates
  with AvNav's night mode.
- Define the palette once as named tokens so the future dashboard widget
  (item 4) and the viewer share a single source of color truth.

## Related

- [Export and import](documentation/user/export-import.md)
- [Data pipeline (enhanced signal hooks)](documentation/architecture/data-pipeline.md)
- [Viewer UI](documentation/architecture/ui.md)
- [Technical debt](documentation/TECH-DEBT.md)
