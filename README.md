# Polar Recorder

**Status:** Current.

## Overview

Polar Recorder is an AvNav plugin that learns a sailing polar from live vessel
data. It records true wind angle, true wind speed, and speed through water,
filters out poor-quality samples, and builds a practical polar table from the
conditions your boat actually sails in.

The plugin runs inside AvNav with Python 3.9+ standard library code only. The
viewer is served as static browser files: no target-device package install,
bundler, or build step is required.

## Key Details

### Installation

Manual installation:

1. Download the release zip from GitHub Releases or from `releases/` in this repository.
2. Create `<DATADIR>/plugins/polarrecorder/` on the AvNav system if it does not
   already exist.
3. Extract the release zip directly into that directory.
4. Restart AvNav or reload plugins from the AvNav plugin page.

The zip is intentionally built without an outer wrapper directory. Its root
contains `plugin.py`, `plugin.json`, the `viewer/` assets, the
`server/polarrecorder/` Python package. This matches AvNav's upload flow, which
extracts the uploaded zip into the existing plugin directory.

When using AvNav's plugin upload UI, upload the release zip for the
`polarrecorder` plugin directory and let AvNav extract it. Do not upload a zip
that contains another top-level `polarrecorder/` wrapper around the files.

### Configuration

Configuration is managed through AvNav editable plugin parameters. The most
important settings are the recording switch, sampling interval, validation
thresholds, flush interval, export percentile, and export confidence floor.

See [Configuration](documentation/user/configuration.md) for the complete
parameter list, defaults, ranges, and hot-swap behavior.

### Usage

Open the Polar Recorder user app from AvNav. The viewer has these tabs:

- Polar: learned speed curves by TWS band, with preset grid selection.
- Status: live instrument values, recording state, counters, and rejection
  reasons.
- Timeline: recent accepted, rejected, quarantined, paused, and disabled sample
  buckets.
- Export: Windy CSV export and custom/user preset management.
- Settings: JSON Backup, a disabled future Restore JSON affordance, and Reset
  Learned Polar.

The plugin learns gradually. Leave recording enabled while sailing normally with
calibrated instruments. It rejects stale, missing, unstable, implausible, and
post-maneuver data before updating the learned polar.

### Screenshots

Screenshots are intentionally left as a release-page placeholder. Add current
AvNav device screenshots before wider public distribution.

### Known limitations

Polar Recorder only sees the signals AvNav provides to it. Some sailing
conditions cannot be reliably detected from TWA/TWS/STW alone, including
motor-sailing, waves, current, shallow water, reefing, and bad sail trim.

See [Troubleshooting](documentation/user/troubleshooting.md) for recovery
behavior, clock-correction notes, export edge cases, and known limitations.

### Development setup

Runtime code must remain dependency-free on target devices. Development tooling
is allowed and is checked by:

```sh
tools/check-all.sh
```

The full gate runs Python linting/format checks, `mypy --strict`, the pytest
suite with coverage, release dry-run validation, and all Node.js checks via:

```sh
npm run check:all
```

For local viewer/API work without AvNav, use the mock server:

```sh
python tools/mock-server.py
```

## Related

- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Documentation index](documentation/TABLEOFCONTENTS.md)
- [Configuration](documentation/user/configuration.md)
- [Export and import](documentation/user/export-import.md)
- [Troubleshooting](documentation/user/troubleshooting.md)
