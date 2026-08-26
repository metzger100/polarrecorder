# Polar Recorder

Polar Recorder is an AvNav plugin that learns how fast your own boat usually sails at different wind angles and wind
speeds.

<img width="1920" height="937" alt="image" src="https://github.com/user-attachments/assets/e4276264-305d-48bd-9ac3-df27538e51f0" />

## Why would I use it?

A polar describes the boat speed you can expect for a true wind angle and speed. Use Polar Recorder to:

- compare your real performance with what you expected
- export a boat-specific routing POL for NavimetriX-compatible apps or tack-aware CSV for Windy and analysis
- plan passages with numbers from your own boat

Polar Recorder is not a sail-trim teacher or weather router; it records and filters data.

## What does it need?

Polar Recorder uses three AvNav values:

| Short name | Meaning                                                                    | AvNav source        |
| ---------- | -------------------------------------------------------------------------- | ------------------- |
| TWA        | True wind angle. Where the true wind comes from, relative to the boat.     | `gps.trueWindAngle` |
| TWS        | True wind speed. The real wind speed after AvNav has calculated true wind. | `gps.trueWindSpeed` |
| STW        | Speed through water. Usually from the log or paddlewheel.                  | `gps.waterSpeed`    |

Change these defaults in **Settings > Data Sources**; surrounding whitespace is removed from saved keys. TWA uses
degrees, while TWS and STW use m/s before Polar Recorder converts and displays the speeds in knots. Blank persisted core
keys are restored to these defaults at startup.

Core learning uses true wind angle/speed and speed through water. A configured fresh SOG is also used to distinguish
anchored from moving samples. Other optional signals are described under
[Enhanced Rules](#enhanced-rules-optional-signals); waves and sail configuration are not used.

## Quick Start

1. Install the plugin in AvNav.
2. Make sure AvNav receives TWA, TWS, and STW from your instruments.
3. Open the Polar Recorder User App from AvNav.
4. Leave recording enabled while you are sailing normally.
5. Pause recording when motoring, motor-sailing, maneuvering for a long time, or sailing in conditions you do not want
   in your polar.
6. After enough sailing, open the Polar tab to view the learned polar.
7. Open the Export tab to download a CSV.

The first minutes can look empty. That is normal. The plugin waits for stable, usable samples before it trusts the data.

## Installation

Linux AvNav servers can install or update from the latest GitHub Release with:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh)
```

The installer targets AvNav user plugins by default. It detects existing user plugin installs, AvNav service data
directories, and documented Linux defaults before writing files. For custom setups, pass the AvNav data directory or the
final plugin directory:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh) --data-dir <AVNAV_DATA_DIR>
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh) --plugin-dir <AVNAV_PLUGIN_DIR>/polarrecorder
```

To install a specific version, add `--version <VERSION>` to that command. Manual installation is also supported:

1. Download the release zip from GitHub Releases.
2. Extract it into your AvNav plugin directory so you get `<AVNAV_PLUGIN_DIR>/polarrecorder/`.
3. Restart AvNav.
4. Open the Polar Recorder User App from AvNav.

You can also upload the release zip through AvNav's plugin page. If the app does not appear after installation, restart
AvNav or hard-refresh its client.

## How recording works

Every sample goes through a simple decision:

| Decision    | Meaning                                                                   | Does it change the polar? |
| ----------- | ------------------------------------------------------------------------- | ------------------------- |
| Accepted    | The data looked like usable sailing data.                                 | Yes                       |
| Rejected    | The data looked wrong, incomplete, too unstable, or not useful.           | No                        |
| Quarantined | The data looked like possible sailing, but suspicious enough to keep out. | No                        |

Rejected and quarantined samples are not failures. They are the plugin protecting your polar from bad data.

Only accepted samples are used to learn boat speed. Missing, stale, unstable, or implausible data is rejected or
quarantined until conditions settle.

## What the tabs show

### Polar

The Polar tab plots learned STW against TWA, with one curve per TWS band. Empty areas mean there is not enough accepted
data yet. Presets select a starboard, port, full-circle, or custom grid without changing the learned data.

### Status

The Status tab explains what is happening now:

- Recording, Paused, or No Data
- current TWA, TWS, and STW values and freshness
- the latest decision and diagnostic counters
- common rejection reasons and triggered predicates
- persistence and optional enhanced-rule availability

Status also shows whether each optional enhanced rule is active, disabled, or unavailable and why, including invalid
source data. Speed-log sanity remains active when SOG is usable but current drift is invalid, because corrupt drift
cannot safely explain a SOG/STW gap; missing or stale drift still makes that rule unavailable. On startup, a warning
appears when no definitive engine-state protection is active or its status cannot be verified. RPM-only protection is
partial because values below its idle ceiling do not prove the propeller is disengaged; pause while motoring or map a
definitive engine-state source. Close affects only the page; Never show again stores a browser-local preference.

### Timeline

The Timeline tab groups recent accepted, rejected, and quarantined samples into one-minute buckets so you can see when
recording worked and why samples were excluded.

### Export

The Export tab has one card per format. Each card is self-contained: it has its own percentile override, its own
high-confidence switch, its own download button, and its own message line, so nothing you set for one format affects the
other.

**Routing POL (.pol)** creates a fixed 30-180° absolute-TWA table for NavimetriX and compatible routing apps. It folds
port and starboard observations together by merging their sample histograms before percentile calculation. POL never
changes or folds the stored learned model. Because NavimetriX does not publicly document blank-cell support, the
download fails with a missing-cell count until every routing cell meets the selected confidence floor; no performance is
interpolated or extrapolated. Wind columns above your "Maximum true wind" setting are left out of the table, because
recording rejects that wind and the column could never fill.

**Tack-aware CSV (.csv)** is for spreadsheets, Windy, custom TWA/TWS grids, starboard-only or port-only inspection, and
full 360° tack asymmetry. You can preview or download CSV, edit its grid, and save presets. Presets and the grid editor
belong to this card only; they never change the POL table.

Blank CSV cells mean there was not enough accepted data for that angle and wind speed.

A `360°` preset (or any custom grid with angles above `180°`) exports true port/starboard asymmetry, emitting TWA rows
above `180°`. Note that a `360°` CSV is not Windy.com-importable by design; use the `Windy Passage Planner` preset for
Windy import.

### Settings

The Settings tab configures data sources, learned-data backup/reset, preset backup, optional enhanced rules, and
advanced filters. Data-source changes apply on the next sampling cycle.

#### Backup and restore

Learned data and user presets can be downloaded separately as JSON backups. Restoring replaces the selected target;
resetting learned data clears its model and counters. Download a backup before destructive operations.

To restore:

1. Click **Choose Backup File** in the matching restore card and pick a file you downloaded earlier.
2. Type `RESTORE` in the confirmation field.
3. Click **Restore Learned Data** or **Restore Presets**.

Invalid or incompatible backups are rejected without changing current data. Restore is replace-only and backups are
limited to 4 MiB. See [Export and import](documentation/user/export-import.md) for compatibility rules.

### Enhanced Rules (optional signals)

Enhanced Rules use optional boat signals to reject unrepresentative samples. A rule acts only when enabled and all of
its configured inputs are fresh, finite, and valid for their signal role. Only engine state accepts boolean values.

The enhanced rejection rules are:

- **Engine RPM** — rejects when RPM is above an idle ceiling; lower RPM remains ambiguous.
- **Engine state** — rejects when a boolean, RPM, or alternator-voltage signal indicates the engine is on.
- **Shallow water** — rejects when depth/keel clearance is below a floor (shallow-water squat).
- **SOG / STW consistency** — rejects when either speed reading is implausible versus the other and the reported current
  drift is too small to explain the gap.
- **True-wind cross-check** — recomputes true wind from apparent wind and boat speed and rejects when it disagrees with
  the reported true wind.
- **Heel band** — rejects when heel is outside a configured range.

The SOG source is also shared with anchored detection even when the SOG/STW consistency rule is disabled. Optional
signals are normalized and checked against broad physical ceilings before any rule can consume them.

Standard AvNav keys are offered as suggestions where available. The key fields remain editable, so engine, RPM, heel,
and other custom store keys can be typed even when AvNav discovery cannot enumerate their prefix. Engine and heel rules
remain inactive until you map their boat-specific keys. The live badge explains whether each rule is active, disabled,
or unavailable.

### Advanced Settings

Advanced Settings exposes boat-specific tuning grouped as:

- **Sampling and Persistence** — sample cadence, flush cadence, and debug logging.
- **Sensor Freshness** — stale-value and timestamp-skew limits.
- **Core Filters** — low wind, head-to-wind, anchored-speed, and maximum wind/boat-speed limits.
- **Stability and Maneuvers** — turn, gust, acceleration, cooldown, and steady-window limits.
- **Engine Heuristic** — low-wind movement checks used when definitive engine-state evidence is unavailable; ambiguous
  RPM in the idle band does not disable the heuristic.

Values are checked before saving and persist in AvNav plugin configuration; overlapping saves are rejected, and a failed
host write leaves the live runtime unchanged. Heel minimum/maximum and maneuver cooldown/stability-window relationships
are validated together. The runtime parser also rejects malformed boolean values and non-finite numbers from corrupted
or manually edited persisted settings. See [Configuration](documentation/user/configuration.md) for defaults and ranges.

## What are presets?

A preset is a saved TWA/TWS grid for viewing or exporting; it never changes learned data. Built-ins cover starboard
`180°`, port `180°`, full `360°`, and the Windy Passage Planner format. Custom presets may use TWA values through
`359°`.

## What do the rejected counts mean?

Rejected counts explain why samples were excluded. Common causes are missing/stale instruments, implausible ranges, low
wind, maneuvers, instability, anchoring, pausing, or suspected engine use. Rejections are normal; look for accepted
samples during steady sailing. See [rejection rules](documentation/filters/rejection-rules.md) for every code and
default threshold.

## What does percentile mean?

Each polar cell contains multiple accepted speeds. The percentile chooses one after sorting them from slow to fast:

```text
Accepted STW values: 1.5, 2.6, 5.4, 5.6, 5.7, 5.9, 6.1, 6.3, 6.4, 6.6, 6.8, 7.0 kt
65th percentile: about 6.3 kt
```

The default 65th percentile represents good normal sailing. Lower values produce a more conservative polar; higher
values produce a faster, more optimistic one. It is calculated separately for every cell.

## When should I pause recording?

Pause whenever the current sailing should not influence your polar, especially when:

- motoring or motor-sailing
- deliberately sailing badly trimmed
- sailing with known bad instrument data
- unusual reefing or sail setup that you do not want mixed into the main polar
- strong waves or shallow water if you do not want those conditions reflected
- drifting, waiting, docking, anchoring, or leaving the harbor

Record during representative, reasonably trimmed, steady sailing with calibrated instruments.

## Known limitations

Without configured Enhanced Rules, Polar Recorder cannot reliably detect:

- engine use in all cases
- waves and swell
- shallow water
- reefing and sail changes
- dirty bottom or unusual load
- bad sail trim
- wrong instrument calibration

Treat the result as "how my boat performed in the data I allowed it to record," not a manufacturer target. Port and
starboard samples remain separate, so full-circle confidence takes longer to build but preserves real differences.
Because the anchored check prefers fresh SOG, strong adverse current can make genuine sailing look stationary and
exclude those samples.

## Where is the data stored?

The learned polar is stored in:

```text
<plugin_dir>/data/polar.json
```

User export presets are stored in:

```text
<plugin_dir>/data/presets.json
```

AvNav plugin settings are stored by AvNav, not inside `polar.json`.

## Configuration

Most users only need AvNav's plugin enable switch and the Pause/Resume button.

Advanced settings cover:

- sampling interval
- minimum wind speed
- stale-data timeout
- maneuver cooldown
- stability window
- debug logging
- optional Enhanced Rule signals and thresholds

See [Configuration](documentation/user/configuration.md) for defaults, ranges, and the full parameter list.

## Troubleshooting

### The polar is empty

Common causes:

- not enough sailing time yet
- TWA, TWS, or STW is missing in AvNav
- recording is paused, or the plugin is disabled in AvNav
- the boat has mostly been motoring, maneuvering, drifting, or sailing in very low wind
- the plugin is still warming up its stability checks

Open the Status tab and look at the current decision and top rejection reasons.

### I see many rejected samples

That can be normal. The plugin samples often, and it is intentionally picky. Look for accepted samples during steady
sailing. If accepted stays at zero, check instrument data first.

### Export has blank cells

Blank cells mean not enough accepted data exists for that TWA/TWS cell. Sail more in those conditions, or turn off
high-confidence export if you only need a rough table.

### Timeline times look odd after startup

If the AvNav computer corrects its clock after boot, timeline buckets can briefly look strange. They age out
automatically.

## More documentation

- [Configuration](documentation/user/configuration.md)
- [Export and import](documentation/user/export-import.md)
- [Troubleshooting](documentation/user/troubleshooting.md)
- [Documentation index](documentation/TABLEOFCONTENTS.md)

## For developers

Runtime code is Python 3.9+ standard-library only. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and release
workflows; run `npm run check:all` before handoff.

For local viewer/API work without AvNav, use the mock server:

```sh
python tools/mock-server.py
```
