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
- `gps.speed` is speed over ground; it is not a core learning input but is read as an optional signal (see below).

Optional (enhanced) signal keys:

The reader also reads a bounded set of optional store keys when their rule is enabled and a key is
configured. Each raw value passes through one coerce-once helper (`reader._coerce_float`: bool ->
`0.0`/`1.0`, numbers pass through, numeric strings parse, non-numeric or non-finite values are
omitted and debug-logged), is dropped if its age exceeds `stale_threshold`, and is then carried as
`ReadResult.enhanced_raw` (store units, with timestamp). `build_sample` converts each role to its
canonical unit once and stores it in `Sample.enhanced`; an absent or stale signal is omitted from
the dict (never a `NaN`/`-1`/`0` sentinel), and `Sample.enhanced` is `None` when nothing is read.

| Role in `Sample.enhanced` | Config key (default) | Store unit | Canonical unit |
|---|---|---:|---:|
| `rpm` | `enh_rpm_key` (`""`) | rpm | rpm |
| `engine_signal` | `enh_engine_state_key` (`""`) | bool/number/voltage | raw numeric |
| `depth_m` | `enh_depth_key` (`gps.depthBelowKeel`) | meters | meters |
| `sog_kt` | `enh_sog_key` (`gps.speed`) | m/s | knots |
| `awa_deg` | `enh_awa_key` (`gps.windAngle`) | degrees | degrees |
| `aws_kt` | `enh_aws_key` (`gps.windSpeed`) | m/s | knots |
| `heel_deg` | `enh_heel_key` (`""`) | degrees | degrees |
| `current_drift_kt` | `enh_current_drift_key` (`gps.currentDrift`) | m/s | knots |
| `heading_deg` | `enh_heading_key` (`gps.headingTrue`) | degrees | degrees |
| `cog_deg` | `enh_cog_key` (`gps.track`) | degrees | degrees |

AvNav core also exposes `gps.depthBelowKeel` and `gps.depthBelowWaterline`; `enh_depth_key` defaults
to the keel-clearance key. AvNav core has no built-in roll/heel/attitude key, so `enh_heel_key` is a
custom key the user maps (for example a SignalK `navigation.attitude.roll` bridge), expressed in
degrees of transverse roll.

AvNav does not provide a portable core engine-running signal that Polar Recorder can rely on. R16 is
therefore a heuristic quarantine based on low TWS and high STW, but it defers to a definitive
`rpm`/`engine_signal` reading when one is configured (see the rejection-rules doc).

## Related

- [Data pipeline](../architecture/data-pipeline.md)
- [Rejection rules](../filters/rejection-rules.md)
- [Configuration](../user/configuration.md)
- [Poisoning resistance](../filters/poisoning-resistance.md)
