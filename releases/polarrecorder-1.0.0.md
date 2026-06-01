# Polar Recorder 1.0.0 Release Notes

## Summary

Polar Recorder 1.0.0 is the initial AvNav plugin release for learning a sailing
polar from live TWA, TWS, and STW data. It records representative sailing data,
filters poor-quality samples, and exposes the learned polar through an AvNav
viewer app and CSV/JSON export endpoints.

## Installation

Manual installation:

1. Create `<DATADIR>/plugins/polarrecorder/`.
2. Extract `polarrecorder-1.0.0.zip` directly into that directory.
3. Restart AvNav or reload the plugin.

AvNav upload installation uses the same zip. The archive has no outer wrapper
directory; AvNav extracts the runtime files directly into the existing
`polarrecorder` plugin directory.

## Included Runtime Files

The zip contains no wrapper directory. It includes only:

- `plugin.py`, `plugin.mjs`, `plugin.css`, `plugin.json`, and `icon.svg`
- `viewer.html`, `viewer.css`, and all root viewer/helper `*.js` files
- the `polarrecorder/` Python package
- `README.md`

It excludes tests, tools, documentation, execution plans, data, release sources,
reference material, caches, bytecode, virtual environments, and development
configuration files.

## Checks Performed

The release artifact was generated with:

```sh
python tools/release-zip.py
```

It was validated with:

```sh
python tools/check-release.py releases/polarrecorder-1.0.0.zip
```

The source tree was also checked with the documentation and full quality gates
used by the project.

## Key Features

- Learns a practical sailing polar from live AvNav instrument data.
- Rejects stale, missing, implausible, unstable, and maneuver-adjacent samples.
- Uses percentile histograms and quarantine handling to reduce poisoning from
  marginal data.
- Provides an AvNav viewer with Polar, Status, Timeline, Export, and Settings
  tabs.
- Exports Windy-compatible CSV, custom inline grids, saved presets, and JSON
  backup data.
- Ships as a dependency-free Python 3.9+ stdlib plugin with static browser
  assets.

## Known Limitations

Some conditions are not reliably detectable from TWA/TWS/STW alone, including
motor-sailing, waves, current, shallow water, reefing, and bad sail trim. See
`documentation/user/troubleshooting.md` in the source tree for recovery guidance
and known edge cases.
