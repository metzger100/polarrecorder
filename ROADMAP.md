# Roadmap

**Status:** Current.

## Overview

The MVP is shipped: learned polar recording, validation, persistence, API, viewer, and packaging. This roadmap tracks
only Post-MVP ideas — the features under consideration once the MVP baseline is stable. Each idea below states a single
goal, the user-visible outcome, and the main areas it touches. Nothing here is committed or scheduled; ordering does not
imply priority.

## Key Details

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
