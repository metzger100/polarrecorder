# Plugin Lifecycle

**Status:** Current | Polar Recorder implementation of the AvNav lifecycle.

## Overview

`plugin.py` is the thin AvNav integration shell. It registers AvNav callbacks, owns threading and locking, and delegates learning, persistence, validation, and response formatting to `server/polarrecorder/`.

## Key Details

Lifecycle implementation:

| Phase | Polar Recorder behavior |
|---|---|
| Metadata | `Plugin.pluginInfo()` returns the description and runtime version reported by the release-stamped `plugin.json` when available. |
| Construction | `Plugin.__init__(api)` stores the AvNav API, creates the single lock, registers the `enabled` editable parameter, loads config, creates model/counter/timeline state, registers the API handler, registers restart, and loads persistence. |
| Run loop | `Plugin.run()` wakes on the NMEA queue, samples at `sample_interval`, runs one validation/model iteration, flushes periodically, and exits when AvNav or `_restart()` requests stop. |
| Stop/restart | `_restart()` sets `_stop_requested`; the next loop check exits and the final flush runs. `_stop_requested` is reset at the next `run()` entry because AvNav can reuse the plugin instance. |
| Status | `_set_status()` reports `STARTED`, `RUNNING`, `NMEA`, or `ERROR` using AvNav's status vocabulary. |

AvNav boundary rules:

- `plugin.py` is the only module that touches the runtime AvNav API.
- `avnav_api` is imported only under `TYPE_CHECKING`.
- `server/polarrecorder/` receives AvNav-like behavior through protocols or plain data, never through AvNav imports.
- `StoreReader` is constructed in `plugin.py` with the AvNav API object but only depends on the `getSingleValue(..., includeInfo=True)` protocol.
- Request dispatch receives the plugin shell object because lock ownership and live state reside in `plugin.py`; API handlers format snapshots and avoid AvNav access.

Single-lock discipline:

- `plugin.py` creates exactly one `threading.Lock`.
- The sampling loop holds the lock only while committing samples, counters, timeline entries, status scalars, config swaps, or persistence snapshots.
- API dispatch holds the same lock while snapshotting model/config/status data.
- Formatting, CSV generation, and JSON response shaping should use detached snapshots whenever possible.
- Domain modules must not acquire locks or assume thread identity.

Runtime state ownership:

| State | Owner | Notes |
|---|---|---|
| `Config` | `plugin.py` | Parsed from AvNav plugin configuration values and hot-swapped under the lock. |
| `ValidationState` | `plugin.py` | Observed after each built sample; not reset on normal config changes. |
| `PolarModel` | `plugin.py` | Mutated only through `commit.commit_sample()` or reset under the lock. |
| `Counters` | `plugin.py` | Updated with the same pipeline decision that updates the model. |
| `Timeline` | `plugin.py` | Uses injected wall clock for minute buckets. |
| `polar.json` | `persistence.py` | Serialized from locked snapshots and written by the plugin thread. |

Version authority lives in release tooling. Development checkouts can run without a stamped version in `plugin.json`; packaged releases stamp the runtime version during zip creation.

## Related

- [AvNav plugin lifecycle](../avnav/plugin-lifecycle.md)
- [API shape](api.md)
- [Persistence](persistence.md)
- [Coding standards](../conventions/coding-standards.md)
