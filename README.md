# Polar Recorder

Polar Recorder is an AvNav plugin that learns how fast your own boat usually sails at different wind angles and wind speeds.

In plain sailor language: it watches your instruments while you sail, throws away readings that look unusable, and slowly builds a polar diagram and CSV table from your real boat instead of from a brochure.

<img width="1920" height="937" alt="image" src="https://github.com/user-attachments/assets/e4276264-305d-48bd-9ac3-df27538e51f0" />

## Why would I use it?

A polar tells you the boat speed through water you can normally expect for a given:

- true wind angle, for example reaching at 90 degrees
- true wind speed, for example 12 knots

That is useful when you want to:

- compare your real performance with what you expected
- export a boat-specific polar to tools such as Windy (Passage Planner Plugin)
- plan passages with numbers from your own boat
- see whether your instruments and sailing data look believable
- build a better polar over time without manually writing down numbers

Polar Recorder is not a sail-trim teacher and not a weather router. It records and filters data. The better your instruments and sailing habits, the better the learned polar becomes.

## What does it need?

Polar Recorder uses three AvNav values:

| Short name | Meaning | AvNav source |
|---|---|---|
| TWA | True wind angle. Where the true wind comes from, relative to the boat. | `gps.trueWindAngle` |
| TWS | True wind speed. The real wind speed after AvNav has calculated true wind. | `gps.trueWindSpeed` |
| STW | Speed through water. Usually from the log or paddlewheel. | `gps.waterSpeed` |

TWS and STW are shown and stored in knots. TWA is shown in degrees.

For core learning the plugin uses only true wind angle/speed and speed through water. Speed over ground, apparent wind, engine RPM, and depth are read only by the optional Enhanced Rules (see [Enhanced Rules (optional signals)](#enhanced-rules-optional-signals)); waves and sail configuration are not used.

## Quick Start

1. Install the plugin in AvNav.
2. Make sure AvNav receives TWA, TWS, and STW from your instruments.
3. Open the Polar Recorder User App from AvNav.
4. Leave recording enabled while you are sailing normally.
5. Pause recording when motoring, motor-sailing, maneuvering for a long time, or sailing in conditions you do not want in your polar.
6. After enough sailing, open the Polar tab to view the learned polar.
7. Open the Export tab to download a CSV.

The first minutes can look empty. That is normal. The plugin waits for stable, usable samples before it trusts the data.

## Installation

Linux AvNav servers can install or update from the latest GitHub Release with:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh)
```

The installer targets AvNav user plugins by default. It detects existing user plugin installs, AvNav service data directories, and documented Linux defaults before writing files. For custom setups, pass the AvNav data directory or the final plugin directory:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh) --data-dir <AVNAV_DATA_DIR>
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh) --plugin-dir <AVNAV_PLUGIN_DIR>/polarrecorder
```

Pinned release example:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh) --version 1.0.0
```

Beta prerelease example:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/metzger100/polarrecorder/main/install.sh) --version 1.0.0-beta.1
```

The same manual version can be supplied as `POLARRECORDER_VERSION=1.0.0-beta.1`.

Manual install:

1. Download the latest release zip from GitHub Releases (or from `releases/` in this repository).
2. Extract it into your AvNav plugin directory so you get `<AVNAV_PLUGIN_DIR>/polarrecorder/`.
3. Restart AvNav.
4. Open the Polar Recorder User App from AvNav.

When using AvNav's plugin upload page, upload the release zip and let AvNav extract it.

AvNav documents user plugins under the data directory's `plugins` folder and system plugins under `/usr/lib/avnav/plugins`. Use the installer `--system` option only when you intentionally want a system plugin install.

For a user-plugin install, AvNav serves the viewer under its runtime plugin name:
`/plugins/user-polarrecorder/viewer/viewer.html`. If that direct URL opens but
Polar Recorder is missing from AvNav's User Apps/AddOn selection, the plugin and
viewer are installed; restart AvNav or hard-refresh the AvNav client. Polar
Recorder registers its AddOn entry from a single place so it appears on every
AvNav variant without showing a duplicate. The plugin backend (`plugin.py`)
registers the viewer through AvNav's `registerUserApp` API when it starts; this
is the path every core with a Python plugin API honors, and each core surfaces
the resulting AddOn in its addon list. Because only the backend knows the real
install prefix, it builds the viewer URL from `getBaseUrl()`, so the same
package works whether it is installed as a user or system plugin. The frontend
adapters (`plugin.js`, `plugin.mjs`) and `plugin.json` do not register the app —
cores that read those paths would register a second identical AddOn alongside
`plugin.py`. `plugin.json` carries only the release version.

## How recording works

Every sample goes through a simple decision:

| Decision | Meaning | Does it change the polar? |
|---|---|---|
| Accepted | The data looked like usable sailing data. | Yes |
| Rejected | The data looked wrong, incomplete, too unstable, or not useful. | No |
| Quarantined | The data looked like possible sailing, but suspicious enough to keep out. | No |

Rejected and quarantined samples are not failures. They are the plugin protecting your polar from bad data.

Examples:

- If a wind instrument stops sending data, the sample is rejected.
- If you tack or gybe and values change quickly, the sample is rejected until things settle again.
- If the boat is moving fast in very little true wind, the sample is quarantined because the engine may be involved.
- If you are sailing steadily with fresh instrument data, the sample can be accepted.

Only accepted samples are used to learn boat speed.

## What the tabs show

### Polar

The Polar tab shows the learned polar diagram.

- The colored curves are true wind speed bands, for example 8 kt, 10 kt, or 12 kt.
- The angle around the diagram is TWA.
- The distance from the center is learned STW.
- Dots appear only where there is enough accepted data.
- Empty areas mean "not enough trusted data yet", not "the boat cannot sail there".

The Preset selector changes the TWA and TWS grid used for viewing. It does not delete or change the learned data.

With the `Default (Starboard 180°)` preset (the default), the diagram shows the starboard half only, exactly as a classic symmetric polar. The `Default (Port 180°)` preset is its mirror image, showing only the port (left) half from `180°` to `360°`. With a `360°` preset, the diagram draws both halves with absolute-degree labels (`210°`, `240°`, `270°`, `300°`, `330°`) and closes the curve around the full circle, so genuine port/starboard differences are visible instead of being averaged together.

### Status

The Status tab is the "what is happening right now?" page.

It shows:

- Recording, Paused, or No Data
- the current TWA, TWS, and STW values
- whether those values are fresh or stale
- the latest decision, such as `accepted` or `rejected: reject_low_wind`
- counters for Seen, Accepted, Rejected, and Quarantined samples
- the most common rejection reasons
- when the learned file was last written into the save file

The small colored strip is a quick recent-history view. Green means accepted, red means rejected, and the quarantine color means suspicious data was kept out. Tap or click a small block to see the reason.

### Timeline

The Timeline tab shows the recent history in one-minute buckets.

Think of each minute as a small logbook entry:

- how many samples were accepted
- how many were rejected
- how many were quarantined
- which reasons appeared in that minute

This helps answer questions like:

- "Did it record during the last hour?"
- "Why is my polar not growing?"
- "Did the engine-suspected quarantine happen while I was motoring?"
- "Are my instruments sending stale or missing values?"
- "Did the plugin notice that I anchored?"

### Export

The Export tab creates a CSV polar table.

You can:

- preview the CSV
- download a CSV
- choose or edit the TWA grid
- choose or edit the TWS grid
- save your own export presets
- export only high-confidence cells

Blank CSV cells mean there was not enough accepted data for that angle and wind speed.

A `360°` preset (or any custom grid with angles above `180°`) exports true port/starboard asymmetry, emitting TWA rows above `180°`. Note that a `360°` CSV is not Windy.com-importable by design; use the `Windy Passage Planner` preset for Windy import.

### Settings

The Settings tab groups maintenance and configuration actions into four cards:

**Learned Data**

- Download saves all learned data (bins, counters, and metadata) as a JSON file.
- Restore replaces the learned model and counters from a learned-data backup.
- Reset clears the learned model and counters.

**Presets**

- Download saves your export presets as a JSON file.
- Restore replaces your export presets from a presets backup.

Reset is destructive. Download the learned data first if you may want to inspect the old data later.

#### Restoring a backup

You can restore either backup from the Settings tab:

1. Click **Choose Backup File** in the matching restore card and pick a file you
   downloaded earlier.
2. Type `RESTORE` in the confirmation field.
3. Click **Restore Learned Data** or **Restore Presets**.

Both restores **replace** their target: a learned-data restore overwrites all
learned data and counters; a presets restore replaces all of your saved presets
(built-in presets are never touched). They are fail-closed — a wrong file, corrupted
JSON, a backup from a different bin grid (learned data), a too-new backup, a reserved
preset name, or an out-of-range value is rejected with a clear message and nothing
changes.

Limitations:

- Restore is replace-only; there is no merge.
- Backups are capped at 4 MiB.
- A learned-data backup must match this build's bin grid to import.
- A presets backup's TWS values must fit the current `max_tws` setting.

### Enhanced Rules (optional signals)

The **Enhanced Rules** card lets you use optional boat signals beyond the three
core signals (true wind angle/speed and speed through water) to reject samples those signals prove
are unrepresentative. Each rule fires only when its switch is on, its store key(s) are set, and a
fresh value is present; otherwise it does nothing.

The six rules are:

- **Engine RPM** — rejects when RPM is above an idle ceiling (you are motoring).
- **Engine state** — rejects when an engine-state signal reads "on". The source can be a boolean,
  an RPM, or an alternator voltage; one threshold interprets all three.
- **Shallow water** — rejects when depth/keel clearance is below a floor (shallow-water squat).
- **SOG / STW paddlewheel** — rejects when speed through water reads implausibly low versus speed
  over ground *and* the reported current drift is too small to explain the gap (a failing
  paddlewheel). Honest strong following current is never rejected.
- **True-wind cross-check** — recomputes true wind from apparent wind and boat speed and rejects
  when it disagrees with the reported true wind (a miscalibrated wind sensor).
- **Heel band** — rejects when heel is outside a configured range (over/underpowered). The lower
  bound defaults to 0, so multihulls are unaffected by default.

There is **no** current-strength reject: a uniform current shifts true wind speed and boat speed
together in the water frame and does not distort a polar point, so current drift is only used to
corroborate the paddlewheel check. Heading and COG are also read to harden maneuver detection — a
true-wind shift with a steady heading/COG is no longer mistaken for a turn.

All switches default **on**. The depth, SOG, current-drift, apparent-wind, heading, and COG keys
are prefilled with standard AvNav store keys, so those rules **activate automatically on upgrade**
for any boat that already publishes them — no setup needed. To opt out, switch a rule off or clear
its key in the Enhanced Rules card. The genuinely custom signals (engine RPM, engine state, heel)
stay inactive until you map a key, because AvNav core has no standard key for them. Each key field
is a dropdown of the store keys currently available; SignalK keys appear here as `gps.signalk.*`
(for example `gps.signalk.propulsion.0.revolutions` for RPM or `gps.signalk.navigation.attitude.roll`
for heel), and a key that is already configured stays selected even when it is not publishing right
now. Each rule's switch matches the toggle used on the Export tab. A live status badge shows whether
each rule is `active`, `disabled`, or inactive (no key set, key not in the store, or value stale).
Settings are saved from the card and persist in AvNav plugin configuration.

### Advanced Settings

The **Advanced Settings** card sits below Enhanced Rules and exposes safe runtime and
recording-filter settings that most often need boat-specific tuning. They are grouped as:

- **Sampling and Persistence** — sample cadence, flush cadence, and debug logging.
- **Sensor Freshness** — stale-value and timestamp-skew limits.
- **Core Filters** — low wind, head-to-wind, anchored-speed, and maximum wind/boat-speed limits.
- **Stability and Maneuvers** — turn, gust, acceleration, cooldown, and steady-window limits.
- **Engine Heuristic** — low-wind movement checks used when no engine signal is configured.

Each field uses a readable label and a short description. Values are checked against their allowed
range before saving and persist in AvNav plugin configuration. Export percentile and high-confidence
sample floors remain in the Export tab instead of being duplicated here.

## What are presets?

A preset is just a saved grid for viewing or exporting the polar.

It says:

- which TWA angles should be shown or exported
- which TWS wind speeds should be shown or exported

Example of a simple custom grid:

- TWA: `0, 30, 60, 90, 120, 150, 180`
- TWS: `4, 6, 8, 10, 12, 14, 16, 20, 25`

There are four built-in presets. They cannot be deleted or overwritten, and all four share the same TWS bands (`4, 6, 8, 10, 12, 14, 16, 20, 25`):

- `Default (Starboard 180°)` is the default view and export grid. It covers the starboard half only, `0°` to `180°` in `15°` steps (`0, 15, 30, ... , 180`). This behaves like a classic symmetric polar: only starboard samples are shown.
- `Default (Port 180°)` is the mirror image, covering only the port half, `180°` to `345°` in `15°` steps (`180, 195, ... , 345`). Only port samples are shown; starboard data is excluded rather than mirrored in.
- `Default (360°)` covers the full circle, `0°` to `345°` in `15°` steps (`0, 15, 30, ... , 345`, wrapping at `360°` back to `0°`). It draws and exports true port/starboard asymmetry so you can compare both tacks directly.
- `Windy Passage Planner` (internal name `windy`) keeps the irregular Windy.com angles `0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180` for importing into Windy. It is no longer the default.

You can create your own presets if another program or your own habits need different angles or wind speeds. Custom and saved presets may use TWA angles above `180°` (up to `359°`) to capture port-side data.

Presets do not change what the plugin has learned. They only change how the learned data is displayed or exported.

## What do the rejected counts mean?

Rejected counts are diagnostic counters. They tell you why samples were not used for learning.

The names look technical because they are also used internally and in API data.
Here is the plain-language version. The thresholds shown are the defaults; many
of them can be changed in AvNav plugin settings.

| Reason | Plain meaning | Default rule |
|---|---|---|
| `reject_missing_twa` | No true wind angle was available. | TWA must be present. |
| `reject_missing_tws` | No true wind speed was available. | TWS must be present. |
| `reject_missing_stw` | No speed through water was available. | STW must be present. |
| `reject_non_finite_twa` | TWA was not a usable number. | TWA must be a real number, not empty, infinite, or invalid. |
| `reject_non_finite_tws` | TWS was not a usable number. | TWS must be a real number, not empty, infinite, or invalid. |
| `reject_non_finite_stw` | STW was not a usable number. | STW must be a real number, not empty, infinite, or invalid. |
| `reject_stale_twa` | TWA was too old. | TWA must be at most 3.0 seconds old. |
| `reject_stale_tws` | TWS was too old. | TWS must be at most 3.0 seconds old. |
| `reject_stale_stw` | STW was too old. | STW must be at most 3.0 seconds old. |
| `reject_age_skew` | TWA, TWS, and STW did not arrive at similar times. | Their timestamps must be less than 2.0 seconds apart. |
| `reject_twa_range` | TWA was outside the valid wind-angle range. | TWA must be 0-360 deg. |
| `reject_tws_range` | TWS was outside the allowed wind-speed range. | TWS must be 0-60 kt by default. `max_tws` can be set from 20-60 kt. |
| `reject_stw_range` | STW was outside the allowed boat-speed range. | STW must be 0-40 kt by default. `max_stw` can be set from 10-80 kt. |
| `reject_head_to_wind` | The boat was too close to head-to-wind for useful polar learning. | Absolute TWA must be at least 10 deg. |
| `reject_low_wind` | The true wind was too light for useful learning. | TWS must be at least 3.0 kt. |
| `reject_anchored` | The boat looked stopped or anchored. | STW below 0.3 kt with wind present is rejected. |
| `reject_twa_roc` | Wind angle changed too quickly, often during a tack or gybe. | TWA change must be at most 15 deg/s. |
| `reject_tws_roc` | Wind speed jumped too quickly. | TWS change must be at most 10 kt/s. |
| `reject_stw_roc` | Boat speed changed too quickly. | STW change must be at most 2 kt/s. |
| `reject_maneuver_cooldown` | The plugin is waiting after a maneuver before trusting samples again. | After a TWA maneuver, samples are rejected for 30 seconds. |
| `reject_warming_up` | The plugin is filling its stability window after startup or resume. | It needs 15 seconds of previous data before stability can be judged. |
| `reject_unstable` | Recent wind or boat-speed values were too unstable. | Over the 15-second window, changes must stay below TWA 20 deg, TWS 10 kt, and STW 4 kt. |
| `reject_user_paused` | Recording was paused in the Polar Recorder viewer. | Pause/Resume button is set to paused. |
| `quarantine_engine_suspected` | Low wind plus high boat speed looked like possible engine use. | TWS below 5.0 kt and STW above 3.0 kt is quarantined. |

If you see many rejected samples, it does not automatically mean something is wrong. Sailing data is messy. The important question is whether accepted samples appear while you are sailing steadily with good instruments.

## What does accepted mean?

Accepted means the sample passed the checks and was added to the learned model.

The plugin stores accepted samples in small TWA/TWS bins. One bin means one small area of the polar, for example "about 90 deg TWA in about 12 kt TWS". For each bin it keeps the accepted boat-speed readings.

## What does percentile mean?

When Polar Recorder draws the polar or exports a CSV, it must choose one boat speed for each TWA/TWS cell. But after a few sails, one cell may contain many accepted speeds: some slower, some normal, some faster.

The percentile setting says which speed to choose after sorting those accepted speeds from slow to fast.

Example for the cell TWA 60°/TWS 9kn:

```text
Accepted STW values: 1.5, 2.6, 5.4, 5.6, 5.7, 5.9, 6.1, 6.3, 6.4, 6.6, 6.8, 7.0 kt
65th percentile: about 6.3 kt
```

That means about 65% of the accepted samples in that cell were at or below 6.4 kt, and about 35% were faster.

So the default 65th percentile is deliberately a bit above the middle. It tries to represent "good normal sailing" rather than "average including every slow moment" or "the single best lucky speed". Lower percentiles create a more conservative, slower polar. Higher percentiles create a more optimistic, faster polar.

The percentile is applied separately to each polar cell. It is not calculated over the whole trip.

## When should I pause recording?

Pause recording when the current sailing does not represent the polar you want.

Good times to pause:

- motoring or motor-sailing
- deliberately sailing badly trimmed
- sailing with known bad instrument data
- unusual reefing or sail setup that you do not want mixed into the main polar
- strong waves or shallow water if you do not want those conditions reflected
- Optional: drifting, waiting, docking, anchoring, or leaving the harbor

Good times to record:

- steady sailing
- trimmed reasonably well
- calibrated wind and water-speed instruments
- representative conditions for how you want to use the polar

## Known limitations

Polar Recorder only sees TWA, TWS, and STW. Some real sailing situations can look like normal data from those three numbers alone.

It cannot reliably detect:

- engine use in all cases
- waves and swell
- current
- shallow water
- reefing and sail changes
- dirty bottom or unusual load
- bad sail trim
- wrong instrument calibration

Because of that, the learned polar is best understood as "how my boat usually performed in the data I allowed it to record", not a perfect manufacturer-style target polar.

Port and starboard are no longer folded together. A single-side `180°` view (starboard or port) counts only that side's samples for each cell, so per-bin sample counts are lower than in older versions that mirrored port data onto starboard. Confidence therefore builds more slowly per side, and a `360°` view splits the data across twice as many cells. This is intentional: it keeps genuine port/starboard differences honest instead of averaging them away.

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

Advanced settings are managed through the Settings tab and AvNav plugin configuration. They
control things such as:

- sampling interval
- minimum wind speed
- stale-data timeout
- maneuver cooldown
- stability window
- debug logging
- the optional **Enhanced Rules** signals and their store keys/thresholds (also editable from the
  Settings tab; several activate automatically on upgrade — see [Enhanced Rules](#enhanced-rules-optional-signals))

These remain Python 3.9 standard-library only with no target-device `pip install`: the enhanced
rules add no new runtime dependency.

See [Configuration](documentation/user/configuration.md) for the full parameter list.

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

That can be normal. The plugin samples often, and it is intentionally picky. Look for accepted samples during steady sailing. If accepted stays at zero, check instrument data first.

### Export has blank cells

Blank cells mean not enough accepted data exists for that TWA/TWS cell. Sail more in those conditions, or turn off high-confidence export if you only need a rough table.

### Timeline times look odd after startup

If the AvNav computer corrects its clock after boot, timeline buckets can briefly look strange. They age out automatically.

## More documentation

- [Configuration](documentation/user/configuration.md)
- [Export and import](documentation/user/export-import.md)
- [Troubleshooting](documentation/user/troubleshooting.md)
- [Documentation index](documentation/TABLEOFCONTENTS.md)

## For developers

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local development setup (virtual environment, dev tooling, and git hooks).

Runtime code must remain dependency-free on target devices. Development tooling is allowed and is checked by:

```sh
tools/check-all.sh
```

The same full gate is available through npm so agents do not accidentally run only the viewer subgate:

```sh
npm run check:all
```

Targeted Node.js viewer and documentation checks run through `npm run check:js:all`.

For local viewer/API work without AvNav, use the mock server:

```sh
python tools/mock-server.py
```
