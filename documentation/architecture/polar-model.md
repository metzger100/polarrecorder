# Polar Model

**Status:** Current.

## Overview

The polar model stores accepted sailing samples in sparse TWA/TWS bins. Each
bin keeps a speed histogram in 0.1-knot units, so changing the requested
percentile recalculates the learned speed without relearning from raw samples.

## Key Details

- AvNav speed values arrive in meters per second and are converted immediately
  with `1 m/s = 1.94384 kt`.
- The model is the source of true full-circle TWA data. Bins are keyed on the
  raw 0-359 value, so port and starboard are stored separately. The `Sample`
  type still exposes folded 0-180 and signed -180..+180 forms for validation,
  but the model write path consumes only the raw value.
- Bin addresses use Python `round()` directly: TWA wraps with modulo 360 and
  TWS clamps to the fixed 0-60 kt grid.
- Projection (`projection.py`) never folds. A non-circular (180 deg) grid keeps
  starboard-only linear interval merging; a circular grid (any TWA above 180 deg)
  assigns each raw bin to its nearest grid point on the circle. No 0-180 fold
  occurs at or after projection, so a 360 deg grid preserves true port/starboard
  asymmetry end to end.
- Percentiles use a nearest-rank crossing algorithm over deciknot
  histogram keys. There is no interpolation or midpoint averaging.
- `PolarModel.snapshot_bins()` returns fresh plain dicts for each bin and fresh
  nested histogram copies so API formatting can run outside the plugin
  lock without sharing mutable state.
- Accepted samples update speed histograms. Quality-gate rejections and
  quarantines update per-bin diagnostics. Candidacy-gate rejections do not
  touch bins.

## Related

- [API shape](api.md)
- [Plugin lifecycle](plugin-lifecycle.md)
- [Rejection rules](../filters/rejection-rules.md)
- [Coding standards](../conventions/coding-standards.md)
