# Polar Recorder 1.0.0-beta.8

This beta is a maintenance release that hardens the plugin and viewer while preserving the existing Polar Recorder
data, configuration, and user workflows.

## Highlights

- AvNav store access now passes through a dedicated integration adapter, keeping the existing TWA, TWS, STW, and
  optional-signal keys and units unchanged.
- The static viewer has been reorganized into smaller runtime modules and stylesheets while retaining the existing
  status, chart, export, restore, preset, and settings behavior.
- Release packaging and validation now apply stricter checks to the runtime-only AvNav plugin archive before it is
  published.

## Upgrade notes

After updating, restart AvNav or reload plugins from the AvNav plugin page. No polar data, presets, configuration, or
backup migration is required.
