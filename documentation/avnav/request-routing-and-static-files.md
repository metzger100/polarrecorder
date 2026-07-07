# AvNav Request Routing and Static Files

**Status:** Current | Plugin API and static viewer serving contract.

## Overview

AvNav routes plugin API requests and static file requests under the plugin base URL. Polar Recorder uses one request handler for JSON endpoints and serves the viewer as a static user app.

## Key Details

Base paths:

| Path | Behavior |
|---|---|
| `/plugins/<runtime-plugin-name>/api/<endpoint>` | Routed to the request handler registered by `plugin.py`. |
| `/plugins/<runtime-plugin-name>/viewer/viewer.html` | Serves the static viewer HTML registered by `plugin.py`. |
| `/plugins/<runtime-plugin-name>/viewer/*` | Serves viewer CSS, JavaScript, SVG, and icon files. |

For user-plugin installs AvNav prefixes the runtime plugin name with `user-`,
so the direct viewer URL is normally
`/plugins/user-polarrecorder/viewer/viewer.html`. System-plugin installs use
the corresponding `system-` runtime name.

Request-handler contract:

- `plugin.py` registers one callback with `api.registerRequestHandler(...)`.
- AvNav passes the path after `api/`, the HTTP handler object, and parsed query parameters.
- Query parameters arrive as list-valued values with blank values preserved.
- `plugin.py` normalizes each query parameter to its first scalar string before dispatching.
- A returned dictionary is serialized by AvNav as JSON.
- Polar Recorder wraps successful responses as `{"status": "OK", "data": ...}`.
- Application errors return `{"status": "ERROR", "error": "..."}`.
- Unexpected request exceptions are caught at the `plugin.py` boundary and returned as an internal error envelope.

Transport contract (portable AvNav behavior):

- Plugin URLs (`/plugins/<name>/...`) receive **GET and HEAD only**. AvNav's
  navigation-URL handling, which parses POST bodies, applies only to the core
  `/api` branch; a POST to a plugin URL is rejected upstream with
  `404 "unsupported post url"` before the plugin handler runs. Plugins therefore
  cannot accept POST.
- A single GET is request-line-length bounded (Python's default ~64 KB request
  line), so after URL-encoding only ~15-20 KB of payload fits in one GET query.
- Large uploads (the JSON backup restore flow) are therefore split into multiple
  GET requests and reassembled server-side under the `plugin.py` lock. Each chunk
  arrives as an already URL-decoded `data` query value. See
  [import and restore](../architecture/import-restore.md).

Static user app contract:

- `plugin.py` is the authoritative registration point. At `run()` startup it
  calls AvNav's Python `registerUserApp` with the viewer URL built from
  `getBaseUrl()` and skips only that optional registration when either method is
  unavailable.
- `plugin.json` does not declare `userApps`. Upstream AvNav cores that process
  `userApps` call the same server-side `registerUserApp`, so a declaration
  there would duplicate the backend registration.
- `plugin.js` and `plugin.mjs` are intentional no-op adapters. Modern AvNav
  frontends keep module-registered AddOns in a client-side set that is appended
  to the server addon list, so registering here as well would show a duplicate
  Polar Recorder entry.
- Runtime browser files are plain static files; there is no bundler and no runtime build step.
- Viewer JavaScript files are plain scripts and export only through `window.Polarrecorder`.
- Static viewer requests are read-only; model mutations happen through API endpoints.
- The static viewer computes its backend URL from its served location by using
  `../api/` by default. From `viewer/viewer.html`, this resolves to
  `/plugins/<runtime-plugin-name>/api/`, so it works with user and system
  plugin prefixes without reading AvNav frontend globals.

Concurrency contract:

- AvNav may invoke plugin HTTP handlers outside the plugin `run()` thread.
- `plugin.py` therefore snapshots live state under its single lock.
- Formatting and response shaping should happen through pure helpers after the snapshot wherever possible.
- Preset writes intentionally run under the same lock to serialize `presets.json` read-modify-write operations.
- Reset does not write model files on the HTTP thread; it sets a flush request for the plugin thread.

## Related

- [API shape](../architecture/api.md)
- [UI architecture](../architecture/ui.md)
- [Plugin lifecycle](plugin-lifecycle.md)
- [Persistence](../architecture/persistence.md)
