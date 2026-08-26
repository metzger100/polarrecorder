# Roadmap

**Status:** Current.

## Overview

The MVP is shipped: learned polar recording, validation, persistence, API, viewer, and packaging. This roadmap tracks
only Post-MVP ideas — the features under consideration once the MVP baseline is stable. Each idea below states a single
goal, the user-visible outcome, and the main areas it touches. Nothing here is committed or scheduled; ordering does not
imply priority.

## Key Details

### Add an enhanced Input key computation

Currently we use TWA, TWS and STW for the Polarrecorder. But in most cases TWA and TWS is calculated based on STW, AWA and
AWS. But that is not the whole truth. Actually you have to also include CTW to include Drift in the Polar. CTW can be
calculated with COG and HDT. If all those values are available: STW, AWA, AWS, COG and HDT, it is recommended to make a own
TWA TWS calculation. We need to add a seperate section for that in the advanced settings to set the keys and activate the new
calculation with an including popup to reset the already gathered data.

### Investigation — isolated slow accepted samples

Isolated slow accepted samples can exist inside otherwise strong bins. P65 is intentionally the current protection; no
second outlier reject is planned here. Use multi-day raw diagnostic evidence to determine whether they are sensor
artifacts, transient sailing states, or legitimate low-performance modes before considering a filter change.

### Post-MVP — stable-segment/block learning

Investigate learning from explicitly detected stable segments or blocks rather than independent samples. This is a
possible future approach only, not an implemented or scheduled feature.

## Related

- [Export and import](documentation/user/export-import.md)
- [Data pipeline (enhanced signal hooks)](documentation/architecture/data-pipeline.md)
- [Viewer UI](documentation/architecture/ui.md)
