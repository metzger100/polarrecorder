# Manual AvNav Validation Checklist

**Status:** Current.

## Overview

Every automated gate (`npm run check:all`) proves the code is internally consistent: it does not prove the plugin
actually installs, loads, and behaves correctly inside a real running AvNav instance. Run this checklist once per
release candidate against a real AvNav host before publishing, and record the filled-in result as completion evidence.
Filling in this checklist is a manual step; no tool in this repository can complete it automatically, and none claims
to.

## Key Details

Record one filled copy per validation run (copy the table below into the release notes draft or an execution-plan
evidence section; do not edit this template in place).

Run metadata:

| Field                   | Value |
| ----------------------- | ----- |
| Date                    |       |
| AvNav version           |       |
| Plugin commit / version |       |
| Host / device           |       |
| Browser                 |       |
| Result (pass/fail)      |       |

Checklist:

| #   | Step                                                                        | Expected result                                                                         | Pass/Fail | Notes |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- | ----- |
| 1   | Install the release zip into AvNav's plugin directory and restart AvNav     | Plugin loads with no error in the AvNav log; `pluginInfo()` reports the stamped version |           |       |
| 2   | Activate the plugin from AvNav's plugin settings                            | Plugin activates with no exception; status endpoint responds                            |           |       |
| 3   | Check AvNav's own log for load/start messages                               | No unexpected tracebacks or repeated warnings                                           |           |       |
| 4   | Start recording and let it run with live NMEA/AIS data for a few minutes    | Sample counters increase; no crash; recording can be stopped cleanly                    |           |       |
| 5   | Query representative API responses (status, export, presets) from a browser | Each responds with the documented shape and current data, not stale/empty data          |           |       |
| 6   | Open the viewer and check theme integration                                 | Viewer matches the AvNav host's light/dark theme without a manual reload                |           |       |
| 7   | Exercise the polar chart and timeline chart with real recorded data         | Charts render the live data; no console errors                                          |           |       |
| 8   | Change settings (thresholds, percentile, flush interval) and save           | Settings persist and take effect on the next recorded sample                            |           |       |
| 9   | Export a CSV and re-import a JSON backup                                    | Export downloads a valid file; import restores presets/polar data without error         |           |       |
| 10  | Restart AvNav (or the host) and confirm persistence                         | Recorded data and presets survive the restart unchanged                                 |           |       |
| 11  | Upgrade from the previously installed release to this one in place          | Upgrade completes with no manual data migration required                                |           |       |
| 12  | Roll back to the previously installed release                               | Rollback completes; previously recorded data remains readable                           |           |       |

If any step fails, treat the release candidate as not ready: fix the underlying issue, then re-run the full checklist
from step 1 rather than only re-running the failed step.

`npm run release:prepare` prints the path to this checklist as a reminder; it does not run the checklist and does not
claim it passed. A release is only evidence-complete once a real filled-in copy of this checklist, covering an actual
AvNav host, is attached to its release notes or execution-plan evidence.

## Related

- [Release workflow](release-workflow.md)
- [Documentation index](../TABLEOFCONTENTS.md)
- [AvNav plugin lifecycle](../avnav/plugin-lifecycle.md)
