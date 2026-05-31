# API Shape

**Status:** Phase 2 shape reference only; the complete endpoint catalog is planned for Phase 8.

## Overview

Polar Recorder uses AvNav's single plugin request handler for its HTTP API. This Phase 2 document defines the routing and response shape only; endpoint lists, parameters, and schemas are intentionally deferred.

## Key Details

- AvNav exposes plugin API requests below the plugin base URL; `AVNApi.getBaseUrl()` documents that appending `/api` reaches API requests (`avnav_api.py:304-314`). For Polar Recorder, the design URL pattern is `/plugins/polarrecorder/api/<endpoint>` (PLAN1 section 6.F).
- A plugin registers exactly one request handler with `api.registerRequestHandler(callback)`; calling it again replaces the previous handler (`avnav_api.py:284-302`, `handler/pluginhandler.py:449-451`).
- AvNav routes paths beginning with `api` to the plugin request handler and calls `api.requestHandler(internalPath[4:], handler, requestparam)` (`handler/pluginhandler.py:1078-1085`). The callback therefore receives `(url, handler, args)`, where `url` is the path after `/api/`, `handler` is the HTTP request handler object, and `args` is the request-parameter dict (`avnav_api.py:291-299`).
- AvNav builds request parameters with `urllib.parse.parse_qs(query, True)` for external mappings and websocket mappings (`handler/httpserver.py:276-283`, `handler/httpserver.py:300-305`). The second argument keeps blank values, and `parse_qs` returns list-valued query parameters.
- Because AvNav passes the `requestparam` object directly to the plugin handler (`handler/pluginhandler.py:1084`), Polar Recorder design normalizes `dict[str, list[str]]` to `dict[str, str]` in `plugin.py` before any domain API formatter sees args (PLAN1 section 6.F).
- When a plugin request handler returns a `dict`, AvNav serializes it with `json.dumps()` and returns `application/json` (`handler/pluginhandler.py:1084-1087`).
- `AVNApi.registerRequestHandler()` documents that a callback may return a dictionary for JSON, `True` when it already sent data with the handler, or `None` for an error response (`avnav_api.py:295-299`).
- Polar Recorder design wraps successful API bodies as `{"status": "OK", "data": ...}` and application errors as `{"status": "ERROR", "error": "..."}` (PLAN1 section 6.F). This envelope is a Polar Recorder convention on top of AvNav's dict-to-JSON behavior.
- Phase 2 does not define individual endpoints, query parameters, or response schemas. Phase 8 completes the endpoint catalog and response contracts (PLAN1 section 12).

## Related

- [Plugin lifecycle](plugin-lifecycle.md)
- [Configuration](../user/configuration.md)
- Phase 8 completes this document with endpoint details.
