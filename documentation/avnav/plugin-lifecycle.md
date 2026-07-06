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
| `plugin.js` / `plugin.mjs` / `plugin.css` | Runtime client files included in release artifacts when present. `plugin.js` stays a legacy no-op adapter; `plugin.mjs` mirrors user-app registration through AvNav's modern module API. |
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
- User-app visibility is supported through both AvNav client generations:
  `plugin.json` provides the legacy/static declaration, while `plugin.mjs`
  registers the same app through the modern module API. Both use the same app
  name, AddOn page target, button labels, icon, title, and viewer URL.

## Related

- [Polar Recorder plugin lifecycle](../architecture/plugin-lifecycle.md)
- [Request routing and static files](request-routing-and-static-files.md)
- [Editable parameters](editable-parameters.md)
- [Coding standards](../conventions/coding-standards.md)
