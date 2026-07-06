# AvNav Request Routing and Static Files

**Status:** Current | Plugin API and static viewer serving contract.

## Overview

AvNav routes plugin API requests and static file requests under the plugin base URL. Polar Recorder uses one request handler for JSON endpoints and serves the viewer as a static user app.

## Key Details

Base paths:

| Path | Behavior |
|---|---|
| `/plugins/<runtime-plugin-name>/api/<endpoint>` | Routed to the request handler registered by `plugin.py`. |
| `/plugins/<runtime-plugin-name>/viewer/viewer.html` | Serves the static viewer HTML declared in `plugin.json`. |
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

- `plugin.json` declares the user app `name`, AddOn page target, short and long
  button labels, title, icon, and `viewer/viewer.html` URL. Cores that process
  `plugin.json` register it server-side; it then appears in the core addon list
  (`/api/addon/list`) under this plugin's base URL.
- `plugin.mjs` registers the same user app through `api.registerUserApp` for
  modern cores that ignore `plugin.json`. It first checks the core addon list
  and registers only when no AddOn already exists under this plugin's base URL,
  so mixed cores that honor both paths do not show duplicate Polar Recorder
  entries. If the addon list is unreachable, the module assumes a modern-only
  core and registers.
- Runtime browser files are plain static files; there is no bundler and no runtime build step.
- Viewer JavaScript files are plain scripts and export only through `window.Polarrecorder`.
- Static viewer requests are read-only; model mutations happen through API endpoints.

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
