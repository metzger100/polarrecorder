# AvNav Keys and Units

**Status:** Current | Store key and unit contract for learning input.

## Overview

Polar Recorder learns from three AvNav store values: true wind angle, true wind speed, and speed through water. This document records the self-contained key, unit, and timestamp behavior the plugin depends on.

## Key Details

Core learning keys:

| Polar field | AvNav store key | AvNav unit | Polar Recorder unit after read | Code owner |
|---|---|---:|---:|---|
| TWA | `gps.trueWindAngle` | degrees | degrees | `server/polarrecorder/reader.py` |
| TWS | `gps.trueWindSpeed` | m/s | knots | `server/polarrecorder/sample.py` |
| STW | `gps.waterSpeed` | m/s | knots | `server/polarrecorder/sample.py` |

Store read contract:

- `StoreReader` calls `api.getSingleValue(key, includeInfo=True)` for all three keys.
- With `includeInfo=True`, Polar Recorder expects an entry object with `value` and `timestamp`.
- Missing, expired, or unavailable store entries are represented as `None`.
- R1 and R2 run before `Sample` construction so missing and non-finite values can produce granular reason codes.
- Timestamps are monotonic store timestamps and feed freshness, age-skew, and stale-value checks.
- `ReadResult.timestamp_wall` is display/diagnostic time; validation age math uses monotonic timestamps.

Unit conversion:

- TWA is kept in degrees and normalized later for model addressing and display.
- TWS and STW are converted from m/s to knots with the shared conversion in `server/polarrecorder/units.py`.
- The polar model, export, viewer API, thresholds, and histograms all operate in knots after sample construction.
- `gps.speed` is speed over ground and is not part of the current learning input.

Relevant optional AvNav keys:

| Key | Current status |
|---|---|
| `gps.speed` | Documented as SOG, not used by the current validation pipeline. |
| `gps.track`, `gps.headingTrue`, `gps.headingMag` | Navigation context only; not used for learning. |
| `gps.windAngle`, `gps.windSpeed` | Apparent wind context only; not used for learning. |
| `gps.depthBelowTransducer` | Future enhanced validation candidate; not read today. |

AvNav does not provide a portable core engine-running signal that Polar Recorder can rely on. R16 is therefore a heuristic quarantine based on low TWS and high STW, not a direct engine detector.

## Related

- [Data pipeline](../architecture/data-pipeline.md)
- [Rejection rules](../filters/rejection-rules.md)
- [Configuration](../user/configuration.md)
- [Poisoning resistance](../filters/poisoning-resistance.md)
