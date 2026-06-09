# Poisoning Resistance

**Status:** Current.

## Overview

Polar Recorder resists poisoning by combining a validation pipeline with sparse per-bin
histograms and percentile-based reads. The model learns from accepted sailing samples only;
rejected and quarantined samples are diagnostic signals, not polar-speed inputs.

## Key Details

Each populated TWA/TWS bin stores a 0.1-knot STW histogram. `PolarModel.query(percentile)`
computes the configured percentile from that histogram on demand, using the nearest-rank
algorithm in `server/polarrecorder/histogram.py`. The default P65 naturally ignores slow tails from
undetected drag, bad trim, current, or moderate drift better than a mean would.

The validation pipeline is the first defense. R1 through R10 reject samples that are missing,
stale, out of range, head-to-wind, low-wind, or anchored-like before they can touch any model
bin. R11 through R15 reject quality-gate transients such as rapid TWA changes, sensor spikes,
cooldown periods, and unstable rolling windows. R16 quarantines suspected low-wind engine use.

Optional enhanced signals (R17-R22) harden the model further when a boat publishes them. A
definitive engine signal (RPM or engine-state) turns R16's guess into a fact: engine-on becomes
a direct R17/R18 reject and engine-off suppresses the R16 quarantine, so motoring is excluded
without discarding genuine light-air sailing. A depth signal rejects shallow-water squat (R19).

There is deliberately **no current-strength reject**. A polar maps STW (through water) against
true wind over water, and AvNav publishes `gps.trueWindAngle` as `angleTrueWater`, so TWS and STW
live in the same water frame. A uniform current is a Galilean translation of that frame: it
changes SOG/COG but shifts the recorded TWS and the resulting STW *together*, leaving the
`(STW, TWS_water)` point valid. A current-*magnitude* reject would discard good data, and as a
wind-against-tide sea-state proxy it is too blunt (it cannot tell flat wind-with-tide from rough
wind-against-tide). Current drift is read only by R20.

R20 (SOG/STW paddlewheel check) fires only when STW reads implausibly low versus SOG *and* the
present current is too small to account for the gap (`current_drift_kt < sog_kt - stw_kt`).
Limitations: boats without a current-drift source get no SOG/STW-mismatch detection, and if the
VDR set/drift device derives drift from the same paddlewheel that feeds `gps.waterSpeed`, a
broken log inflates the computed drift too and R20 is silently defeated. Both are deliberate
prices of never discarding honest following-current data, which shares the STW-below-SOG
signature.

R21 (true-wind cross-check) has real teeth in the AvNav-core NMEA model: true wind is parsed from
instrument MWV (ref=T)/MWD sentences independently of `gps.windAngle`/`windSpeed` + STW, so the
recompute catches a miscalibrated wind sensor or a divergent boat-speed feed. It degrades to a
near-tautology only in a SignalK/plugin setup where true wind is derived from the same AWA/AWS/STW
it is checked against.

`polarrecorder.commit.commit_sample()` is the single dispatch point from a `PipelineResult`
to the model update contract. Accepted samples update histograms, quality-gate rejections and
quarantines update per-bin diagnostics, and candidacy-gate or warming-up rejections touch no
bin. The scenario tests drive reads through `pipeline.run`, `ValidationState.observe`, and
`commit_sample`, matching the production normal path.

The executable proof lives in `tests/test_poisoning_scenarios.py`. It covers valid learning,
slow-sample resistance, anchored bursts, sensor spikes, gradual drift, low-wind rejection,
maneuver-rich sequences where only stable between-tack segments are learned, and the enhanced
scenarios: motoring-with-RPM, shallow water, failing paddlewheel (SOG/STW), and miscalibrated
wind reject as expected, while a strong following-current sample is accepted (no
current-strength reject exists and R20's gap test does not fire when drift explains the gap).

## Related

- [Data pipeline](../architecture/data-pipeline.md)
- [Polar model](../architecture/polar-model.md)
- [Rejection rules](rejection-rules.md)
