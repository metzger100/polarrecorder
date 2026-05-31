# Poisoning Resistance

**Status:** Complete for Phase 5 scenario coverage.

## Overview

Polar Recorder resists poisoning by combining a validation pipeline with sparse per-bin
histograms and percentile-based reads. The model learns from accepted sailing samples only;
rejected and quarantined samples are diagnostic signals, not polar-speed inputs.

## Key Details

Each populated TWA/TWS bin stores a 0.1-knot STW histogram. `PolarModel.query(percentile)`
computes the configured percentile from that histogram on demand, using the nearest-rank
algorithm in `polarrecorder/histogram.py`. The default P65 naturally ignores slow tails from
undetected drag, bad trim, current, or moderate drift better than a mean would.

The validation pipeline is the first defense. R1 through R10 reject samples that are missing,
stale, out of range, head-to-wind, low-wind, or anchored-like before they can touch any model
bin. R11 through R15 reject quality-gate transients such as rapid TWA changes, sensor spikes,
cooldown periods, and unstable rolling windows. R16 quarantines suspected low-wind engine use.

`polarrecorder.commit.commit_sample()` is the single dispatch point from a `PipelineResult`
to the model update contract. Accepted samples update histograms, quality-gate rejections and
quarantines update per-bin diagnostics, and candidacy-gate or warming-up rejections touch no
bin. The Phase 5 scenario tests drive reads through `pipeline.run`, `ValidationState.observe`,
and `commit_sample`, matching the production normal path.

The executable proof lives in `tests/test_poisoning_scenarios.py`. It covers valid learning,
slow-sample resistance, anchored bursts, sensor spikes, gradual drift, low-wind rejection, and
maneuver-rich sequences where only stable between-tack segments are learned.

## Related

- [Data pipeline](../architecture/data-pipeline.md)
- [Polar model](../architecture/polar-model.md)
- [Rejection rules](rejection-rules.md)
