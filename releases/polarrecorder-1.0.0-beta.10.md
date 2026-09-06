# Polar Recorder 1.0.0-beta.10

**Status:** Current.

## Overview

This beta adds routing POL downloads, more detailed recording diagnostics, and stricter sample validation. It continues
the 1.0.0 beta series and changes several filtering and confidence settings described below.

## Key Details

- Download a routing POL for NavimetriX-compatible apps from its own Export card. The fixed 30-180 degree table combines
  port and starboard observations for export without changing stored data. Wind columns above the configured maximum
  true wind are omitted. Incomplete tables report the number of missing cells instead of filling gaps with estimates.
- Routing POL and tack-aware CSV have independent percentile and confidence controls. CSV retains its grid editor,
  presets, preview, and full-circle port/starboard detail.
- Status now shows the individual conditions that triggered rejection, alongside rejection reasons. Optional-rule
  badges distinguish unavailable and invalid signals; debug logging provides structured recording diagnostics.
- A startup warning explains when Engine RPM filtering is not confirmed active. Dismiss it for the current page or
  choose Never show again to remember the choice in that browser.
- Validation handles missing or invalid timestamps, instrument gaps, maneuver history, and optional signals more
  strictly. Anchored detection prefers fresh speed over ground, and SOG/STW consistency checks detect discrepancies in
  either direction. Invalid current drift cannot excuse a speed discrepancy.
- Settings saves validate related limits together and preserve active settings if AvNav cannot save the update.

### Upgrade notes

- Restart AvNav or reload plugins after installing. Existing learned data and presets remain readable; older backups
  without the new diagnostic counts remain supported.
- Normal chart and export cells now require 30 accepted samples. Chart cells with 30-49 samples have reduced emphasis;
  high-confidence export defaults to 50 samples, with an allowed range of 50-100. Previously saved lower export floors
  are raised to 50 on load. Some previously visible cells may remain blank until more samples are recorded.
- The separate Engine State rule and its settings have been removed. If you relied on it, configure the Engine RPM
  source and idle ceiling, and pause recording while motoring when RPM filtering is unavailable.
- Heel input now uses radians and defaults to `gps.signalk.navigation.attitude.roll`. A previously blank heel source
  adopts that default. Check any custom heel source for the correct units; disable the heel rule if it is unwanted.
- The default anchored-speed threshold increases from 0.3 to 0.5 knots; an existing saved threshold is retained.
  Because anchored detection now prefers fresh SOG, sailing against strong current may be excluded as stationary.
- Blank saved source keys with built-in defaults are restored to those defaults. Review Data Sources and Enhanced Rules
  after upgrading, especially if blank keys were previously used to prevent a rule from operating.

## Related

- [README](../README.md)
- [Configuration](../documentation/user/configuration.md)
- [Export and import](../documentation/user/export-import.md)
- [Manual AvNav validation checklist](../documentation/guides/manual-avnav-validation.md)
