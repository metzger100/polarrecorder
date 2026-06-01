# Polar Model

**Status:** Current for version 1.0.0.

## Overview

The polar model stores accepted sailing samples in sparse TWA/TWS bins. Each
bin keeps a speed histogram in 0.1-knot units, so changing the requested
percentile recalculates the learned speed without relearning from raw samples.

## Key Details

- AvNav speed values arrive in meters per second and are converted immediately
  with `1 m/s = 1.94384 kt`.
- TWA is stored internally as the raw 0-360 value, a folded 0-180 absolute
  value, and a signed -180..+180 value where negative means port.
- Bin addresses use Python `round()` directly: TWA wraps with modulo 360 and
  TWS clamps to the fixed 0-60 kt grid.
- Percentiles use a nearest-rank crossing algorithm over deciknot
  histogram keys. There is no interpolation or midpoint averaging.
- `PolarModel.snapshot_bins()` returns fresh plain dicts for each bin and fresh
  nested histogram copies so API formatting can run outside the future plugin
  lock without sharing mutable state.

## Related

- [API shape](api.md)
- [Plugin lifecycle](plugin-lifecycle.md)
- [Coding standards](../conventions/coding-standards.md)
