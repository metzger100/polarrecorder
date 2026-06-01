# Plugin Lifecycle

**Status:** Current for version 1.0.0.

## Overview

This document records the AvNav plugin lifecycle facts Polar Recorder relies on. AvNav facts cite the verified source tree in `misc/avnav-master/`; Polar Recorder design choices are described directly.

## Key Details

- AvNav recognizes `plugin.py`, `plugin.js`, `plugin.css`, `plugin.mjs`, and `plugin.json` as plugin files via `ApiImpl.CLIENTFILES`, `ApiImpl.SERVERFILES`, and `ApiImpl.PLUGINFILES` (`handler/pluginhandler.py:79-83`).
- A Python plugin module must provide `class Plugin` with a classmethod `pluginInfo()`, an `__init__(self, api)` constructor, and a `run(self)` method; the test plugin demonstrates all three (`server/plugins/testPlugin/plugin.py:6-10`, `server/plugins/testPlugin/plugin.py:30-42`, `server/plugins/testPlugin/plugin.py:51-64`).
- `pluginInfo()` returns the plugin description metadata; AvNav validates the return is a dict and reads optional `data` entries with `path` values (`handler/pluginhandler.py:922-931`). Example plugins return `description`, optional `data`, optional `config`, and optional `version` fields (`server/plugins/testPlugin/plugin.py:20-28`, `server/plugins/canboat/plugin.py:116-121`).
- `__init__(self, api)` runs before `run()` and must not start threads; the AvNav test and canboat examples state this in their constructors and register request, restart, or editable-parameter callbacks there (`server/plugins/testPlugin/plugin.py:30-42`, `server/plugins/canboat/plugin.py:123-137`).
- AvNav creates the plugin instance once, through `PluginApiProxy`, and stores it on `api.plugin` (`handler/pluginhandler.py:932-936`). Starting or re-enabling the plugin creates a new daemon thread for `runPlugin`, but reuses the stored plugin instance (`handler/pluginhandler.py:668-680`).
- Because AvNav reuses the same instance across disable and re-enable, Polar Recorder resets its own `_stop_requested` flag at the start of each `run()` entry.
- `run()` executes in a dedicated daemon thread named for the plugin (`handler/pluginhandler.py:668-673`). AvNav's wrapper calls `self.plugin.run()` and sets final status after it returns or errors (`handler/pluginhandler.py:675-688`).
- `api.shouldStopMainThread()` returns `True` when AvNav has cleared the stored thread reference or when it is called from a different thread (`handler/pluginhandler.py:515-520`). The `AVNApi` interface documents that calls from another thread return `True` (`avnav_api.py:390-397`).
- `api.registerRestart(stopCallback)` stores the stop callback and makes the plugin editable in AvNav's UI (`handler/pluginhandler.py:507-513`). The `AVNApi` interface says the callback is used to stop the plugin and the plugin must exit `run()` (`avnav_api.py:369-380`).
- On stop, AvNav clears the thread reference before invoking the registered stop handler, so `shouldStopMainThread()` also becomes true for the running loop (`handler/pluginhandler.py:190-199`).
- `api.fetchFromQueue(sequence, number=10, includeSource=False, waitTime=0.5, filter=None)` delegates to the NMEA queue and returns `(sequence, data)` (`handler/pluginhandler.py:224-229`). The `AVNApi` interface documents that it waits up to `waitTime` if no data is available and returns `(sequence, data)` (`avnav_api.py:140-162`). Polar Recorder uses it only as the run-loop wake-up primitive and discards the fetched NMEA records.
- `api.setStatus(value, info)` forwards status to AvNav's status page (`handler/pluginhandler.py:329-332`). `AVNApi` defines the status values as `INACTIVE`, `STARTED`, `RUNNING`, `NMEA`, and `ERROR` (`avnav_api.py:219-225`).
- AvNav's `runPlugin()` wrapper sets `INACTIVE` when the plugin starts, finishes, is disabled, or stops, and `ERROR` on unhandled exceptions (`handler/pluginhandler.py:675-691`). Polar Recorder uses status transitions for its own integration state within that AvNav status vocabulary.
- `api.getDataDir()` returns AvNav's global data directory through `parent.navdata.getDataDir()` (`handler/pluginhandler.py:428-429`), and AvNav defaults that data directory to `$HOME/avnav` when no data directory is configured (`avnav_server.py:163-170`). It is not the plugin's own directory.
- `ApiImpl` stores `fileName`, but the plugin receives `PluginApiProxy`, not `ApiImpl` directly (`handler/pluginhandler.py:100`, `handler/pluginhandler.py:932-933`). The proxy forwards only attributes that exist on `AVNApi` and raises `NotImplemented()` otherwise (`handler/pluginhandler.py:699-721`). `AVNApi` declares plugin methods such as `getBaseUrl`, `saveConfigValues`, `registerEditableParameters`, `registerRestart`, and `shouldStopMainThread`, but does not declare `fileName` (`avnav_api.py:304-380`, `avnav_api.py:390-397`). Polar Recorder therefore locates its own plugin directory with `os.path.dirname(os.path.abspath(__file__))`, not `api.fileName` or `api.getDataDir()`.
- AvNav loads `plugin.py` with `importlib.util.spec_from_file_location()` and `spec.loader.exec_module()` (`handler/pluginhandler.py:941-955`). The loader does not add the plugin directory to `sys.path`, so Polar Recorder requires a top-of-file `sys.path` guard that adds `server/` before importing `polarrecorder.*` modules.
- Plugin API requests are routed under the plugin path when the internal path starts with `api`; AvNav calls the registered handler with the path after `api/`, the HTTP handler, and request parameters (`handler/pluginhandler.py:1078-1085`).
- Static plugin files are served from the plugin directory for non-API paths (`handler/pluginhandler.py:1097-1103`).
- Plugin uploads validate the zip entries, then call `zip.extractall(self.baseDir)` without deleting the existing plugin directory first (`handler/pluginhandler.py:1251-1263`). Files not replaced by the archive can therefore survive an update.
- Plugin delete removes the plugin directory with `shutil.rmtree(filename)` (`handler/pluginhandler.py:1216-1220`).
- `api.log`, `api.debug`, and `api.error` are info, debug, and error logging methods with printf-style format parameters in the AvNav interface (`avnav_api.py:96-124`) and are implemented by forwarding to AvNav logging (`handler/pluginhandler.py:215-222`).
- AvNav's HTTP server uses `socketserver.ThreadingMixIn`, so plugin request handlers can run in per-request HTTP threads rather than the plugin `run()` thread (`handler/httpserver.py:68-69`). Polar Recorder keeps locks in `plugin.py` and keeps `server/polarrecorder/` modules lock-unaware.

## Related

- [API shape](api.md)
- [AvNav keys and units](../avnav/keys-and-units.md)
- [Coding standards](../conventions/coding-standards.md)
- [Data pipeline](data-pipeline.md)
