# Polar Recorder 1.0.0 Beta 1

First beta release of Polar Recorder as an installable AvNav plugin.

## Highlights

- Learns a boat-specific sailing polar from AvNav true wind angle, true wind speed, and speed-through-water data.
- Filters missing, stale, unstable, implausible, maneuvering, low-wind, anchored, paused, and disabled samples before they can affect the learned polar.
- Quarantines low-wind/high-speed samples that look like possible engine use instead of adding them to the model.
- Provides the Polar Recorder User App with Polar, Status, Timeline, Export, and Settings tabs.
- Exports Windy-compatible semicolon CSV files, supports custom TWA/TWS export grids, and saves user export presets.
- Includes JSON backup of the learned `polar.json` data. Restore/import is visible as a future feature but is not implemented in this beta.
- Registers AvNav editable parameters for recording, sampling, validation thresholds, export percentile, high-confidence export floor, flush interval, and debug logging.

## Upgrade Notes

- This is the first beta release, so there is no migration from an earlier release.
- Extract the release zip into `<DATADIR>/plugins/` or upload it through AvNav's plugin page; the zip contains the `polarrecorder/` plugin directory.
- Polar quality depends on calibrated TWA, TWS, and STW data and on pausing recording when motoring or sailing in conditions you do not want in the learned polar.
