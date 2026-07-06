# AvNav Plugin Lifecycle

**Status:** Current | Self-contained host lifecycle contract for Polar Recorder.

## Overview

AvNav loads Polar Recorder as a Python plugin and calls a small lifecycle surface. This document describes the host behavior Polar Recorder relies on as a portable contract.

## Key Details

AvNav discovers plugin runtime files in a plugin directory. For Polar Recorder, the relevant files are:

| File | Role |
|---|---|
| `plugin.py` | Python plugin entry point. |
| `plugin.json` | Static user-app declaration for the viewer, including AddOn selector metadata. |
| `plugin.js` / `plugin.mjs` / `plugin.css` | Runtime client files included in release artifacts when present. `plugin.js` stays a no-op adapter; `plugin.mjs` registers the user app on modern cores with runtime de-duplication (see below). |
| `viewer/*` | Static browser user app served from the plugin directory. |
| `server/polarrecorder/**/*.py` | Python package imported by `plugin.py` after it adds `server/` to `sys.path`. |

Python lifecycle contract:

- The module exposes `class Plugin`.
- `Plugin.pluginInfo()` returns a dictionary with display metadata such as `description` and runtime `version`.
- `Plugin.__init__(api)` receives the AvNav API object and registers callbacks. It should not start worker threads.
- `Plugin.run()` executes in AvNav's plugin thread until AvNav asks the plugin to stop.
- `api.shouldStopMainThread()` is the loop's stop signal and is meaningful only from the plugin run thread.
- `api.registerRestart(callback)` makes the plugin restartable from AvNav and gives AvNav a callback that must cause `run()` to exit.
- AvNav may reuse a plugin instance across disable/re-enable cycles, so per-run stop flags must be reset at the start of `run()`.

Status contract:

| Status | Polar Recorder use |
|---|---|
| `STARTED` | Plugin is alive but not currently receiving complete core data, or has been demoted after missing data. |
| `RUNNING` | Core instrument data is being received. |
| `NMEA` | At least one accepted sample has recently updated the learned model. |
| `ERROR` | Startup or unrecoverable persistence problem surfaced to AvNav. |
| `INACTIVE` | Host-owned disabled/stopped state. |

Polar Recorder boundaries:

- `plugin.py` is the only runtime AvNav boundary.
- `server/polarrecorder/` modules never import AvNav modules or `plugin.py`.
- AvNav access is represented as narrow protocols/fakes in domain-facing modules.
- All lock ownership stays in `plugin.py`; domain modules remain thread-unaware.
- Version authority lives in release tooling. Development checkouts may not carry a stamped runtime version in `plugin.json`.
- User-app visibility is registered two ways so the same package works across
  AvNav variants without a version check:
  - `plugin.json` declares the user app statically. Cores that process
    `plugin.json` (legacy-only and mixed) import it into their AddOn list with
    the app name, AddOn page target, button labels, icon, title, and viewer URL.
  - `plugin.mjs` registers the same user app through `api.registerUserApp` for
    modern cores that ignore `plugin.json`. To avoid a duplicate entry on mixed
    cores, the module first queries the core addon list (`/api/addon/list`) and
    registers only when no AddOn already exists under this plugin's base URL. A
    missing or failing addon list is treated as a modern-only core, so the
    module registers rather than staying silent.

## Related

- [Polar Recorder plugin lifecycle](../architecture/plugin-lifecycle.md)
- [Request routing and static files](request-routing-and-static-files.md)
- [Editable parameters](editable-parameters.md)
- [Coding standards](../conventions/coding-standards.md)
