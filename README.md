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

The plugin does not currently use speed over ground, apparent wind, engine RPM, depth, waves, or sail configuration.

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

Manual installation:

1. Download the release zip from GitHub Releases or from `releases/` in this
   repository.
2. Extract the release zip into `<DATADIR>/plugins/` on the AvNav system. The
   zip contains the `polarrecorder/` plugin directory.
4. Restart AvNav or reload plugins from the AvNav plugin page.

When using AvNav's plugin upload page, upload the release zip and let AvNav extract it.

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

### Status

The Status tab is the "what is happening right now?" page.

It shows:

- Recording, Paused, Disabled, or No Data
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

### Settings

The Settings tab contains maintenance actions:

- JSON Backup downloads the full learned data file.
- Restore JSON is shown as a future feature, but restore/import is not implemented yet.
- Reset Learned Polar clears the learned model and counters.

Reset is destructive. Use JSON Backup first if you may want to inspect the old data later.

## What are presets?

A preset is just a saved grid for viewing or exporting the polar.

It says:

- which TWA angles should be shown or exported
- which TWS wind speeds should be shown or exported

Example of a simple custom grid:

- TWA: `0, 30, 60, 90, 120, 150, 180`
- TWS: `4, 6, 8, 10, 12, 14, 16, 20, 25`

The built-in `windy` preset is meant for Windy Passage Planner. It cannot be deleted. It uses:

- TWA: `0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180`
- TWS: `4, 6, 8, 10, 12, 14, 16, 20, 25`

You can create your own presets if another program or your own habits need different angles or wind speeds.

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
| `reject_disabled` | Recording was disabled in AvNav plugin settings. | `record_enabled` is off in AvNav settings. |
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

Most users only need the recording switch and the Pause/Resume button.

Advanced settings are managed through AvNav editable plugin parameters. They control things such as:

- sampling interval
- minimum wind speed
- stale-data timeout
- maneuver cooldown
- stability window
- export percentile
- high-confidence export sample floor
- debug logging

See [Configuration](documentation/user/configuration.md) for the full parameter list.

## Troubleshooting

### The polar is empty

Common causes:

- not enough sailing time yet
- TWA, TWS, or STW is missing in AvNav
- recording is paused or disabled
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

Runtime code must remain dependency-free on target devices. Development tooling is allowed and is checked by:

```sh
tools/check-all.sh
```

The full gate runs Python linting/format checks, `mypy --strict`, the pytest suite with coverage, release dry-run validation, and all Node.js checks via:

```sh
npm run check:all
```

For local viewer/API work without AvNav, use the mock server:

```sh
python tools/mock-server.py
```
