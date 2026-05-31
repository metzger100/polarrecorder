# PLAN1 — polarrecorder: Learning Polar Recorder for AvNav

## 1. Status

- PLAN1 was written after inspecting the AvNav source tree (`avnav-master/`) and the dyninstruments source tree (`dyninstruments-main/`).
- Implementation must follow PLAN1. Defects discovered in PLAN1 *itself* mid-implementation (gaps, contradictions, errors) are not grounds to silently improvise: they are corrected through the `plan-controller`'s **plan-defect handling protocol** and recorded in the per-plan amendments ledger (see §10 Phase 0). Only changes too large to absorb that way require a subsequent plan.
- PLAN1 covers both repository bootstrap and the first production-quality architecture.
- Implementation begins with a **human-authored, inspection-verified foundation** spanning two phases. **Phase 0 (Retired Local Agent Bootstrap)** is intentionally empty in the current repository; **Phase 1 (Repository Bootstrap)** creates the skeleton, the AI instructions (`AGENTS.md`/`CLAUDE.md`) and the quality gate (`tools/check-all.sh`) that future implementation work is bound by. Neither implements product functionality. Because Phase 1 builds the rulebook and gate — and would otherwise be self-verified by a gate it is simultaneously creating — it is **authored and verified by a human, exactly like Phase 0**. The **product build begins at Phase 2**, by which point a complete, trusted foundation and a working `check-all.sh` already exist, so the deterministic gate is the binding arbiter for every later phase with no self-verification exception.
- PLAN1 includes the full product vision. Implementation phases define an MVP boundary; post-MVP features are documented but not implemented in the first pass.
- PLAN1 is self-contained: another AI agent must be able to implement the project from this document alone, without the original prompt.

---

## 2. Goal

Observable end state after PLAN1 is fully implemented:

1. A working AvNav user plugin named `polarrecorder` that installs by dropping a directory into `<DATADIR>/plugins/`.
2. A background sampler that runs whenever AvNav runs, coupled to the NMEA data queue — zero user interaction required.
3. An AvNav store value reader that reads `gps.trueWindAngle`, `gps.trueWindSpeed`, `gps.waterSpeed` (and optional enhanced signals) with freshness and staleness validation.
4. A modular validation/filtering pipeline that rejects, quarantines, or accepts each sample with a documented reason code.
5. A poisoning-resistant polar model using per-bin speed histograms with configurable percentile extraction (default P65).
6. Full 360° internal bins at 1° TWA × 1 kt TWS resolution (21,960 bin cells; sparse storage means only bins with data consume memory).
7. JSON persistence in `<plugin_dir>/data/` with 5-minute flush, atomic temp-file-and-rename, backup, corruption recovery, and schema versioning.
8. Read-only and controlled-mutation API endpoints via AvNav plugin request handling.
9. Status/debug counters and aggregated rejection diagnostics persisted across restarts.
10. A 4-hour in-memory rejection timeline of 1-minute decision buckets for live diagnostics (so the user can see *when* data was being accepted vs. rejected and confirm that anchoring/motoring stretches were detected).
11. A user app (full-page HTML) with polar diagram viewer, recording controls (start/pause, reset with confirmation, download), export configurator (built-in Windy preset + user-saved presets, all with editable grids), and rejection timeline visualization.
12. Export to human-readable CSV in configurable polar table grids (Windy Passage Planner default preset, user-saved presets).
13. Strict dev/test/docs infrastructure matching dyninstruments quality standards: execution-plan-driven development, strict AI-agent instructions, linters, high test coverage, modular documentation, deterministic tests, quality gate scripts, release packaging.

---

## 3. Verified Baseline

Every fact below was verified against files in the provided source trees. Positive facts state what exists; negative facts state what does not exist.

### AvNav Plugin Lifecycle

1. **Plugin directory structure.** A user plugin is a directory under `<DATADIR>/plugins/<name>/`. Recognized files: `plugin.py`, `plugin.js`, `plugin.css`, `plugin.mjs`, `plugin.json`. Source: `pluginhandler.py:81` — `CLIENTFILES = {'js': 'plugin.js', 'css': 'plugin.css', 'mjs': 'plugin.mjs', 'cfg': 'plugin.json'}; SERVERFILES = {'python': 'plugin.py'}`.

2. **Python plugin class.** The plugin module must define a `class Plugin` with `pluginInfo()` (classmethod), `__init__(self, api)`, and `run(self)`. Source: `plugins/testPlugin/plugin.py:6–61`, `plugins/canboat/plugin.py:68–165`.

3. **`pluginInfo()` return shape.** Returns a dict with keys `description` (mandatory), `data` (optional list of store key registrations each with `path` and `description`), `config` (optional list of editable parameter dicts), `version` (optional). Source: `plugins/testPlugin/plugin.py:9–28`, `plugins/canboat/plugin.py:106–121`.

4. **`__init__(self, api)` constraints.** Called before `run()`. Must not start threads. Must register editable parameters, request handler, restart handler here. Source: `plugins/testPlugin/plugin.py:30–43`, `plugins/canboat/plugin.py:123–137`.

5. **`run(self)` thread model.** Executes in a dedicated thread. Source: `pluginhandler.py:200` (thread reference), confirmed by `testPlugin/plugin.py:51–71` using `while not self.api.shouldStopMainThread()`.

6. **`api.shouldStopMainThread()` semantics.** Returns `True` when the plugin should exit its `run()` loop. Compares current thread identity against the stored thread reference; returns `True` if the thread reference is `None` (plugin stopped) or if called from a different thread. Source: `pluginhandler.py:515–520`.

7. **`api.registerRestart(stopCallback)` semantics.** Registers a callback that AvNav calls to request plugin stop. Enables runtime enable/disable in the AvNav UI. Source: `pluginhandler.py:507–513`, `avnav_api.py:369–380`.

8. **`api.getSingleValue(key, includeInfo=False)` return shape.** With `includeInfo=False`: returns the value directly, or `None` if expired or missing. With `includeInfo=True`: returns a `DataEntry` object with fields `.value`, `.timestamp` (from `time.monotonic()`), `.source`, `.priority`, `.keepAlways`, `.record`. Returns `None` if expired or missing. Source: `avnav_store.py:260–272`, `avnav_store.py:46–56`.

9. **Store expiry mechanism.** `DataEntry.timestamp` is compared against `time.monotonic() - expiryTime`. If the entry's timestamp is older than this, `getSingleValue` returns `None`. Source: `avnav_store.py:102–108`, `avnav_store.py:260–266`.

10. **`api.getExpiryPeriod()` semantics.** Returns the store's configured expiry time in seconds. Source: `avnav_store.py:115–116`.

11. **`api.registerRequestHandler(callback)` semantics.** Registers a single request handler. The callback signature is `callback(url, handler, args)` where `url` is the path after `/plugins/<name>/api/`, `handler` is the HTTP request handler object, and `args` is a dict of query parameters. The callback must return a dict (sent as JSON), `True` (if the handler already sent a response), or `None` (error). Source: `pluginhandler.py:449–451`, `pluginhandler.py:1078–1087`, `avnav_api.py:284–302`.

12. **`api.registerEditableParameters(paramList, changeCallback)` semantics.** `paramList` is a list of dicts with keys: `name` (mandatory), `default` (optional; if absent, parameter is mandatory), `type` (default `STRING`; options: `STRING`, `NUMBER`, `FLOAT`, `SELECT`, `BOOLEAN`), `rangeOrList` (optional; list for SELECT, `[min, max]` for NUMBER/FLOAT), `description` (optional). `changeCallback` receives a dict of changed values. All values are strings. Source: `pluginhandler.py:481–505`, `avnav_api.py:348–367`.

13. **`api.saveConfigValues(configDict)` semantics.** Persists config values to `avnav_server.xml`. Values should be strings. Source: `pluginhandler.py:477–479`, `avnav_api.py:336–346`.

14. **`api.getConfigValue(key, default=None)` semantics.** Reads a config value for this plugin. Returns string or default. Source: `pluginhandler.py:311–327`.

15. **`api.registerUserApp(url, iconFile, title, preventConnectionLost=False)` semantics.** Registers a user app in the AvNav user apps list. `url` can be relative to the plugin directory. `iconFile` must be relative. Source: `pluginhandler.py:334–363`.

16. **`api.setStatus(value, info)` semantics.** Sets plugin status displayed on the AvNav status page. `value` is one of `'INACTIVE'`, `'STARTED'`, `'RUNNING'`, `'NMEA'`, `'ERROR'`. Source: `pluginhandler.py:329–332`, `avnav_api.py:219–223`.

17. **`api.getDataDir()` semantics.** Returns the AvNav data directory (default: `$HOME/avnav`). Source: `pluginhandler.py:428–429`, `avnav_server.py:165–170`.

18. **Plugin data directory.** The plugin obtains its own directory from its module path — `_plugin_dir = os.path.dirname(os.path.abspath(__file__))` — the **same** value `plugin.py` already computes for the `sys.path` import guard (§7 "Python Import Path Strategy") and the `pluginInfo()` `plugin.json` lookup (Phase 7). The data dir is `<_plugin_dir>/data/`. **Do NOT use `api.fileName`.** Although `ApiImpl` does set `self.fileName = moduleFile` (the path to `plugin.py`; source: `pluginhandler.py:100`), the plugin never receives `ApiImpl` directly — AvNav injects a `PluginApiProxy` (`pluginhandler.py:932`, `pluginInstance = obj(api.proxy)`) whose `__getattr__` (`pluginhandler.py:714–720`) forwards **only** attributes declared on the abstract `AVNApi` interface and raises `NotImplemented()` for anything else. `fileName` is **not** declared on `AVNApi` (verified: `avnav_api.py` defines `getSingleValue`, `getDataDir`, `fetchFromQueue`, `registerRestart`, etc., but no `fileName`), so `api.fileName` raises `NotImplemented()` at runtime. `api.getDataDir()` IS exposed by the proxy but returns the **global** AvNav data dir (`$HOME/avnav`, §3.17), not the plugin's own directory, so it is also unsuitable for locating `<plugin_dir>/data/`. The `__file__`-based `_plugin_dir` is therefore the only correct mechanism, and it is consistent with the "data survives plugin updates" rationale in §6.E (the `data/` dir lives inside the extracted plugin directory).

19. **`api.fetchFromQueue(sequence, number=10, includeSource=False, waitTime=0.5, filter=None)` semantics.** Fetches NMEA records from the queue. Blocks up to `waitTime` seconds if no data is available (uses condition variable wait). Returns `(sequence, data)`. Source: `pluginhandler.py:224–229`, `avnav_api.py:140–162`, `avnqueue.py:153–260`.

20. **Plugin upload (update) behavior.** `zip.extractall()` extracts over the existing directory. Files in the zip overwrite; files not in the zip survive. The directory is NOT deleted on update. Source: `pluginhandler.py:1251–1260`.

21. **Plugin delete behavior.** `shutil.rmtree()` deletes the entire plugin directory. Source: `pluginhandler.py:1220`.

22. **`api.log(format, *param)` semantics.** Logs an info-level message. `format` is a printf-style format string; `*param` are optional substitution values. Can be called with a single pre-formatted string (`api.log("message")`). Source: `avnav_api.py:96–104`.

23. **`api.debug(format, *param)` semantics.** Logs a debug-level message. Same calling convention as `api.log()`. Source: `avnav_api.py:106–114`.

24. **`api.error(format, *param)` semantics.** Logs an error-level message. Same calling convention as `api.log()`. Source: `avnav_api.py:116–124`.

### AvNav Store Key Names and Units

25. **`gps.trueWindAngle`** — True wind angle in degrees, 0–360 convention (port side = 180–360). Internal unit: degrees. Source: `avnav_nmea.py:130` — `K_TWA=Key('trueWindAngle','true wind angle','°','environment.wind.angleTrueWater')`.

26. **`gps.trueWindSpeed`** — True wind speed. Internal unit: m/s. Source: `avnav_nmea.py:129` — `K_TWS=Key('trueWindSpeed','true wind speed','m/s','environment.wind.speedTrue')`.

27. **`gps.waterSpeed`** — Speed through water (STW). Internal unit: m/s. Source: `avnav_nmea.py:126` — `K_VHWS=Key('waterSpeed','speed through water','m/s','navigation.speedThroughWater')`.

28. **`gps.speed`** — Speed over ground (SOG). Internal unit: m/s. Source: `avnav_nmea.py:137` — `K_SOG=Key('speed','speed in m/s','m/s','navigation.speedOverGround')`.

29. **`gps.track`** — Course over ground (COG). Internal unit: degrees. Source: `avnav_nmea.py:136` — `K_COG=Key('track','course over ground','°','navigation.courseOverGroundTrue')`.

30. **`gps.headingTrue`** — True heading in degrees. Source: `avnav_nmea.py:124`.

31. **`gps.headingMag`** — Magnetic heading in degrees. Source: `avnav_nmea.py:123`.

32. **`gps.windAngle`** — Apparent wind angle in degrees, 0–360 convention. Source: `avnav_nmea.py:128`.

33. **`gps.windSpeed`** — Apparent wind speed in m/s. Source: `avnav_nmea.py:127`.

34. **`gps.depthBelowTransducer`** — Depth in meters. Source: `avnav_nmea.py:140`.

35. **`gps.lat`**, **`gps.lon`** — Position in decimal degrees. Source: `avnav_nmea.py:134–135`.

36. **`gps.currentSet`**, **`gps.currentDrift`** — Current direction in degrees, current speed in m/s. Source: `avnav_nmea.py:138–139`.

37. **No built-in RPM key.** The AvNav core NMEA parser does not define an engine RPM, engine state, heel, or rudder angle key. These could only come from custom plugins, SignalK bridges, or NMEA 2000 via canboat. Source: exhaustive search of `avnav_nmea.py:122–145` key definitions.

38. **TWA sign convention.** MWV with `T` reference stores TWA as 0–360 degrees (source: `avnav_nmea.py:485–510`). VWR stores apparent wind with port=`360-angle` convention (source: `avnav_nmea.py:471–472`). No VWT parser exists in AvNav.

39. **JS-side key convention.** The AvNav viewer accesses store values under `nav.gps.*` (e.g., `nav.gps.trueWindAngle`). Source: `viewer/util/keys.jsx` — `trueWindAngle: V, trueWindSpeed: V, waterSpeed: V`.

### AvNav Plugin JavaScript/Asset Loading

40. **`plugin.mjs` is loaded as an ES module** via dynamic `import()`. The default export is called with a JS API object providing `getBaseUrl()`, `getPluginName()`, `registerWidget()`, `registerFormatter()`, `registerUserApp()`, and others. Source: `viewer/util/pluginmanager.js:195–213`, `viewer/util/pluginmanager.js:511–535`.

41. **`plugin.js` is loaded as a legacy script** via script tag injection. A global `AVNAV_PLUGIN_NAME` is prepended to the file. No module imports available. Source: `pluginhandler.py:1088–1096`.

42. **`plugin.css` is loaded as a stylesheet** and can be updated on plugin reload. Source: `pluginmanager.js:558–564`.

43. **`plugin.json` can contain** `version`, `charts`, `userApps` (array of objects with `url`, `iconFile`, `title`). Source: `pluginhandler.py:559–620`.

44. **Static files in the plugin directory are served** at `<URL_PREFIX>/<name>/<filename>`. Source: `pluginhandler.py:1097–1100`.

### dyninstruments Quality Infrastructure

45. **AGENTS.md and CLAUDE.md share a `SHARED_INSTRUCTIONS` block** between `<!-- BEGIN SHARED_INSTRUCTIONS -->` and `<!-- END SHARED_INSTRUCTIONS -->` markers, kept in sync by `tools/sync-ai-instructions.mjs`. Source: `AGENTS.md:4,197`, `CLAUDE.md:5,199`.

46. **Mandatory session preflight** requires reading `TABLEOFCONTENTS.md`, `coding-standards.md`, and `smell-prevention.md` before any task. Source: `AGENTS.md:9–17`.

47. **`documentation/TABLEOFCONTENTS.md`** serves as the navigation index for all documentation. Source: `TABLEOFCONTENTS.md` (exists, 16K).

48. **`documentation/core-principles.md`** lists non-negotiable rules as numbered items with cross-references. Source: `core-principles.md:1–35`.

49. **Coding standards** enforce file headers (`Module`, `Documentation`, `Depends`), 400-line hard limit on JS and Markdown files, UMD/IIFE wrappers, no ES module import/export in runtime code, and shared-utility reuse rules. Source: `coding-standards.md:1–50`.

50. **Smell prevention** defines a tabular smell catalog with columns: Smell Class, Anti-Pattern, Required Pattern, Enforcement, Severity (block/warn). Enforced by `check-patterns.mjs` and `check-smell-contracts.mjs`. Source: `smell-prevention.md:1–40`.

51. **Quality gate scripts.** `npm run check:all` = `check:core` + `test:coverage:check` + `perf:check`. `check:core` = smells + docs + doc-format + doc-reachability + ai-check + filesize + headers + dependencies + UMD + naming. Source: `package.json:25–30`.

52. **Testing stack:** Vitest + jsdom. Config in `vitest.config.js`. Tests in `tests/**/*.test.js`. Coverage via `@vitest/coverage-v8`. Source: `package.json:37–41`, `documentation/conventions/testing-infrastructure.md:1–20`.

53. **Release packaging** uses `tools/release-prepare.mjs` and `tools/release-create.mjs`. Releases are zipped into `releases/<name>-<version>.zip` with a companion `.md` file. Source: `package.json:28–29`, `releases/` directory contents.

54. **Execution plans** live in `exec-plans/active/` during work and move to `exec-plans/completed/` on completion. Sequential numbering `PLAN{N}.md`. Source: `exec-plans/active/PLAN1.md` (exists), `documentation/guides/exec-plan-authoring.md:10–13`.

55. **Documentation format** uses a standard structure: `Status` line, `Overview`, `Key Details`, `Related`. Source: `documentation/conventions/documentation-format.md` (exists), visible in all documentation files.

### Negative Facts

56. **No existing polarrecorder code exists.** This is a new project. The `polarrecorder` plugin directory does not exist.

57. **No notification/subscription mechanism in the AvNav store.** There is no callback, event, or pub/sub for store value changes. Plugins must poll via `getSingleValue` or synchronize via `fetchFromQueue`. Source: exhaustive review of `avnav_store.py`.

58. **No VWT sentence parser.** AvNav does not parse the VWT (True Wind relative to bow, 0–180 with L/R indicator) sentence. Only MWV with T reference and MWD are parsed for true wind. Source: exhaustive search of `avnav_nmea.py`.

59. **dyninstruments uses plugin.mjs as the entry point**, not plugin.js. Plugin.js exists but is a legacy stub. Source: `plugin.mjs:70` (default export `initDyniPlugin`), `plugin.js:1` (minimal legacy adapter).

60. **dyninstruments is JS-only (no Python).** It has no `plugin.py` because it is a pure client-side widget plugin. The polarrecorder is fundamentally different: it is a Python-first server-side plugin with a lightweight JS viewer. Source: absence of `plugin.py` in dyninstruments root.

---

## 4. Product Scope

### Final-Product Vision

polarrecorder is an always-on, zero-interaction background AvNav plugin that continuously learns a sailing polar diagram from real vessel data. It runs whenever AvNav runs, automatically distinguishes sailing from non-sailing conditions, and builds a realistic polar over weeks and months of use.

The user never starts or stops a recording session. The plugin autonomously detects and rejects bad data (engine use, anchoring, maneuvers, sensor errors) using best-effort heuristics on available signals.

The learned polar represents **realistic expected speed under normal sailing conditions** — suitable for feeding into passage planners (e.g., Windy Passage Planner). It is not a theoretical maximum.

### Sailboat vs. Motorboat Distinction

This product is a **sailing polar recorder for sailboats**, including sailboats with auxiliary engines.

The core polar model relates TWA (True Wind Angle) and TWS (True Wind Speed) to STW (Speed Through Water). This relationship is physically meaningful only for sailing vessels where wind is the primary propulsion.

A motorboat performance model is a **different product**. Motorboat speed should be modeled against RPM, throttle/load, sea state, trim, current, and displacement/planing state — not against TWA/TWS. polarrecorder does not attempt to serve this use case.

polarrecorder is useful on motor-equipped sailboats precisely because it must detect and exclude engine use from sailing-polar learning.

### Worst-Case Data Mode (MVP)

Only three AvNav store keys are required:

- `gps.trueWindAngle` (degrees, 0–360)
- `gps.trueWindSpeed` (m/s)
- `gps.waterSpeed` (m/s)

With only these three values, the plugin can learn a polar but cannot reliably detect engine use, waves, reefing, sail changes, current, shallow water, or bad trim. The validation pipeline does its best with rate-of-change analysis, stability windows, and range checks.

### Enhanced Data Mode (Post-MVP)

Additional AvNav store keys improve bad-data detection when available:

| Signal | AvNav Key | Enhancement |
|---|---|---|
| SOG | `gps.speed` | Detect current, sensor mismatch, abnormal slip |
| COG | `gps.track` | Detect turns, maneuvers, leeway |
| Heading | `gps.headingTrue` | Detect turns, maneuvers |
| AWA | `gps.windAngle` | Cross-check true wind plausibility: given STW, AWA, and AWS, compute expected TWA/TWS and compare against reported values. Large discrepancies indicate sensor error or inconsistent calibration. |
| AWS | `gps.windSpeed` | Cross-check true wind plausibility (used together with AWA). Detect implausible wind triangles. |
| Depth | `gps.depthBelowTransducer` | Reject shallow-water samples |
| Position | `gps.lat`, `gps.lon` | Harbor/anchor detection (future, not planned) |
| Current | `gps.currentSet`, `gps.currentDrift` | Detect and compensate current effect |
| RPM | custom key (not in AvNav core) | Reject engine/motor-sailing samples |
| Engine state | custom key | Reject engine-on samples |
| Heel | custom key | Infer overpowered/underpowered, sailing state |
| User pause | custom key | Manual exclusion |

None of these are required for MVP. The architecture must define clean extension points for adding optional signal validators.

### MVP Boundary

In MVP:

- Plugin skeleton with full dev/test/docs infrastructure.
- Background sampler coupled to NMEA queue.
- Store value reader with freshness/staleness checks.
- Full validation pipeline (all rules using TWA/TWS/STW only).
- Histogram-per-bin model with configurable percentile (default P65).
- JSON persistence with 5-minute flush, atomic write, backup, corruption recovery.
- API endpoints: status, polar, rejections, export, config, reset, pause/resume.
- User app with polar diagram, controls, export configurator (presets with editable grids), rejection timeline.
- 4-hour in-memory rejection timeline as 1-minute decision buckets.
- Aggregated rejection counters in persistence.
- Editable parameters via AvNav config UI.

### Post-MVP Roadmap

- Optional signal hooks (RPM, depth, SOG, heel, AWA/AWS true-wind cross-check, etc.).
- Port/starboard comparison view (data already collected at 360°).
- Import/restore from own JSON format.
- Target polar overlay (compare learned vs. published polars).
- Dashboard status widget for AvNav instrument panel.
- Additional export format presets (Expedition, ORC).
- Sail-state separation (full sail, reefed, storm sail).

### Exclusions

- Motorboat performance modeling: explicitly out of scope.
- Harbor/anchor geofence detection via position: removed from roadmap.
- Cloud services, network communication, telemetry: never.
- Modification of AvNav source code: never.
- License: intentionally omitted. The 1.0.0 release ships with **no `LICENSE` file** (legally all-rights-reserved). This is a deliberate, accepted state for now; a license is to be chosen later, before any wider public distribution. Releasing the 1.0.0 artifact is **not** gated on this decision.

---

## 5. Data Quality Threat Model

This section catalogs every known source of faulty data and classifies its detectability with the available signals.

### Threat Classification Legend

- **D-TWA/TWS/STW** — Detectable with only the core three values.
- **P-TWA/TWS/STW** — Partially detectable with heuristics on the core three values.
- **D-Enhanced** — Detectable only with additional signals.
- **N** — Not reliably detectable.

### Threat Catalog

| # | Threat | Detectability | Detection Method | Mitigation |
|---|---|---|---|---|
| T1 | Anchored / at anchor | P-TWA/TWS/STW | Very low STW (< 0.3 kt) with non-zero TWS. | Reject: STW below configurable floor. Counter: `reject_anchored`. |
| T2 | Harbor / marina movement | P-TWA/TWS/STW | Low STW, erratic TWA changes. | Reject: stability window fails. Counter: `reject_unstable`. |
| T3 | Drifting (engine off, no sails) | N (MVP) | Very low STW relative to TWS; poor TWA/STW correlation. Ratio-based detection requires an already-learned polar (chicken-and-egg problem). | Not reliably detectable in MVP. R10 catches extreme cases (STW < 0.3 kt). Histogram P65 resists moderate poisoning. Enhanced: learned-polar comparison could detect post-MVP. |
| T4 | Engine use (motoring) | P-TWA/TWS/STW | Low TWS with moderate STW suggests motoring. No TWA/STW correlation. | Quarantine: low-wind + moderate STW heuristic. Counter: `quarantine_engine_suspected`. Enhanced: RPM key rejects definitively. |
| T5 | Motor-sailing | N (MVP) | STW may look normal; TWA/TWS present. Invisible to TWA/TWS/STW. | Not reliably detectable in MVP. Histogram P65 resists moderate poisoning. Enhanced: RPM key detects. |
| T6 | Waves and swell | N | Causes STW oscillation but no clear signature in averaged values. | Not detectable. Stability window partially mitigates by requiring sustained conditions. |
| T7 | Shallow water | D-Enhanced | STW may be reduced (squat effect) but undetectable from STW alone. | Enhanced: depth key rejects below threshold. Counter: `reject_shallow`. |
| T8 | Current | P-TWA/TWS/STW | STW may differ from expected polar speed, but current is not directly observable. | Not directly detectable. Enhanced: SOG/STW comparison detects abnormal slip. Enhanced: `gps.currentDrift` available on some systems. |
| T9 | Reefing / sail changes | N | Performance changes but TWA/TWS/STW pattern looks like valid sailing. | Not detectable. Histogram P65 learns realistic performance across sail configurations. Enhanced: user sail-state key separates. |
| T10 | Bad sail trim | N | Performance reduced but indistinguishable from a slow boat. | Not detectable. P65 percentile absorbs some bad-trim samples. |
| T11 | Tacking | D-TWA/TWS/STW | Rapid TWA change (port↔starboard crossing through head-to-wind). | Reject: TWA rate-of-change exceeds threshold → maneuver cooldown. Counter: `reject_twa_roc`. |
| T12 | Gybing | D-TWA/TWS/STW | Rapid TWA change (crossing through dead downwind). | Reject: TWA rate-of-change exceeds threshold → maneuver cooldown. Counter: `reject_twa_roc` (same rule as T11; tack/gybe distinction is post-MVP). |
| T13 | Turning (course change) | P-TWA/TWS/STW | TWA changes but could also be wind shift. Enhanced: COG/heading confirms. | Reject: TWA rate-of-change + stability window. Counter: `reject_twa_roc` / `reject_unstable`. Enhanced: heading rate-of-change confirms turn. |
| T14 | Acceleration/deceleration transients | D-TWA/TWS/STW | STW rate-of-change exceeds threshold. | Reject: STW acceleration spike. Counter: `reject_stw_roc`. |
| T15 | Stale AvNav values | D-TWA/TWS/STW | `DataEntry.timestamp` older than `now - expiryPeriod` → `getSingleValue` returns `None`. Additionally, timestamp age checked against configurable stale threshold. | Reject: stale value detected. Counter: `reject_stale_twa`, `reject_stale_tws`, `reject_stale_stw`. |
| T16 | Key age skew | D-TWA/TWS/STW | Timestamps of TWA, TWS, STW differ by more than a configurable threshold (the three values are from different NMEA update cycles, potentially inconsistent). | Reject: age skew exceeds threshold. Counter: `reject_age_skew`. |
| T17 | Missing required values | D-TWA/TWS/STW | `getSingleValue` returns `None` for any required key. | Reject: missing value. Counter: `reject_missing_twa`, `reject_missing_tws`, `reject_missing_stw`. |
| T18 | Sensor dropout / spike | D-TWA/TWS/STW | Value jumps to implausible reading (e.g., TWS from 12 to 80 kt in one second). | Reject: rate-of-change spike detection (R11: `reject_twa_roc`, R12: `reject_tws_roc`, R13: `reject_stw_roc`). |
| T19 | Implausible wind readings | D-TWA/TWS/STW | TWS > configurable max (e.g., > 60 kt). | Reject: range check. Counter: `reject_tws_range`. |
| T20 | Implausible speed readings | D-TWA/TWS/STW | STW > configurable max (e.g., > 40 kt). | Reject: range check. Counter: `reject_stw_range`. |
| T21 | Wrong units / configuration mistakes | P-TWA/TWS/STW | If instruments send knots but AvNav expects m/s, speeds will be ~1.94× off. Detectable by implausibility checks. | Reject: range checks catch extreme cases. Partial: moderate miscalibration is invisible. Document as known limitation. |
| T22 | Uncalibrated instruments | N | STW offset or TWS offset without clear signature. | Not detectable. P65 percentile tolerates moderate calibration error. Document as known limitation. |
| T23 | Very low wind (motoring likely) | P-TWA/TWS/STW | TWS below threshold (e.g., < 3 kt) — sailing is physically implausible for most boats. | Reject: low-wind threshold. Counter: `reject_low_wind`. |
| T24 | Head-to-wind / near-head-to-wind | D-TWA/TWS/STW | abs(TWA) < configurable threshold (e.g., < 10° or > 350°). No sailboat sails here — sensor error, in irons, or mid-tack. | Reject: head-to-wind exclusion zone. Counter: `reject_head_to_wind`. |
| T25 | Downwind instability | P-TWA/TWS/STW | Near-dead-downwind (TWA ≈ 180°) — oscillatory, hard to hold steady. | Mitigated by stability window requirement. Counter: `reject_unstable`. |
| T26 | User-paused recording | D-Enhanced | User sets pause key. | Enhanced: pause key available → reject all samples. Counter: `reject_user_paused`. |

### Honest Assessment

With only TWA/TWS/STW, the following threats **cannot be reliably detected** and will contribute samples to the learned polar:

- Drifting without sails (T3, except extreme cases caught by R10)
- Motor-sailing (T5)
- Waves/swell (T6)
- Reefing/sail changes (T9)
- Bad sail trim (T10)
- Current (T8, partially)
- Shallow water (T7)
- Moderate instrument miscalibration (T21, T22)

The P65 percentile approach absorbs these: it learns realistic expected speed across all sailing conditions the user actually experiences, rather than pretending to isolate ideal-conditions performance.

---

## 6. Concept Specification

### 6.A. ReadResult and Sample

**Two-object data flow:** The reader produces a `ReadResult` (allows `None` values). The validation pipeline runs R1 and R2 against the `ReadResult`. Only after both pass does the pipeline construct a `Sample` (all `float` fields guaranteed non-None). Rules R3–R16 operate on the `Sample`. This keeps the `Sample` type clean and avoids `Optional[float]` propagation through the entire pipeline. The runner **returns the constructed `Sample` (or `None` on an R1/R2 rejection) together with the `PipelineResult`** — `run(...) -> tuple[PipelineResult, Sample | None]` — so `plugin.py` can feed that same `Sample` to `ValidationState.observe()` and the `PolarModel` update contract without rebuilding it (see "Pipeline runner return type" in §6.C).

**`ReadResult`** is the raw output of the store reader. Defined in `polarrecorder/sample.py` alongside `Sample` (both are pipeline data types; `reader.py` and `validation/rules_core.py` both import from `sample.py`, avoiding a cross-layer dependency):

```
ReadResult:
  timestamp_monotonic: float     # time.monotonic() at read time
  timestamp_wall: float          # time.time() at read time (for timeline display)
  twa_raw: float | None          # raw store value (degrees, 0–360), None if missing/expired
  tws_raw: float | None          # raw store value (m/s), None if missing/expired
  stw_raw: float | None          # raw store value (m/s), None if missing/expired
  twa_timestamp: float | None    # DataEntry.timestamp (monotonic) if value present, else None
  tws_timestamp: float | None    # DataEntry.timestamp (monotonic) if value present, else None
  stw_timestamp: float | None    # DataEntry.timestamp (monotonic) if value present, else None
```

The reader calls `api.getSingleValue(key, includeInfo=True)` for each core key. If the return is `None` (expired or never set), the corresponding `*_raw` and `*_timestamp` fields are `None`. If non-None, `*_raw = entry.value` and `*_timestamp = entry.timestamp`.

**`Sample`** is the normalized, validated object that flows through rules R3–R16. Constructed only after R1 (`finite_values`) and R2 (`required_keys`) pass on the `ReadResult`.

```
Sample:
  timestamp_monotonic: float     # time.monotonic() at read time
  timestamp_wall: float          # time.time() at read time (for timeline display)
  twa_deg_raw: float             # raw store value, 0–360
  twa_deg_abs: float             # normalized to 0–180 (abs distance from head-to-wind)
  twa_deg_signed: float          # normalized to -180..+180 (negative=port, positive=starboard)
  tws_ms: float                  # raw store value in m/s
  tws_kt: float                  # converted to knots for binning
  stw_ms: float                  # raw store value in m/s
  stw_kt: float                  # converted to knots for binning
  freshness:
    twa_age_s: float             # time since TWA store update
    tws_age_s: float             # time since TWS store update
    stw_age_s: float             # time since STW store update
    max_age_s: float             # max of the three
    age_skew_s: float            # max minus min of the three
  enhanced: dict | None          # optional enhanced signal values
```

**Unit conversion constants:** 1 m/s = 1.94384 knots. Internal computation in knots (matching bin resolution and display). AvNav values arrive in m/s and are converted immediately on read.

### 6.B. Binning

**Internal bin grid:** 1° TWA across 0–359° (360 bins) × 1 kt TWS across 0–60 kt (61 bins) = 21,960 bin cells.

**Bin address computation:** `twa_bin = round(twa_deg_raw) % 360` (Python's built-in `round()`, which uses banker's rounding / round-half-to-even, then modulo). `tws_bin = round(tws_kt)` clamped to 0–60. At 1° and 1 kt resolution the half-integer boundary behavior is negligible, but the rounding rule must be consistent, documented, and tested. Do NOT implement a custom rounding function — use Python's `round()` directly.

**Per-bin data structure:**

```
Bin:
  twa_deg: int                   # bin center, 0–359
  tws_kt: int                    # bin center, 0–60
  histogram: dict[int, int]      # speed histogram: {speed_deciknot: count}
                                 # key = round(stw_kt * 10), value = sample count
                                 # e.g., {58: 12, 59: 47, 60: 31} for 5.8–6.0 kt range
  total_accepted: int            # total accepted samples ever
  total_rejected: int            # quality-gate rejections at this bin (R11–R14, R15 `reject_unstable` only; see note below)
  total_quarantined: int         # quality-gate quarantines at this bin (R16 only)
  last_update_wall: float        # wall-clock time of last accepted sample
  rejection_histogram: dict[str, int]  # {reason_code: count} (R11–R14, R15 `reject_unstable`, R16 only)
```

**`PolarModel` update contract:** Per loop iteration that produced a `Sample`, `plugin.py` (under the lock) invokes the pure orchestration function **`commit.commit_sample(pipeline_result, sample, model)` (Layer 12)**, which — selecting by the `PipelineResult` — calls exactly one of the following (or none). Centralizing the decision→method dispatch in one tested function (rather than inlining the branching in `plugin.py`) is what lets the Phase 5 poisoning suite exercise the *exact* production dispatch path; see Layer 12 and Phase 5. The model computes the bin address internally (via `bins.py`); callers never pass a bin address. Bins are sparse — a bin is created on first contact.

- `update_accepted(sample) -> None` — accepted sample. Appends `round(sample.stw_kt * 10)` to the bin's `histogram`, increments `total_accepted`, sets `last_update_wall`, and bumps `generation`.
- `record_rejection(sample, reason_codes) -> None` — **quality-gate rejection only (R11–R14, R15 `reject_unstable`)**, i.e. called only when `PipelineResult.is_sailing_candidate is True` and the decision is `rejected`. Because the runner sets `is_sailing_candidate = False` for an R15 `reject_warming_up` rejection (§6.C2), warming-up samples never reach this method — they touch no bin. Increments the bin's `total_rejected` and its `rejection_histogram` for each reason code. Does **not** bump `generation` (no curve change).
- `record_quarantine(sample, reason_code) -> None` — **R16 quarantine only**. Increments the bin's `total_quarantined` and its `rejection_histogram`. Does not bump `generation`.

Candidacy-gate rejections (R1–R10), R15 `reject_warming_up` rejections, and pause/disabled iterations do **not** touch `PolarModel` — their values are missing, stale, out-of-range, otherwise unfit to assign a meaningful bin coordinate, or (warm-up) not yet judgeable. They are recorded only in the global counters and the timeline (§6.C2). This restricts per-bin diagnostics to samples whose TWA/TWS/STW are known plausible (R1–R10 passed), so every bin coordinate is real. `reset()` clears all bins/histograms and bumps `generation`. `query(percentile) -> dict[tuple[int, int], float]` is the **per-bin** read accessor: it returns `{(twa, tws): percentile_stw}` for every populated bin (each value computed by `histogram.percentile`), used by tests and any per-bin consumer. **`PolarModel` does NOT perform the coarse export-grid projection** (the fold-to-0–180° + midpoint-boundary merge across a TWA/TWS grid). That projection lives solely in `export.py` (§6.F, Layer 8) and operates on a **detached snapshot** of the model's sparse bins, which `PolarModel` exposes via `snapshot_bins() -> dict[tuple[int, int], dict]`. **`snapshot_bins()` is the read accessor used by every API read path** (`GET polar` and `GET export`): it returns a brand-new dict mapping each populated bin's `(twa, tws)` coordinate to a plain detached dict — a fresh `dict(...)` copy of that bin's `histogram` (deciknot → count) plus the bin's scalar totals (`total_accepted`, `total_rejected`, `total_quarantined`, `last_update_wall`) and a fresh `dict(...)` copy of its `rejection_histogram`. Because every nested dict is freshly copied (histogram values are plain `int`s, so a shallow `dict(...)` per histogram is a complete detach — no `copy.deepcopy` needed), the returned structure shares no mutable object with the live model. This is what lets `plugin.py` snapshot under the lock and then run the (pure) projection/formatters **outside** the lock without racing the sampling thread's in-place `update_accepted` mutations (§7 Thread Safety). `iter_bins()`/`bins` may still exist for in-process, single-threaded consumers (e.g. `persistence.serialize_to_dict` runs while the caller holds the lock), but the **API read path must use `snapshot_bins()`**, never the live `iter_bins()` objects. This keeps the two modules' responsibilities disjoint: `polar_model.py` = per-bin storage, per-bin percentile, and detached snapshotting; `export.py` = grid-level projection and CSV.

**Percentile extraction:** Given a histogram and a target percentile P (default 65), compute the P-th percentile of the represented distribution:

1. Collect all `(deciknot_key, count)` pairs and sort by key ascending.
2. Compute `total = sum(all counts)`. If `total == 0`, return `None` (no data).
3. Compute `target_rank = (P / 100) * total` (fractional).
4. Walk keys from lowest to highest, accumulating counts. The percentile is the **first key** at which the cumulative count is `>= target_rank`. Return that key converted to knots (`key / 10.0`).
5. This is a **nearest-rank method**: the percentile is the value at the smallest key whose cumulative count reaches `target_rank`. There is no interpolation and no midpoint averaging: the result is always an observed deciknot value, never a fabricated fraction between two keys. (Note: this is **not** identical to NumPy's `percentile(..., method='lower')`, which interpolates a virtual index over `n-1`; the two agree on the worked examples below but can differ by one key in small or edge distributions — e.g. `{58:1, 61:1}` at P51 yields key 61 here versus 58 under NumPy `'lower'`. The algorithm specified in steps 1–5 — not any NumPy method — is the normative definition, locked by the acceptance tests in §11.) This makes the function simple, fully deterministic, and trivially monotonic non-decreasing in `P` (raising `P` raises `target_rank`, which can only move the crossing to an equal-or-higher key). Worked example: histogram `{58: 12, 59: 47, 60: 31, 61: 18}`, P65 → `total = 108`, `target_rank = 0.65 * 108 = 70.2`; cumulative reaches 90 at key 60 (first crossing of 70.2), so P65 = **6.0 kt**. Exact-boundary example: `{58: 50, 60: 50}`, P50 → `target_rank = 50.0`; cumulative reaches exactly 50 at key 58 (which satisfies `>= 50.0`), so P50 = **5.8 kt** (the lower key — no midpoint averaging).

This is a pure function in `polarrecorder/histogram.py`, tested with known inputs and expected outputs. Changing the percentile requires no re-learning — it is recomputed on the fly from existing histograms.

**Display units:** Speeds displayed and exported in knots. Angles in degrees. Internal computation in knots and degrees.

**Export grid projection:** The export takes a list of target TWA values (e.g., `[0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]`) and a list of target TWS values (e.g., `[4, 6, 8, 10, 12, 14, 16, 20, 25]`). Both lists must be sorted ascending. The projection uses **midpoint-boundary merging**: each export cell owns all raw bins in the region halfway to its neighboring export values. This ensures every raw bin contributes to exactly one export cell and no information is lost regardless of the export grid chosen.

**Boundary computation:** For a sorted list of export values `[v0, v1, v2, …, vN]`, the boundaries for cell `vi` are:

- Lower bound: `(v[i-1] + v[i]) / 2` (midpoint to previous). For the first cell (`i=0`): lower bound is 0 (both TWA and TWS have a natural floor of 0).
- Upper bound: `(v[i] + v[i+1]) / 2` (midpoint to next). For the last cell (`i=N`): upper bound is the **fixed axis maximum** — `180°` for TWA (the fold ceiling) and the **bin-grid TWS ceiling of 60 kt** for TWS. Both are named constants (the TWS ceiling, e.g. `TWS_BIN_MAX = 60` in `bins.py`, reused by `export.py`), **not** `max_tws`. The projection axis is decoupled from `max_tws` on purpose: `max_tws` is a validation/input threshold (R6 and inline-param bounds), whereas the projection sweeps the fixed 0–60 bin grid. Tying the last-cell bound to `max_tws` would invert the interval when a preset's largest TWS value exceeds a lowered `max_tws` (e.g. the built-in Windy `25` column with `max_tws=20` would yield `[22.5, 20]`); using the constant 60 makes the last cell `[lower, 60]`, which always captures every populated high-wind bin and can never invert.
- A raw bin belongs to a cell if `lower_bound <= bin_center < upper_bound` (half-open interval, lower-inclusive). The last cell uses `<=` on both sides (closed upper bound) to capture the axis maximum.

**Example — Windy TWA `[0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]`:** Cell TWA=0 owns [0°, 15°). Cell TWA=30 owns [15°, 35°). Cell TWA=40 owns [35°, 46°). Cell TWA=180 owns [172.5°, 180°].

**Example — Windy TWS `[4, 6, 8, 10, 12, 14, 16, 20, 25]`:** Cell TWS=4 owns [0, 5). Cell TWS=6 owns [5, 7). Cell TWS=25 owns [22.5, 60]. The last cell captures all high-wind data.

**Per-cell procedure:**

1. Fold 360° raw bins to 0–180°: combine bins at `twa` and `360 - twa` (port and starboard). **Edge cases:** TWA=0° and TWA=180° are self-paired (`360 - 0 = 360 ≡ 0`, `360 - 180 = 180`); do NOT double-count these — they have no port/starboard counterpart.
2. Collect all folded raw bins whose TWA center falls within the cell's TWA boundaries AND whose TWS center falls within the cell's TWS boundaries.
3. Merge their histograms (sum counts for each deciknot key across all collected bins).
4. Extract the configured percentile from the merged histogram.
5. If insufficient data (below the caller-supplied `min_samples` floor), leave the cell empty. The projection function takes `min_samples` as an explicit parameter so the single algorithm serves every caller with the floor it wants; the floor is never hardcoded inside the projection. The floors are a single shared constant plus one editable threshold:
   - **Display floor — `MIN_SAMPLES_DISPLAY = 3`** (a named constant in `polarrecorder/export.py`). Used by the polar diagram (`GET /api/polar`) so it renders low-confidence segments (see §6.G.3), **and** as the **default** floor for CSV export (`GET /api/export`). Sharing the floor (and the percentile and the single projection function) keeps the diagram and the default export *consistent*: the same `MIN_SAMPLES_DISPLAY` threshold decides which cells are too sparse to populate in both, and the default vs. `high_confidence` export differ **only** by the floor. They are **not** literally the same cells, however — the diagram always projects onto a **1° TWA grid** (181 points; the preset's `twa` rows are ignored by `/api/polar`, §6.F) while the CSV export projects onto the **preset's coarser TWA rows**, so a coarse export row merges many more raw bins than a 1° diagram cell and its percentile value differs accordingly. The cell-for-cell "what you see is what you download" guarantee belongs to the **Export-tab CSV text preview** (§6.G.6), which calls the same endpoint with the same params as the download — not to the polar diagram.
   - **High-confidence threshold — `min_samples_for_export`** (editable param, default 10, conservative). Used by CSV export **only when the request opts into high-confidence mode** (`high_confidence=yes`, see §6.F `GET /api/export`). It is the stricter, opt-in floor for users who want only well-sampled cells.

   In short: `GET /api/polar` always passes `MIN_SAMPLES_DISPLAY`; `GET /api/export` passes `MIN_SAMPLES_DISPLAY` by default and `min_samples_for_export` when `high_confidence=yes`. Because the default export and the diagram share `MIN_SAMPLES_DISPLAY` (and the percentile and projection function), the floor that hides a sparse segment in the diagram also drops it from the default export — changing the display floor moves both together. (This is floor/percentile alignment, not TWA-cell identity; see the resolution note above for why the two grids differ.)

**Export presets:**

**Windy Passage Planner preset:**

TWA values: `[0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180]`
TWS values: `[4, 6, 8, 10, 12, 14, 16, 20, 25]`

CSV format (semicolon-delimited, compatible with Windy import):

```
TWA\TWS;4;6;8;10;12;14;16;20;25
0;;;;;;;;;
30;;;;;;;;;
40;1.8;2.5;3.2;3.8;4.2;4.4;4.6;4.8;4.9
52;3.2;4.1;5.0;5.8;6.3;6.5;6.7;6.9;7.0
60;3.5;4.5;5.4;6.2;6.8;7.0;7.2;7.4;7.5
75;3.8;4.9;5.9;6.7;7.3;7.6;7.8;8.0;8.1
...
180;2.8;3.6;4.4;5.1;5.6;5.8;6.0;6.2;6.3
```

Rules: first row is header. First column is TWA. Values are STW in knots, rounded to 1 decimal place. Empty cells (insufficient data) are left blank (two consecutive semicolons). No trailing semicolon. Line endings: `\r\n` (Windows-style, for broadest spreadsheet compatibility). UTF-8 encoding, no BOM.

**User-saved presets:** Users can save custom TWA/TWS grid configurations as named presets for reuse. Presets are stored in `<plugin_dir>/data/presets.json` (separate from `polar.json`). The Windy preset is hardcoded in `polarrecorder/export.py` and cannot be deleted. There is no limit on the number of user presets.

**Preset storage schema (`presets.json`):**

```json
{
  "schema_version": 1,
  "presets": {
    "my-planner": {"twa": [0, 30, 60, 90, 120, 150, 180], "tws": [4, 8, 12, 16, 20]},
    "light-air": {"twa": [30, 45, 60, 75, 90, 110, 135, 180], "tws": [2, 3, 4, 5, 6, 8]}
  }
}
```

**Preset persistence:** Uses the same atomic write pattern as `polar.json` (temp file → fsync → rename), including `os.makedirs(data_dir, exist_ok=True)` before write (in case `data/` does not yet exist — e.g., user saves a preset before the first polar flush). Writes only on explicit save/delete — not on the periodic flush cycle. Corruption recovery: if `presets.json` is corrupt or missing, start with no user presets (Windy built-in is always available) and log a warning. No backup file: the atomic write (temp → rename) already prevents partial-write corruption; the only remaining failure mode is a corrupt file surviving from a previous write cycle, which is recoverable only by re-creating the presets. Schema migration: if `schema_version` is unrecognized (higher than current code expects), discard user presets and start empty with a warning log.

**Preset name validation:** 1–30 characters, alphanumeric plus hyphens and spaces, trimmed. Names are case-sensitive. The name `"windy"` (case-insensitive) is reserved and cannot be used for user presets — it is the built-in preset and cannot be overwritten or deleted.

**TWA/TWS validation on save:** Same rules as the export endpoint: TWA values must be integers 0–180, sorted ascending, non-empty. TWS values must be positive integers within 1–`max_tws`, sorted ascending, non-empty. Auto-sorted on save (user need not pre-sort).

**Export `format` param resolution order (`GET /api/export`):** (1) If `twa` **and** `tws` params are both present → inline mode: use them directly (auto-sorted ascending). Passing `format` together with `twa`/`tws` is an error. (2) Else if `format` is present: (a) case-insensitive match against built-in preset names (`"windy"` → Windy built-in), (b) case-sensitive match against user preset names in `presets.json`, (c) no match → error response. (3) Neither `format` nor `twa`/`tws` supplied → default to `windy`. Supplying `twa` without `tws` or vice versa is an error. The `high_confidence` param is parsed **independently** of this mode resolution (it applies to both preset and inline mode): truthy (`yes`/`true`/`1`, case-insensitive) selects the `min_samples_for_export` floor, anything else (including absent) selects the default `MIN_SAMPLES_DISPLAY` floor (§6.B step 5). `percentile` is likewise mode-independent.

### 6.B2. Sampling Loop

**Target sampling rate:** 1 Hz (one store-value read per second). This matches the typical NMEA sentence rate for wind and speed data and provides clean 1-second deltas for rate-of-change rules.

**Loop mechanism:** `fetchFromQueue` as a blocking wake-up primitive, gated by a monotonic clock for steady 1 Hz sampling:

```python
seq = 0
last_sample_time = 0.0
self._stop_requested = False   # reset on every run() entry — AvNav reuses the instance (§7 Layer 1)
run_start_monotonic = self._clock()
last_flush_monotonic = run_start_monotonic   # first periodic flush lands one interval AFTER start, not immediately
while not api.shouldStopMainThread() and not self._stop_requested:
    seq, _ = api.fetchFromQueue(seq, 10, waitTime=0.5)
    now = self._clock()  # injected clock, default time.monotonic (see note below)
    if now - last_sample_time < sample_interval:  # sample_interval = 1.0
        continue
    last_sample_time = now
    # read store values, run pipeline, update model (under lock)
    # then, still on this (plugin) thread:
    #   if (now - last_flush_monotonic) >= flush_interval OR self._flush_requested:
    #       flush to disk (serialize under lock, write outside lock)
    #       last_flush_monotonic = now; clear _flush_requested
```

**Rationale:** `fetchFromQueue` naturally idles when no NMEA data flows (instruments off, AvNav idle), avoiding useless store polling. The fetched NMEA data is discarded — the queue is used only as a wake-up signal. The monotonic clock gate ensures a steady ~1 Hz rate regardless of NMEA burst patterns. `waitTime=0.5` means the loop re-checks its exit conditions at least every 0.5 seconds for responsive shutdown. The loop exits on **either** `api.shouldStopMainThread()` (AvNav's own stop signal) **or** the plugin's `self._stop_requested` flag (set by the restart callback — see Layer 1 in §7). Checking both is deliberate: it guarantees clean shutdown regardless of whether AvNav signals a stop by nulling its thread reference, by invoking the restart callback, or both.

**Flush check is unconditional per iteration.** Pause (§6.B3) and disabled (§6.B4) change only whether the *pipeline runs and the model updates* in a given iteration; they must **not** be implemented as an early `continue` that skips the end-of-iteration flush check. The `if (now - last_flush_monotonic) >= flush_interval OR self._flush_requested:` block runs on every iteration that passes the monotonic gate, paused or not. This is what makes the `reset` durability guarantee hold even while paused or disabled: `reset` sets `_flush_requested`, and the next gated iteration flushes the cleared state to disk regardless of recording state.

**Configurable:** `sample_interval` is an editable parameter (default 1.0 seconds, range 0.5–5.0).

**Clock injection in `plugin.py`:** Because the AvNav constructor signature is fixed (`__init__(self, api)`), `plugin.py` cannot receive a clock as a constructor argument. Instead it initializes `self._clock = time.monotonic` and `self._wall_clock = time.time` in `__init__`, and uses **`self._clock()` / `self._wall_clock()` everywhere in `run()`** — the sampling-loop gate, flush-interval tracking, `run_start_monotonic` (§6.F), and the clock/wall-clock callables it injects into `reader.py` and `timeline.py`. (`persistence.py` receives **no** clock: `plugin.py` stamps `created_wall`/`last_flush_wall` itself and passes them to `serialize_to_dict` via the `metadata` argument — see §6.E timestamp lifecycle and Layer 6.) This is the "injected clock" referenced in §6.F. `time.monotonic()` / `time.time()` are never called directly inside the loop body. `test_plugin_integration.py` overrides `plugin._clock`/`plugin._wall_clock` with a `FakeClock` after construction. To drive sampling deterministically, the integration test's fake `fetchFromQueue` **advances both injected clocks by `sample_interval` on each call** (`fetchFromQueue` runs exactly once at the top of every loop iteration, before `now = self._clock()`), so each iteration clears the `now - last_sample_time >= sample_interval` gate and produces exactly one sample. Combined with the fake API's `shouldStopMainThread` returning `True` after a controlled number of iterations, the loop takes exactly N deterministic samples with no real sleeping. (The default `FakeClock` — advance only on an explicit `.advance()` — is unchanged and remains the clock for the pure unit tests; only the integration loop wires the per-iteration advance into `fetchFromQueue`.)

### 6.B3. Pause/Resume Behavior

When recording is paused (via `GET /api/pause`), the sampling loop **continues running**. It reads store values and feeds the validation state (stability buffer, previous sample, cooldown timers) to keep them warm. However, the pipeline is not run and samples are not committed to the model.

Specifically, on each loop iteration while paused:
1. Read store values via the reader (produces `ReadResult`).
2. Call `build_sample(read_result)`. If it returns a `Sample` (values present and finite), call `ValidationState.observe(sample)` (prune+append stability buffer, update `previous_sample` — the same single maintenance method used in the normal path, §6.C). If it returns `None` (missing/non-finite values), skip the `observe()` call.
3. Record this iteration's decision in the timeline — the current 1-minute bucket: increment its `rejected` count and add `reject_user_paused` to the bucket's `reasons` (§7 Layer 9).
4. Add `reject_user_paused` to the global `rejection_histogram`. Do NOT increment `total_seen`, `total_rejected`, or any other sailing-candidate counter — a paused iteration is not a sailing candidate (see §6.C2 Counter Semantics).
5. Do NOT run the validation pipeline. Do NOT update the polar model.
6. **Status fields:** still update `last_current_values` from this read **only when `build_sample(read_result)` returned a `Sample`** (all three values present *and finite*) — using that `Sample`'s converted `twa_deg_raw`/`tws_kt`/`stw_kt`, **and retaining the read's three store monotonic timestamps (`twa_timestamp`/`tws_timestamp`/`stw_timestamp`) so `GET status` can recompute ages/stale flags at request time (§6.F, §7 Thread Safety)** — so the Status tab keeps showing live TWA/TWS/STW while paused. If `build_sample` returned `None` (a value missing **or** non-finite), leave `last_current_values` unchanged (the display freezes on the last good values). Gating on the built `Sample` rather than on mere presence guarantees no `NaN`/`Inf` ever reaches `last_current_values` and hence the `GET status` JSON (§6.F). Do **not** update `last_decision` — there is no pipeline decision while paused, and the UI suppresses the "current decision" badge whenever `recording=false` (§6.G.4), so its stale value is never displayed.

This ensures that when the user resumes, samples can be accepted immediately — no 15-second warm-up delay. The `reject_user_paused` counts accumulate in the timeline buckets so the UI can visualize the pause gap as a red band.

The `GET /api/status` response reflects `"recording": false` while paused.

### 6.B4. `record_enabled` Config vs. Pause/Resume Interaction

Two independent controls suppress recording:

- **`record_enabled`** (editable parameter, BOOLEAN, default `true`): persistent config-level recording switch. Survives restarts. Changed via AvNav settings UI. **The name `enabled` is NOT used: it is reserved by AvNav** — `pluginhandler.py:745` defines a built-in `ENABLE_PARAMETER` named `'enabled'` that AvNav auto-adds to any plugin that registers a restart handler (`pluginhandler.py:997–998`), intercepts and consumes itself (`del param['enabled']` at `pluginhandler.py:1041`, so it never reaches the plugin's change callback), and uses to **stop/start the whole plugin thread** (`api.stop()` at `pluginhandler.py:1037`). A plugin-registered `enabled` would collide on that config key and never see its own change events. `record_enabled` is therefore a distinct, plugin-owned flag whose change callback (`_on_config_change`) does fire and whose `false` state is handled by the plugin itself (loop keeps running, see below).
- **Paused** (runtime state, default `false`): transient UI-level pause. Resets to `false` on plugin restart. Changed via `GET /api/pause` and `GET /api/resume`.

`record_enabled=false` behaves identically to paused: the sampling loop continues running and warming validation state (same steps as §6.B3, substituting `reject_disabled` for `reject_user_paused`), but does not run the pipeline or update the model. Timeline entries use reason code `reject_disabled`.

`GET /api/pause` and `GET /api/resume` only affect the runtime pause state. They work regardless of the `record_enabled` setting. If both `record_enabled=false` and paused, the effect is the same as either alone (no recording). The timeline shows `reject_disabled` when `record_enabled=false` and `reject_user_paused` when paused (if both are active, `reject_disabled` takes precedence).

The `GET /api/status` response includes both fields:
- `"record_enabled": true/false` — reflects the config parameter.
- `"recording": true/false` — `true` only when `record_enabled=true` AND not paused.

The UI shows: "Recording" (green), "Paused" (amber, resume button available), "No Data" (grey, instruments offline), or "Disabled" (grey, indicates recording is switched off in AvNav settings). See Section 6.G.4 for the complete state table.

**AvNav's separate built-in `enabled` toggle (coarse kill switch).** Independently of `record_enabled`, AvNav's own built-in `enabled` toggle (auto-shown because the plugin registers a restart handler) fully **stops the plugin thread** when switched off: AvNav calls the plugin's stop handler, which sets `_stop_requested = True`, so `run()` exits its loop and performs its final flush before returning (§7 Layer 1). Re-enabling restarts the **same** plugin instance's `run()` (AvNav reuses the instance — `pluginhandler.py:935` creates it once and `:669–675` re-invoke `self.plugin.run()`), which is why `run()` must reset `_stop_requested = False` at entry (see §7 Layer 1 and §6.B2). While AvNav-disabled there is no running loop, no sampling, and no API server response from this plugin — the viewer simply shows its "Connection lost" banner (§6.G.8). This coarse toggle needs no `reject_disabled`/timeline behavior; that behavior belongs solely to the plugin-owned `record_enabled` flag, whose loop keeps running.

### 6.C. Validation Pipeline

The pipeline is a **sequence of validation rules**, each returning:

```
RuleResult:
  decision: 'accept' | 'reject' | 'quarantine' | 'pass'
  reason_codes: list[str]        # empty for 'pass'/'accept'; one code for single-value
                                 # rules (R4–R16); one-or-more for multi-value rules that
                                 # report every offending value in a single result (R3, which
                                 # may emit any of reject_stale_twa / reject_stale_tws /
                                 # reject_stale_stw). e.g., ['reject_stale_twa', 'reject_stale_stw']
```

**`RuleResult` is defined in `polarrecorder/sample.py`** (the shared pipeline-types module, alongside `ReadResult`/`Sample`/`ClockFn`/`WallClockFn`), **not** in `pipeline.py`. Both the rule modules (`rules_core`, `rules_stability`, `rules_heuristic`) and the pipeline runner import it from `sample.py`. Homing it in `pipeline.py` (next to `PipelineResult`) would force the rules to `import` from `pipeline.py` while `pipeline.py` already imports the rules — a `pipeline`↔`rules_*` circular import (a blocking smell). `sample.py` imports nothing from `validation/`, so this stays cycle-free and matches the existing dependency direction.

`'pass'` means the rule has no opinion — pass to the next rule; its `reason_codes` is the empty list. `'reject'` and `'quarantine'` are terminal for that sample and carry one or more codes. `'accept'` at the end of the pipeline means all rules returned `'pass'`. Individual rules never return `'accept'` — only the pipeline runner produces this as the final decision when no rule objected. The list shape matches `PipelineResult.reason_codes`: the runner concatenates the terminal rule's `reason_codes` (and, for R1/R2, the codes it collects itself) into the `PipelineResult`. Single-value rules (R4–R16) return a one-element list; R3, like the runner-owned R1/R2, may return several.

**Pipeline runner return type:**

```
PipelineResult:
  decision: 'accepted' | 'rejected' | 'quarantined'
  reason_codes: list[str]        # all reason codes collected (may be multiple for the multi-value
                                 # rules: R1/R2 collected by the runner, and R3 stale-values)
  is_sailing_candidate: bool     # True if the sample is a sailing candidate — the boat was
                                 # plausibly sailing AND this sample could be assessed for
                                 # data quality, so it should count toward total_seen. True for
                                 # accepted samples and for quality-gate rejections/quarantines
                                 # (R11–R14, R15 `reject_unstable`, R16). False when rejected by
                                 # any of R1–R10, AND false for an R15 `reject_warming_up`
                                 # rejection (the buffer is not yet full, so the sample cannot
                                 # be judged — "can't assess yet", not "dirty"). See "Counter
                                 # semantics" (§6.C2).
```

**Runner signature:** `run(read_result, state, config, logger=None) -> tuple[PipelineResult, Sample | None]`. The runner owns R1/R2 evaluation (against the raw `ReadResult`, so the granular per-value codes in §6.C Phase A are preserved) and `Sample` construction, and it is the **single source of truth** for both. It returns the constructed `Sample` alongside the `PipelineResult` so `plugin.py` can pass that exact `Sample` to `ValidationState.observe()` and `PolarModel.update_accepted()`/`record_rejection()`/`record_quarantine()`. The returned `Sample` is `None` exactly when R1 or R2 rejected (no `Sample` could be built); in that case the `PipelineResult` carries the R1/R2 reason codes and `plugin.py` records the timeline entry from the `ReadResult` fields it already holds (§6.C Phase A). On every non-`None` return, the `Sample`'s `float` fields are all guaranteed non-None.

Returning the `Sample` is **not** mutation: the runner does not modify the `Sample` after constructing it (and never modifies the `ReadResult`). The `Sample` is a pure data snapshot of sensor readings; the `PipelineResult` is the judgment about that snapshot. `plugin.py` uses both returned objects together when updating the timeline, counters, and model. (`plugin.py` does **not** call `build_sample()` itself on the normal path — it consumes the `Sample` the runner returns. It calls `build_sample()` directly only on the pause/disabled path, where the pipeline does not run; §6.B3, §6.B4.)

The runner sets `is_sailing_candidate = True` whenever execution reaches R11 (i.e. R1–R10 all returned `'pass'`) **except** when the terminal decision is an R15 `reject_warming_up` — that one case is set to `False`. So it is `True` for every accepted sample and for every sample rejected/quarantined by R11–R14, R15 `reject_unstable`, or R16; it is `False` when any of R1–R10 produced a terminal `'reject'`, **and** `False` when the sole terminal rejection is `reject_warming_up`. The carve-out is unambiguous because `reject_warming_up` can only be the terminal code at R15 after R11–R14 passed, so it never co-occurs with another quality-gate reject/quarantine code. Rationale: a warming-up sample passed R1–R10 (the boat is plausibly sailing) but the stability buffer is not yet full, so the pipeline cannot yet judge whether the moment is clean — that is "cannot assess yet", which belongs with the candidacy bucket ("no usable assessment right now"), not the quality bucket ("sailing but dirty"). Counting it as a quality rejection would dent `acceptance_rate` for ~15 s after every restart even though no data was actually dirty. (Pre-pipeline pause/disabled rejections never construct a `PipelineResult`; `plugin.py` treats them as non-candidates directly — see §6.C2.)

**Rule execution order** (each rule is a separate, testable module):

**Phase A — Pre-Sample checks (operate on `ReadResult`, before `Sample` construction):**

| # | Rule | Type | Description |
|---|---|---|---|
| R1 | `finite_values` | reject | All three raw values that are non-None must be numeric (`int` or `float`) and finite (not NaN, Inf). A non-None value that is not numeric is treated as non-finite. Operates on `ReadResult`. Reports all non-finite values found. Reason codes: `reject_non_finite_twa`, `reject_non_finite_tws`, `reject_non_finite_stw` (one per non-finite value; multiple may fire). |
| R2 | `required_keys` | reject | All three raw values must be non-None (present in store and not expired). Operates on `ReadResult`. Reports all missing values. Reason codes: `reject_missing_twa`, `reject_missing_tws`, `reject_missing_stw` (one per missing value; multiple may fire). |

If R1 or R2 rejects, the runner returns a `PipelineResult` carrying the collected R1/R2 reason codes (`decision = 'rejected'`, `is_sailing_candidate = False`) and a `None` `Sample` — no `Sample` is constructed. The runner itself writes nothing to the timeline or counters (it receives neither); **`plugin.py`** records this iteration's decision in the timeline (current 1-minute bucket: increment `rejected`, add the R1/R2 reason codes to the bucket's `reasons`) and updates the global `rejection_histogram` under the lock, per §6.C2. No per-sample values are stored, so the old "`None` values recorded as `null`" concern no longer applies.

**Sample construction:** After R1 and R2 pass, the pipeline constructs a `Sample` from the `ReadResult`: converts m/s to knots, normalizes TWA, computes freshness ages from the store timestamps. From this point, all fields are guaranteed non-None `float`.

**Phase B — Post-Sample checks (operate on `Sample`):**

| # | Rule | Type | Description |
|---|---|---|---|
| R3 | `stale_values` | reject | Each core value's store timestamp must be within `now - stale_threshold` (configurable, default: 3.0 seconds). Reports all stale values. Reason codes: `reject_stale_twa`, `reject_stale_tws`, `reject_stale_stw` (one per stale value; multiple may fire). |
| R4 | `age_skew` | reject | The max age difference between the three core values must be < `age_skew_threshold` (configurable, default: 2 seconds). Reason code: `reject_age_skew`. |
| R5 | `twa_range` | reject | `0 <= twa_deg_raw <= 360`. Reason code: `reject_twa_range`. |
| R6 | `tws_range` | reject | `0 <= tws_kt <= max_tws` (default: 0 <= tws <= 60 kt). Rejects negative TWS values and values exceeding the bin grid ceiling. Reason code: `reject_tws_range`. |
| R7 | `stw_range` | reject | `0 <= stw_kt <= max_stw` (default: max 40 kt). Reason code: `reject_stw_range`. |
| R8 | `head_to_wind` | reject | `twa_deg_abs < head_to_wind_threshold` (default: 10°). Reason code: `reject_head_to_wind`. |
| R9 | `low_wind` | reject | `tws_kt < low_wind_threshold` (default: 3 kt). Reason code: `reject_low_wind`. |
| R10 | `anchored_heuristic` | reject | `stw_kt < anchored_stw_threshold` (default: 0.3 kt) AND `tws_kt > 0`. Reason code: `reject_anchored`. |
| R11 | `twa_rate_of_change` | reject | abs(TWA change per second) > `twa_roc_threshold` (default: 15°/s) → maneuver detected → enter cooldown. Reason code: `reject_twa_roc`. TWA delta uses circular distance (min of clockwise and counter-clockwise). Rate = circular_distance(current_twa, previous_twa) / elapsed_seconds, where elapsed_seconds is the actual monotonic time since the previous sample (not assumed to be 1.0). **Zero/negative-elapsed guard (R11–R13):** if there is no previous sample, or `elapsed_seconds <= 0` (two samples sharing a `timestamp_monotonic`, or a non-advancing clock), no rate is computable, so the rule returns `'pass'` (no maneuver/spike asserted) — consistent with the first-sample-after-startup behavior in §6.C. The monotonic gate makes `elapsed_seconds <= 0` unreachable in production; the guard exists for direct unit tests and defensive safety. No tack/gybe/turn distinction in MVP — all are `reject_twa_roc`. |
| R12 | `tws_rate_of_change` | reject | abs(TWS change per second) > `tws_roc_threshold` (default: 10 kt/s) → gust/sensor spike. Reason code: `reject_tws_roc`. Rate = abs(current_tws - previous_tws) / elapsed_seconds. Same zero/negative-elapsed guard as R11 (returns `'pass'`). |
| R13 | `stw_acceleration` | reject | abs(STW change per second) > `stw_roc_threshold` (default: 2 kt/s) → acceleration transient. Reason code: `reject_stw_roc`. Rate = abs(current_stw - previous_stw) / elapsed_seconds. Same zero/negative-elapsed guard as R11 (returns `'pass'`). |
| R14 | `maneuver_cooldown` | reject | If a TWA maneuver (R11 only) was detected within the last `cooldown_seconds` (default: 30s), reject. Reason code: `reject_maneuver_cooldown`. R12 (TWS spike) and R13 (STW spike) reject the current sample only and do NOT trigger the cooldown timer — gusts and wave-induced speed spikes are transient events, and the stability window (R15) already catches sustained instability. |
| R15 | `stability_window` | reject | Over the last `stability_window_seconds` (default: 15s), the range (max − min) of each value in the rolling buffer must stay within bounds: TWA range < `stability_twa_range` (default: 20°, using circular range), TWS range < `stability_tws_range` (default: 10 kt), STW range < `stability_stw_range` (default: 4 kt). These bounds are deliberately wide to tolerate typical sensor noise from masthead vanes and paddle-wheel logs. Two distinct rejection conditions: (1) buffer has less than `stability_window_seconds` of data → reason code: `reject_warming_up`; (2) buffer filled but range exceeds bounds → reason code: `reject_unstable`. **"Filled" predicate (explicit):** let `now = sample.timestamp_monotonic` (the current sample being evaluated). R15 evaluates the buffer *as it stands before this sample is appended* — recall `plugin.py` calls `ValidationState.observe()` only **after** the pipeline returns (§6.C ordering), so the buffer holds prior samples only and the current reading is judged against the recent window without being a member of it. After pruning entries strictly older than `now − stability_window_seconds`, the buffer is "filled" iff it is non-empty **and** `now − oldest_retained_entry.timestamp_monotonic ≥ stability_window_seconds`; otherwise R15 returns `reject_warming_up`. (This succeeds because the prune is strict — the entry exactly at `now − window` is retained and supplies the span — and it is time-based, not count-based, so an irregular sampling gap that leaves no recent-enough oldest entry correctly keeps the rule warming.) |
| R16 | `engine_heuristic` | quarantine | TWS < `engine_tws_ceil` (default: 5 kt) AND STW > `engine_stw_floor` (default: 3 kt) → suspected motoring. Sailing at 3+ kt in under 5 kt of true wind is implausible for most cruising boats. Reason code: `quarantine_engine_suspected`. |
| R17+ | `optional_signal_*` | varies | Future: RPM, depth, SOG/STW mismatch, heading turn, AWA/AWS true-wind cross-check, user pause. Architecture provides hook. |

**Pre-pipeline reason codes:** Two additional reason codes exist outside the R1–R16 validation pipeline. These are checked in `plugin.py` *before* the pipeline runs, and appear in the timeline and rejection counters alongside rule-generated codes:

- `reject_user_paused` — recording paused via `GET /api/pause` (see §6.B4). Validation state continues warming but no samples enter the pipeline.
- `reject_disabled` — `record_enabled` parameter set to `false` in AvNav settings (see §6.B4). Takes precedence over `reject_user_paused` if both active.

The **complete set of reason codes** that can appear in timeline bucket `reasons`, per-bin rejection histograms, and global rejection histograms is: all `reject_*` and `quarantine_*` codes from R1–R16 above, plus `reject_user_paused` and `reject_disabled`.

**Circular angle math (used by R11 and R15):**

TWA values wrap at 360° (0° and 360° are the same angle). Naive subtraction gives wrong results near the wrap point.

- **Circular distance** (R11, rate-of-change): `delta = min(abs(a - b), 360 - abs(a - b))`. This gives the shortest angular path between two angles.
- **Circular range** (R15, stability window): Given a list of TWA values, the circular range is the smallest arc that contains all values. Algorithm: sort the angles, compute the gap between each consecutive pair (including the wrap-around gap from the last to the first + 360°), find the largest gap. The circular range is `360° - largest_gap`. If all values are identical, the range is 0°. This is a pure function in `polarrecorder/validation/angle_math.py`.

**Each rule is a pure function** (or stateful where needed for rolling windows) with a clear interface. Rules R11–R15 require state (previous samples, cooldown timer, stability window buffer). This state is held in a `ValidationState` object that is separate from the rules themselves, passed by reference on each sample.

**Rule function contract (explicit — the runner calls each rule in order, not via a uniform list).** Every rule function returns a `RuleResult` and takes **only the arguments it needs** — there is deliberately no single uniform signature, because the `ARG` (unused-argument) smell is blocking for `polarrecorder/` (no ARG exemption outside `tests/**`, §8), so a uniform `(sample, state, config)` shape would force stateless rules to carry an unused `state` and fail the gate. The runner therefore sequences the rules explicitly (the intra-iteration ordering above — R11 *sets* the cooldown R14 *reads*, R11–R13 run before `observe()` — already requires explicit sequencing rather than a generic loop) and supplies each rule exactly its arguments:

- **R1/R2** (`finite_values(read_result)`, `required_keys(read_result)`): take the `ReadResult`; owned and called by the runner (Phase A), before `Sample` construction.
- **R3–R10** (stateless `Sample` checks): `rule(sample: Sample, config: Config) -> RuleResult`. (R5–R8/R10 read their thresholds from `config`; R3/R4 also read freshness fields off the `Sample`.)
- **R11–R15** (stateful): `rule(sample: Sample, state: ValidationState, config: Config) -> RuleResult`. R11 may write `state.cooldown_expires`; R14 reads it; R15 reads the stability buffer. None of them call `observe()` (that is `plugin.py`'s post-pipeline step, §6.C ordering).
- **R16** (`engine_heuristic(sample: Sample, config: Config) -> RuleResult`): stateless quarantine check.

Rules that emit diagnostics (none required in MVP) would follow the optional-`logger` convention used elsewhere. The runner imports each rule from its module (`rules_core`, `rules_stability`, `rules_heuristic`) and `RuleResult` from `sample.py`; it never imports `pipeline.py` symbols into the rules (preserving the no-cycle rule, §6.C).

**ValidationState update policy (when the buffer and `previous_sample` change):** `ValidationState` maintenance is a step **separate from rule evaluation** and has a **single implementation**: the method `ValidationState.observe(sample)`, which prunes-and-appends the sample to the stability buffer (time-stamped) and sets `previous_sample` to the current sample. `observe()` contains **no cooldown logic** — the cooldown timer is set exclusively by R11 during rule evaluation (see ordering below). The pipeline runner **never calls `observe()`**; it only reads prior state (and R11 may set the cooldown timer). `observe()` is called by **`plugin.py`**, exactly once per valid `Sample` (i.e. `build_sample` returned non-None) — whether the sample is later accepted, rejected, quarantined, in cooldown, or the loop is paused/disabled (§6.B3, §6.B4) — *after* the pipeline runs (normal path) or *after* `build_sample` (pause/disabled path). Because `plugin.py` calls `observe()` unconditionally for every valid `Sample`, the buffer is structurally guaranteed to fill from **all** valid samples, not just accepted ones (otherwise R15 could never fill or reject — it would be circular), and the normal and pause/disabled paths stay symmetric with no duplicated maintenance code.

Ordering within a single iteration is strict:
1. Run the rate-of-change rules (R11–R13), which read the **existing** `previous_sample` to compute deltas. `previous_sample` must NOT be updated before these rules run, or every delta would be zero.
2. Run the remaining rules (R14 cooldown reads the cooldown timer set by R11; R15 reads the stability buffer).
3. After the pipeline returns but **before** `observe()` runs (i.e. while the buffer still holds prior samples only — the exact state R15 judged), `plugin.py` computes and stores the status `warming_up` flag as `state.is_warming_up(now_monotonic)`, passing the **same `now` R15 used this iteration**: `sample.timestamp_monotonic` whenever a `Sample` exists (the normal path, and the pause/disabled path when `build_sample` returned a `Sample`), or `self._clock()` when no `Sample` was built (a missing/non-finite read during pause/disabled, where `observe()` is skipped). Computing it pre-`observe()` against R15's `now` is what makes the stored `warming_up` flag agree with R15's `reject_warming_up` branch (§7 Layer 4 `is_warming_up`). On the normal path this equals `("reject_warming_up" in pipeline_result.reason_codes)` by construction; the explicit `is_warming_up(now)` call is used uniformly so the pause/disabled path (no `PipelineResult`) is covered by the same code.
4. Then `plugin.py` calls `ValidationState.observe(sample)` to perform maintenance: prune-and-append the current sample to the stability buffer and set `previous_sample`. The `sample` passed to `observe()` is the one **returned by the runner** alongside the `PipelineResult` (non-`None` whenever R1/R2 passed) — `plugin.py` does not rebuild it. (During pause/disabled the pipeline does not run, so `plugin.py` calls `build_sample(read_result)` itself and then `observe(sample)` — the same single method; on a missing/non-finite read `build_sample` returns `None`, so step 4 is skipped and only the step-3 `warming_up` update with `self._clock()` runs.)

Because samples are appended continuously through a maneuver cooldown, and `cooldown_seconds` (default 30s) is deliberately longer than `stability_window_seconds` (default 15s), the high-swing maneuver samples are pruned out of the stability window before the cooldown ends — so when R14 stops rejecting, R15 evaluates only post-maneuver conditions and accepts only if they are genuinely stable. **Known limitation:** no cross-validation is performed between `cooldown_seconds` and `stability_window_seconds`. If a user configures `cooldown_seconds < stability_window_seconds`, the guarantee breaks: the first accepted sample after a maneuver may still have turbulent readings in its stability window. This is documented in `documentation/user/configuration.md` and `documentation/user/troubleshooting.md` as a user responsibility — the config UI shows both parameters together to make the relationship visible. The first valid sample after startup/restart has an empty buffer and no `previous_sample`: R11–R13 pass trivially (no delta) and R15 rejects with `reject_warming_up` until the buffer spans `stability_window_seconds`.

**Warm-up after startup:** On plugin start (or restart), `ValidationState` is empty. Rate-of-change rules (R11–R13) need at least one previous sample, so the first sample always passes those rules trivially (no delta to compute). The stability window (R15) requires `stability_window_seconds` (default 15s) of buffered values, so it rejects all samples until the buffer fills with reason code `reject_warming_up`. This creates a natural ~15-second warm-up period where no samples are accepted. This is correct and intentional — it ensures the first accepted sample has verified stable conditions. Warming-up rejections are **not** sailing candidates: they do not increment `total_seen`/`total_rejected` and so do not dent `acceptance_rate` after a restart (§6.C2). The `GET /api/status` response includes a `warming_up` boolean (true when the stability buffer has not yet filled) so the UI can display "Warming up..." instead of showing a stream of rejections.

### 6.C2. Counter Semantics

The four global counters are scoped to **sailing candidates** so that `acceptance_rate` reflects data quality while actually sailing, not wall-clock utilization. A sailing candidate is any sample for which the pipeline can actually assess sailing-data quality at that moment — meaning the boat is plausibly sailing *and* there is enough buffered history to judge stability.

**Candidacy gate** = not paused, not disabled, passes all of R1–R10, **and** is not an R15 `reject_warming_up` rejection:
- Pre-pipeline gates: not paused (`reject_user_paused`), not disabled (`reject_disabled`).
- R1 finite, R2 required keys, R3 stale, R4 age skew, R5 TWA range, R6 TWS range, R7 STW range, R8 head-to-wind, R9 low wind, R10 anchored.
- **Warm-up exclusion:** a sample that passed R1–R10 but is rejected solely by R15's `reject_warming_up` branch (stability buffer not yet full) is **not** a candidate — the pipeline cannot yet judge it. This is the only quality-gate code that maps to non-candidacy, and it is carved out at the runner via `is_sailing_candidate = False` (§6.C "Runner signature"). It is unambiguous because `reject_warming_up` only fires at R15 after R11–R14 pass, so it never co-occurs with another quality code.

These outcomes all mean "there is no usable sailing assessment right now" (instruments off/stale, in harbor, anchored, head-to-wind, becalmed, or still warming up after a restart). They do **not** count toward `total_seen`.

**Quality gate** = R11–R14, R15 `reject_unstable`, and R16 (rate-of-change, maneuver cooldown, sustained instability, engine heuristic). These operate only on samples that already passed the candidacy gate — the boat is sailing, the buffer is warm enough to judge, but the moment may not be clean enough to learn from. (R15's other branch, `reject_warming_up`, is *not* a quality-gate outcome — see the warm-up exclusion above.)

**Counter update rules** (all performed by `plugin.py` under the lock):

1. **Every** loop iteration (paused, disabled, rejected, quarantined, or accepted) records its decision in the timeline — the current 1-minute bucket (incrementing the matching `accepted`/`rejected`/`quarantined` count and adding its reason code(s) to that bucket's `reasons`) — and adds its reason code(s) to the global `rejection_histogram`. This is for diagnostics — it captures everything that happens.
2. A sample increments `total_seen` **only if** it is a sailing candidate — i.e. `PipelineResult.is_sailing_candidate` is `True`. Pre-pipeline rejections (paused/disabled, where no pipeline runs), R1–R10 rejections, and R15 `reject_warming_up` rejections never increment `total_seen`.
3. For a sailing candidate, exactly one of the following also increments by the pipeline decision: `total_accepted` (passed all rules), `total_rejected` (rejected by R11–R14 or R15 `reject_unstable`), `total_quarantined` (quarantined by R16). A `reject_warming_up` outcome increments none of these (it is not a candidate, per rule 2) — it appears only in the global `rejection_histogram` and the timeline (rule 1).

**Invariant:** `total_seen == total_accepted + total_rejected + total_quarantined`.

**`acceptance_rate` = `total_accepted / total_seen`** (returns `0.0` when `total_seen == 0`). It answers: "while actually sailing, what fraction of data was clean enough to learn from?"

**Three distinct totals exist by design — do not assume they are equal:**
- `total_rejected` counts quality-gate rejections only (R11–R14, R15 `reject_unstable`) on sailing candidates. It excludes `reject_warming_up` (a non-candidate outcome).
- The global `rejection_histogram` counts **every** reason code ever emitted (candidacy-gate rejections, `reject_warming_up`, quality-gate rejections, pause, disabled). Its sum is therefore larger than `total_rejected` and must not be reconciled against it.
- Per-bin `rejection_histogram` (§6.B Bin structure) counts **quality-gate** rejections/quarantines only (R11–R14, R15 `reject_unstable`, R16), i.e. samples that passed R1–R10 and are sailing candidates so the bin coordinate is meaningful. It is a separate per-bin diagnostic populated by `PolarModel.record_rejection`/`record_quarantine` (§6.B update contract); candidacy-gate rejections (R1–R10), `reject_warming_up`, and pause/disabled iterations never reach the model and so never appear in any per-bin counter.

This subsection governs the counter behavior referenced in §6.B3 (pause), §6.B4 (enabled/disabled), §6.E (persisted counters), and §6.F (`GET status`, `GET rejections`, `reset`).

### 6.D. Poisoning Resistance

**Design philosophy:** The polar learns realistic expected performance, not theoretical maximum. With only TWA/TWS/STW, engine use, waves, reefing, current, shallow water, and bad trim cannot be fully detected. Therefore:

1. **The model does not use a naïve average.** A simple mean would be dragged down by every undetected slow sample.

2. **Histogram + percentile approach.** Each bin stores a speed frequency histogram at 0.1-knot resolution. The learned polar speed is the P65 (configurable) of the histogram. This naturally trims the bottom ~35% (catches undetected bad data) and the top ~35% (removes lucky outliers).

3. **Validation pipeline is the first defense.** The majority of bad data is caught by the 15+ rules before reaching the histogram. What enters the histogram is pre-filtered "probably sailing" data.

4. **No age decay.** Histograms accumulate indefinitely. The user can reset manually after a significant boat change (bottom clean, new sails, rig change). This is transparent and honest.

5. **Rejected and quarantined samples never enter the histogram.** They are counted in per-bin rejection counters for diagnostics only.

6. **Ambiguous samples are quarantined, not learned.** The engine heuristic (R16) quarantines rather than rejects because the evidence is weak. Quarantined samples do not enter the histogram.

7. **The percentile is configurable.** The user can change it at any time and the polar recalculates immediately from existing histograms. A racer might choose P75; a conservative passage planner might choose P50.

### 6.E. Persistence

**Format:** JSON.

**Rationale:** The entire polar model (21,960 bins × sparse histograms + metadata) serializes to a manageable JSON file. SD card write minimization is critical on Raspberry Pi. In-memory model with rare flushes is the correct strategy. JSON is human-readable, easy to inspect/debug, has no binary dependencies, and the data structure is a single document.

**File location:**

```
<plugin_dir>/data/polar.json           # primary
<plugin_dir>/data/polar.backup.json    # backup (previous version)
```

The `data/` subdirectory is created by `persistence.py`'s save function on first write (`os.makedirs(data_dir, exist_ok=True)`). It survives plugin updates (AvNav `extractall` does not delete files not in the zip). The release zip must NOT include a `data/` directory.

**Schema:**

```json
{
  "schema_version": 1,
  "plugin_version": "1.0.0",
  "created_wall": 1700000000.0,
  "last_flush_wall": 1700005000.0,
  "config": {
    "percentile": 65,
    "twa_bin_size": 1,
    "tws_bin_size": 1,
    "max_tws": 60
  },
```

The `config` block in the persistence JSON is **metadata only** — it records what settings were active when the data was last saved. It is NOT loaded as the active configuration on startup. The active runtime config always comes from AvNav's editable parameter storage (`avnav_server.xml`). The persisted config is used for: (a) debugging ("what settings produced this data?"), (b) future import/restore (post-MVP: warn if imported data was collected under different settings), (c) potential future migration (if `twa_bin_size` or `tws_bin_size` change in a future version). Of the block's four keys, `percentile` and `max_tws` come from the live `Config`; `twa_bin_size` and `tws_bin_size` are **not** editable parameters (the bin grid is fixed in MVP) and are sourced from the named constants `TWA_BIN_SIZE = 1` and `TWS_BIN_SIZE = 1` defined in `bins.py` (alongside `TWS_BIN_MAX = 60`). `plugin.py` reads these constants and includes them in the `metadata` `config` block it passes to `serialize_to_dict(...)`; recording the literal grid resolution is exactly what the future-migration check in (c) compares against. Do not inline a bare `1` — use the constants (avoids the magic-number smell, §8).

**Timestamp metadata lifecycle:** `created_wall` is stamped **once**, with the wall clock, the first time the dataset is written — i.e. when `save()` runs and `plugin.py` has no `created_wall` in hand (fresh install where no `polar.json` was loaded). On every subsequent `save()` it is **carried over unchanged**: `plugin.py` keeps the `created_wall` it read at load time (or minted on the first save) and passes that same value back into `serialize_to_dict(...)` each flush, so the dataset's birth time is stable across restarts. `last_flush_wall` is the opposite — set to the current wall clock on **every** `save()`; it is what the Status tab's "last flush, N min ago" reads. `reset` clears the model and counters but leaves `created_wall` as-is (a reset clears data, not the dataset's identity). `serialize_to_dict` receives both timestamps via its `metadata` argument and never reads a clock itself (core principle #9).

```json
  "counters": {
    "total_seen": 100000,
    "total_accepted": 45000,
    "total_rejected": 50000,
    "total_quarantined": 5000,
    "rejection_histogram": {
      "reject_stale_twa": 1200,
      "reject_low_wind": 8500,
      "...": "..."
    }
  },
  "bins": {
    "90_12": {
      "histogram": {"58": 12, "59": 47, "60": 31, "61": 18},
      "total_accepted": 108,
      "total_rejected": 23,
      "total_quarantined": 4,
      "last_update_wall": 1700004500.0,
      "rejection_histogram": {"reject_unstable": 15, "reject_stw_roc": 8}
    }
  }
}
```

Bin keys use the format `"{twa}_{tws}"` (e.g., `"90_12"` for TWA 90°, TWS 12 kt). Only bins with data are stored (sparse).

**JSON key type round-trip (load-side conversion required).** JSON forces every object key to a string, but the in-memory structures use integer keys: the bin `histogram` is `dict[int, int]` (deciknot key → count) and each bin is addressed by an `(int twa, int tws)` coordinate. `json.dumps` stringifies int keys automatically on **save**, but `json.loads` returns **string** keys on **load**, so `persistence.load()`/deserialize MUST convert them back: `int(k)` for each histogram key, and split-on-`"_"`-then-`int` for each `"{twa}_{tws}"` bin key (rebuilding the `(twa, tws)` coordinate). Without this conversion the Phase 6 round-trip equality test (`create model → save → load → assert equality`) fails, because `{58: 12}` would reload as `{"58": 12}`. The conversion is part of the persistence load contract, not the caller's responsibility.

The top-level `counters` block follows §6.C2 Counter Semantics: `total_seen`, `total_accepted`, `total_rejected`, and `total_quarantined` count sailing candidates only (`total_seen == total_accepted + total_rejected + total_quarantined`), while `rejection_histogram` records every reason code emitted (including candidacy-gate, pause, and disabled rejections) and is therefore a superset whose sum exceeds `total_rejected`.

**Write strategy:**

1. The polar model lives entirely in memory.
2. Every 5 minutes (configurable), flush to disk.
3. On clean shutdown, flush once: the loop exits (on `shouldStopMainThread()` / `_stop_requested`) and `run()` performs a final flush before returning. (The restart callback itself never flushes — see Layer 1 in §7.)
4. On an explicit action that must persist promptly (currently only `reset`), the API handler sets a `_flush_requested` flag under the lock; the plugin thread performs the flush on its next loop iteration. The flush is **not** performed on the HTTP thread.
5. CSV export (`GET export`) and JSON backup (`GET export/json`) read the in-memory model and serialize on the fly — they require no disk flush. JSON backup in particular reuses a **pure serialization function** `persistence.serialize_to_dict(model, counters, metadata) -> dict` that performs **no disk I/O**; the atomic-write `save()` path calls the same function and then writes its result. This is the single source of truth for the persistence schema, so the on-disk file and the `export/json` body are guaranteed identical in shape. Because `serialize_to_dict` walks the **live** model (`iter_bins()`, not a detached snapshot — §6.B), it must run **under the lock**, exactly like the `save()` flush: for `export/json`, **`plugin.py` calls `serialize_to_dict` under the lock** (the same single-writer/snapshot discipline as every other read endpoint — snapshot under the lock, format outside), releases the lock, then hands the finished dict to `api_handlers.export_json` (Layer 7), which merely wraps it in `{"status": "OK", "data": ...}`. `api_handlers.export_json` therefore performs no model access and no `serialize_to_dict` call of its own — it never touches the live model outside the lock.
6. Between flushes, zero disk writes from this plugin.

**Single-writer rule:** Every disk write to `polar.json`/`polar.backup.json` is performed by the plugin thread only — periodic, final, and flag-requested. The HTTP thread never writes the polar files; it only sets `_flush_requested`. This upholds "all flushes happen in the plugin thread" (§7 Layer 1) and the single-lock principle (core principle #8), so the fixed `polar.tmp.json` temp name can never be written by two threads at once. (Preset files in `presets.json` are a separate concern, written by HTTP worker threads rather than the plugin thread; they are serialized by the main lock instead — see §7 Thread Safety.)

**Atomic write procedure:**

1. Serialize model to JSON string.
2. Write to `polar.tmp.json` in the data directory.
3. `os.fsync()` the file descriptor.
4. If `polar.json` exists, rename it to `polar.backup.json` (overwriting previous backup).
5. Rename `polar.tmp.json` to `polar.json`.

**Write failure handling:** If the directory-creation step (`os.makedirs(data_dir, exist_ok=True)`) **or** any step (2–5) of the atomic write raises an `OSError` (disk full, permission denied, read-only filesystem), catch the exception, log an error with the specific error message, clean up `polar.tmp.json` if it exists, and skip this flush cycle. The `os.makedirs` call is explicitly inside this protected scope (it is the first thing to fail on a read-only filesystem). The existing `polar.json` and `polar.backup.json` remain untouched. The next flush interval will retry. Do not crash. Do not propagate the exception to the plugin's `run()` loop.

**Persisted-size scalar for the Status tab.** The `file_size_bytes` field of the `GET status` `persistence` block (§6.F) is **not** obtained by stat-ing the file on the HTTP thread — that would be disk I/O on the HTTP thread, which §7 forbids. Instead the **plugin thread** records `last_flush_size_bytes = len(json_str.encode("utf-8"))` (the exact byte length of the serialized JSON it just wrote) immediately after a successful atomic write, storing it as a plain scalar alongside the other `last_*` status scalars (§7 Thread Safety). It is initialized at startup from the size of the loaded `polar.json` (the `load()` path already opened that file; `0` on a fresh install or when no file loaded). The status snapshot reads this scalar under the lock. A failed/skipped flush leaves the previous value unchanged. This keeps every disk access on the single writer thread (§6.E single-writer rule) and matches the `last_flush_wall` "reflects the last successful flush" semantics.

**Corruption recovery on startup:**

1. Try to load `polar.json`. If valid, use it.
2. If `polar.json` is missing or corrupt, try `polar.backup.json`. Log a warning.
3. If both are missing or corrupt, start with empty model. Log an error.
4. Never crash AvNav on corrupt files.

**Schema migration:** On load, check `schema_version`. If it's an older version, run migration functions. Migration functions are registered in a version-ordered list and applied sequentially. If `schema_version` is higher than the current code's maximum known version (e.g., restoring a backup from a newer plugin release), log an error, set plugin status to ERROR with info `"polar.json has schema version N, this plugin supports up to M"`, and start with an empty model. Do not attempt to load data with an unknown schema — field semantics may have changed.

**User export presets** are stored separately in `<plugin_dir>/data/presets.json` (not in `polar.json`). See §6.B "User-saved presets" for schema and persistence behavior. Managed by `polarrecorder/export.py`, not `polarrecorder/persistence.py`.

### 6.F. API

All endpoints are served via the AvNav plugin request handler. The URL pattern is `/plugins/polarrecorder/api/<endpoint>`.

The request handler callback receives `(url, handler, args)` and returns a dict (auto-serialized to JSON by AvNav).

**Endpoints:**

| Method | URL Path | Description | MVP |
|---|---|---|---|
| GET | `status` | Recording state, counters, current input values (with per-value freshness ages), current decision, uptime, persistence status, and data-availability state (`data_status`). | Yes |
| GET | `polar` | Full polar model projected onto a display grid for SVG rendering. Query params: `format` (`windy` built-in default, or any user-saved preset name; unknown format returns error), `percentile` (integer 1–99, optional override). When `format` is absent, defaults to `windy`. TWA grid is always 1° resolution. | Yes |
| GET | `rejections` | Aggregated rejection counters by reason code. Per-bin rejection histograms. | Yes |
| GET | `timeline` | 1-minute decision buckets from the in-memory timeline (accepted/rejected/quarantined counts + per-minute reason-code counts) for the requested window. Query param `minutes` (default 240, integer 1–240). | Yes |
| GET | `export` | CSV export of the polar. Two modes: (1) **preset mode** — `format` param (`windy` built-in or any user-saved preset name; unknown name returns error); (2) **inline mode** — `twa` (comma-separated integers 0–180) and `tws` (comma-separated positive integers within 1–`max_tws`) supplied directly, no `format` param. Passing both `format` and `twa`/`tws` is an error. When neither is supplied, defaults to `windy`. Optional: `percentile` (integer 1–99, defaults to plugin config); `high_confidence` (`yes`/`true`/`1` → only well-sampled cells, floor `min_samples_for_export`; absent/anything else → default, floor `MIN_SAMPLES_DISPLAY=3`, matching the on-screen preview). Both lists auto-sorted ascending; empty lists return error; non-numeric or out-of-range values return error. | Yes |
| GET | `config` | Current configuration values. | Yes |
| GET | `presets` | List all export presets: Windy built-in + user-saved presets from `presets.json`. Returns `{"status": "OK", "data": {"presets": [{"name": "windy", "builtin": true, "twa": [...], "tws": [...]}, {"name": "my-preset", "builtin": false, "twa": [...], "tws": [...]}]}}`. | Yes |
| GET | `presets/save` | Save a user preset. Query params: `name` (1–30 chars, alphanumeric/hyphens/spaces, not "windy"), `twa` (comma-separated integers 0–180), `tws` (comma-separated positive integers within 1–`max_tws`). Overwrites existing preset with same name. Writes `presets.json` atomically. | Yes |
| GET | `presets/delete` | Delete a user preset. Query params: `name`, `confirm=yes`. Returns error if name is "windy" (built-in) or not found. | Yes |
| GET | `reset?confirm=yes` | Reset the learned polar. Clears: polar model (all bins and histograms), global counters (total_seen, total_accepted, total_rejected, total_quarantined, rejection_histogram), and per-bin rejection histograms. Sets the `_flush_requested` flag (under the lock) so the plugin thread persists the cleared state on its next loop iteration — the reset survives a crash after at most one sample interval (≈1 s at the default rate). The flush is performed by the plugin thread, not the HTTP thread (see §6.E single-writer rule). Does NOT clear the timeline buckets (remain useful for diagnostics) or validation state (avoids unnecessary 15-second warm-up). Requires `confirm=yes` query param. Returns error without it. | Yes |
| GET | `pause` | Pause recording. Idempotent: returns success if already paused. | Yes |
| GET | `resume` | Resume recording. Idempotent: returns success if already recording. | Yes |
| GET | `export/json` | Full model export as JSON (for backup/restore). | Yes |
| POST | `import` | Restore from JSON export. | Post-MVP |
| GET | `debug/sample` | Current sample details with all validation rule results. | Post-MVP |

**All endpoints return JSON.** Error responses use `{"status": "ERROR", "error": "message"}`. Success responses use `{"status": "OK", "data": ...}`.

**No non-finite floats in any response (REQUIRED).** Python's `json.dumps` emits the bare tokens `NaN`/`Infinity`/`-Infinity` for non-finite floats, which are invalid JSON that the viewer's `response.json()` (`JSON.parse`) rejects — turning an otherwise-healthy poll into a spurious "Connection lost" (§6.G.8). No response field may therefore carry a non-finite float. This holds by construction: histogram-derived speeds come only from accepted samples (R1-finite, R7-range-checked), so percentiles are finite; timeline and counter values are `int`; and `current_values` is gated on a **built `Sample`** (`build_sample` returns `None` for non-finite reads — §6.B3, §6.G.4, §7 Thread Safety), so it can never hold `NaN`/`Inf`. `api_handlers` does not call `json.dumps` itself (AvNav serializes the returned dict), so it cannot pass `allow_nan=False`; the guarantee is upheld at the data sources above, and a unit test in `test_api_handlers.py` asserts that feeding a deliberately non-finite store read leaves `current_values` frozen on the last finite values (never `NaN`).

**Query parameter shape — list normalization (REQUIRED):** AvNav builds the `args` dict via `urllib.parse.parse_qs(query, True)` (`httpserver.py:277`/`301`, forwarded to the plugin via `pluginhandler.py:1084`), so **every value is a list of strings** (e.g. `{"percentile": ["65"], "twa": ["0,30,60"]}`). The second positional argument is `keep_blank_values=True`, so a blank value like `?confirm=` is **kept** as `{"confirm": [""]}` (not dropped); after normalization it becomes the empty string `""`, which correctly fails the `confirm == "yes"` check. AvNav's own unwrap helper (`AVNUtil.getHttpRequestParam`) lives in `avnav_util`, which `polarrecorder/` may not import (core principle #2). Therefore `plugin.py`'s request dispatcher (`_handle_request`) **normalizes `args` to a flat `dict[str, str]` before passing it to `api_handlers`**: for each key, take the first list element (`v[0]` if `v` is a non-empty list, else the value as-is). After normalization, `api_handlers` sees plain scalar strings and the examples below (`int("abc")`, `args.get("percentile")`) behave as written. The comma-separated `twa`/`tws` params remain single strings (e.g. `"0,30,60"`) and are split inside the handler. Tests must construct `args` in the post-normalization scalar form (or exercise the normalizer); the `FakeAvNavAPI`/integration tests pass scalar-string dicts.

**Query parameter validation:** All endpoint handlers must validate and parse query parameters defensively. Invalid or unparseable parameters return a JSON error response (`{"status": "ERROR", "error": "Invalid parameter 'percentile': expected integer 1-99, got 'abc'"}`). Handlers must never raise unhandled exceptions — `api_handlers.py` wraps each handler in a try/except that catches `Exception`, logs the error, and returns `{"status": "ERROR", "error": "Internal error"}`. This prevents crashing AvNav's HTTP thread. `plugin.py`'s request dispatcher adds an outer try/except as a final safety net.

**GET-only for state mutations** (reset, pause, resume) is a pragmatic choice: AvNav's request handler receives the same `args` dict for GET and POST, and the viewer's fetch calls are simpler with GET. The `confirm=yes` parameter on reset prevents accidental invocation.

**Response schemas:**

**`GET status`:**
```json
{
  "status": "OK",
  "data": {
    "record_enabled": true,
    "recording": true,
    "data_status": "receiving",
    "warming_up": false,
    "uptime_seconds": 3600,
    "current_values": {
      "twa_deg": 127.3,
      "tws_kt": 14.2,
      "stw_kt": 6.1,
      "twa_age_s": 0.3,
      "tws_age_s": 0.5,
      "stw_age_s": 0.4,
      "twa_stale": false,
      "tws_stale": false,
      "stw_stale": false
    },
    "current_decision": {
      "state": "accepted",
      "reason_codes": []
    },
    "counters": {
      "total_seen": 100000,
      "total_accepted": 45000,
      "total_rejected": 50000,
      "total_quarantined": 5000,
      "acceptance_rate": 0.45
    },
    "top_rejections": [
      {"reason": "reject_low_wind", "count": 8500},
      {"reason": "reject_unstable", "count": 7200}
    ],
    "persistence": {
      "last_flush_wall": 1700004800.0,
      "file_size_bytes": 24576,
      "bins_with_data": 342,
      "bins_total": 21960
    },
    "generation": 4527
  }
}
```

`uptime_seconds` is `now_monotonic - run_start_monotonic`, where `run_start_monotonic` is captured at the very beginning of `run()` using the injected clock (and is also initialized in `__init__` to the same injected clock, so a `GET status` arriving in the window between `__init__` and `run()` entry computes a valid near-zero uptime rather than referencing an undefined attribute — see §7 Thread Safety). It resets to zero on each `run()` call — it reflects how long the current plugin instance has been running, not cumulative lifetime. The `generation` counter increments on every model update (accepted sample committed to a bin) and on model reset (cleared model is a new state). The UI uses it to avoid redundant SVG re-renders. `generation` starts at 0 on plugin start, is NOT persisted (not in the JSON schema), and resets to 0 on restart — this correctly forces a UI re-render on first poll after restart. `generation` is an integer field on the `PolarModel` class (in `polarrecorder/polar_model.py`), incremented by `PolarModel.update_accepted()` and `PolarModel.reset()` (matching the §6.B update contract — `record_rejection`/`record_quarantine` do NOT bump it). `acceptance_rate` is `total_accepted / total_seen`; returns `0.0` when `total_seen == 0` (no division by zero). Per §6.C2, `total_seen` counts only sailing candidates (samples that passed the candidacy gate R1–R10, were not paused/disabled, and were not warm-up rejections), so `acceptance_rate` measures data quality while sailing rather than wall-clock utilization — long periods paused, disabled, in harbor, anchored, becalmed, or warming up after a restart do not drag it down. `top_rejections` returns the top 5 rejection reasons sorted by count descending (drawn from the global `rejection_histogram`, which counts every reason code including candidacy-gate and pause/disabled rejections); empty array when no rejections exist. `current_values` is `null` if no values have been read yet. **`current_decision` is likewise `null` until the first pipeline iteration has produced a decision** (`last_decision` initializes to `None` in `__init__`, §7 Thread Safety); `format_status` emits `null` in that case rather than a half-populated object, and `test_api_handlers.py` asserts this. This is safe for every consumer: the recent-decisions strip only reads `current_decision.state` on the `recording=true` **and** `data_status="receiving"` path (§6.G.4), and the decision badge is shown only when `recording=true` — both unreachable while `last_decision` is `None`, because the same locked write that first sets `data_status="receiving"` on a recording iteration also runs the pipeline and sets `last_decision` (§7 Thread Safety). When present, `twa_deg` is raw 0–360° (matching the AvNav store convention — preserves port/starboard information), `tws_kt` and `stw_kt` are in knots. Each value also carries a server-computed `<key>_stale` boolean (`twa_stale`/`tws_stale`/`stw_stale`), set to `true` when that value's age exceeds the active `stale_threshold` config (R3, default 3.0 s) — `plugin.py` holds the live config, so the flag always agrees with R3's accept/reject boundary. The UI colors each value's freshness dot directly from its flag (§6.G.4) and never compares ages against a hardcoded threshold of its own. `data_status` reflects the most recent store read: `"receiving"` (all three core values non-None), `"partial"` (some values present, some missing), or `"no_data"` (all values None / instruments offline). The UI uses this to derive the four-state indicator: Disabled (`record_enabled=false`), Paused (`recording=false` and `record_enabled=true`), No Data (`data_status="no_data"` **or** `data_status="partial"`), Recording (all other cases — i.e. `record_enabled=true`, not paused, and `data_status="receiving"` — with `warming_up` as a sub-state). `"partial"` maps to "No Data" because a polar sample requires all three values; partial instrument coverage is functionally the same as no data from the user's perspective, and the rejection stream (`reject_missing_*`) makes the specific gap visible in the Status tab.

**`GET polar`** (query params: `format` — `windy` default, or any user-saved preset name; `percentile` integer 1–99 optional override):
```json
{
  "status": "OK",
  "data": {
    "format": "windy",
    "percentile": 65,
    "generation": 4527,
    "tws_bands": [6, 8, 10, 12, 14, 16, 20],
    "curves": {
      "12": [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        {"stw": 3.2, "samples": 45},
        {"stw": 3.3, "samples": 52},
        null,
        {"stw": 3.5, "samples": 38}
      ]
    }
  }
}
```

When the model is empty (no bins with data), `tws_bands` is `[]` and `curves` is `{}`. The UI handles this by showing the polar grid (concentric circles, radial lines) with a centered message: "No data yet — start sailing!"

(The `curves["12"]` array in the example above is **truncated for brevity** — it stops at index 33. Every real curve array is **exactly 181 entries** (index = TWA 0–180, see below), padded with `null` for absent cells. Mock fixtures in `tests/mock-data/polar.json` must use full 181-entry arrays.)

**Polar API projection — preset-only, midpoint-boundary merging:** `GET /api/polar` accepts only named presets via `format` (`windy` default, or any user preset name) — no inline `twa`/`tws` params. This keeps the diagram endpoint simple and always tied to a named context (so the dropdown label stays meaningful). For ad-hoc grids, use `GET /api/export` with inline `twa`/`tws` params instead. Resolution: (1) `windy` → Windy built-in TWS grid `[4, 6, 8, 10, 12, 14, 16, 20, 25]`; (2) user preset name → load TWS grid from `presets.json`; (3) no match → error. When `format` is absent, defaults to `windy`.

The TWA display grid is always every integer degree 0–180 (181 entries per curve) — the diagram always renders at full 1° resolution for smooth curves. The preset's `twa` field is used only by `GET /api/export` (coarse TWA rows make sense in a CSV table but not in a smooth curve diagram); it is ignored by this endpoint.

For each display TWS band, the projection:
1. Folds all raw bins to 0–180° (port+starboard histogram merge — TWA=0 and TWA=180 are self-paired).
2. Applies midpoint-boundary merging along the TWS axis using the resolved display TWS grid (same algorithm as §6.B "Boundary computation").
3. Extracts the configured percentile from the merged histogram for each TWA degree.
4. Returns `null` for any cell whose merged histogram has fewer than `MIN_SAMPLES_DISPLAY` (3) total samples (passed as the `min_samples` argument to the shared projection function — see §6.B step 5). This is deliberately lower than the high-confidence export threshold `min_samples_for_export` (default 10): the diagram surfaces nascent bins as low-confidence segments rather than hiding them. `MIN_SAMPLES_DISPLAY` is a hardcoded display constant in `polarrecorder/export.py` (a rendering concern, matching the confidence thresholds in §6.G.3), not an editable parameter; the **default** CSV export uses this same constant and the same projection function, so the floor and percentile that govern the diagram also govern the default export (the default vs. `high_confidence` export differ only by floor). The two are not cell-for-cell identical, though: the diagram projects onto a 1° TWA grid while the CSV export uses the preset's coarser TWA rows (§6.B step 5).

`tws_bands` lists the display TWS grid values that have at least one non-null cell. `curves` is keyed by TWS display value (string). Each curve is a **positional array of exactly 181 entries** (index = TWA degrees 0–180). Non-null entries are `{"stw": <float>, "samples": <int>}` where `samples` is the merged histogram total for that cell. The array index is the TWA — no redundant `"twa"` field. UI iterates with `curve.forEach((entry, twa) => ...)`. The response also echoes `"format": "<resolved format name>"` so the UI knows which preset is active.

The `polarrecorder/export.py` projection function is reused by `api_handlers.py` — no duplication of the merging algorithm. The UI's preset selector (on the Polar tab) calls `GET /api/polar?format=<name>` to redraw the diagram with a different TWS grid, giving the user a visual preview of any preset before exporting it.

**`GET rejections`:**
```json
{
  "status": "OK",
  "data": {
    "global": {
      "reject_low_wind": 8500,
      "reject_unstable": 7200,
      "reject_stale_twa": 1200
    },
    "per_bin": {
      "90_12": {"reject_unstable": 15, "reject_stw_roc": 8},
      "120_14": {"quarantine_engine_suspected": 3}
    }
  }
}
```

`global` is the full global `rejection_histogram` (every reason code ever emitted, including candidacy-gate, `reject_warming_up`, pause, and disabled). `per_bin` is keyed by `"{twa}_{tws}"` and contains only the quality-gate reason codes (R11–R14, R15 `reject_unstable`, R16) recorded against each bin (§6.B); `reject_warming_up` is excluded (non-candidate, never reaches the model), and bins with no quality-gate rejections are omitted. The two are intentionally different scopes and must not be reconciled (§6.C2).

**`GET timeline`** (query param `?minutes=240`; `minutes` default: 240, integer 1–240). Returns the 1-minute decision buckets whose start falls within the last `minutes` minutes, oldest-first. Minutes with no samples are absent (rendered as gaps by the UI):
```json
{
  "status": "OK",
  "data": {
    "buckets": [
      {
        "t": 1700004480.0,
        "accepted": 47,
        "rejected": 11,
        "quarantined": 2,
        "reasons": {"reject_anchored": 9, "reject_low_wind": 2, "quarantine_engine_suspected": 2}
      },
      {
        "t": 1700004540.0,
        "accepted": 0,
        "rejected": 60,
        "quarantined": 0,
        "reasons": {"reject_anchored": 60}
      }
    ]
  }
}
```

Each bucket's `t` is its minute-start wall time. `accepted`/`rejected`/`quarantined` are the decision counts for that minute; `reasons` is the per-minute reason-code histogram (every `reject_*`/`quarantine_*` code that fired, including candidacy-gate, `reject_warming_up`, pause, and disabled codes — so the UI can show *which* rule dominated a stretch). No per-sample TWA/TWS/STW values are returned (live values are on the Status tab). The response is constant-size and small (≤ 240 small dicts), so there is no `limit` param and no large-transfer concern.

**`GET export`** (preset mode: `?format=windy&percentile=65` or `?format=my-preset`; inline mode: `?twa=0,30,60,90,120,150,180&tws=4,6,8,12,16,20&percentile=65`):

Returns `{"status": "OK", "data": {"csv": "TWA\\TWS;6;8;10;12\r\n52;3.2;4.1;5.0;5.8\r\n..."}}`. The viewer extracts the `csv` string and triggers a download via `Blob` + `URL.createObjectURL`. Download filename: `polarrecorder-<preset>.csv` for preset mode (e.g., `polarrecorder-windy.csv`, `polarrecorder-my-planner.csv`); `polarrecorder-custom.csv` for inline mode.

**`GET export/json`:**

Returns the full persistence JSON (same schema as `polar.json` on disk) wrapped in `{"status": "OK", "data": {...}}`. To stay on the single-writer/snapshot discipline, **`plugin.py` calls `persistence.serialize_to_dict(model, counters, metadata)` while holding the lock** (the same pure function `save()` uses, so the backup body and the on-disk file share one serializer and one shape), releases the lock, then passes the finished dict to `api_handlers.export_json(serialized)`, which simply returns `{"status": "OK", "data": serialized}`. `plugin.py` supplies the live `model`, `counters`, and `metadata` (`schema_version`, `plugin_version`, `created_wall`, `last_flush_wall`, and the persisted `config` block) to `serialize_to_dict` under the lock; `api_handlers` never touches the model and never calls `serialize_to_dict` itself. Download filename: `polarrecorder-backup.json`.

**`GET config`:**
```json
{
  "status": "OK",
  "data": {
    "record_enabled": true,
    "sample_interval": 1.0,
    "percentile": 65,
    "flush_interval": 300,
    "...": "all editable parameters with current values"
  }
}
```

Values are returned in their parsed native types (`bool`, `int`, `float`), not as the raw strings stored by AvNav. The full parameter list is in Section 7 (Complete editable parameters list).

### 6.G. UI

**MVP UI:** A standalone HTML page (`viewer.html`) served from the plugin directory, registered as an AvNav user app.

**Registration:** Use `plugin.json` for user app registration (declarative, automatic):

```json
{
  "version": "1.0.0",
  "userApps": [
    {"url": "viewer.html", "iconFile": "icon.svg", "title": "Polar Recorder"}
  ]
}
```

Do NOT also call `api.registerUserApp()` in `plugin.py` — this would cause double-registration. `plugin.py` handles only runtime registration: editable parameters, request handler. `plugin.json` handles static metadata: version, user app.

**Technology:** Plain HTML + CSS + JavaScript. No build step. No framework. No ES module imports in the served file (AvNav serves it as a static file, not through the module loader). SVG for the polar diagram (scalable, HiDPI-friendly, no Canvas complexity). Fetch API for HTTP requests to the plugin API.

#### 6.G.1. Responsive Layout

**Target devices:** Smartphones, tablets, Kindle e-readers, low-resolution Raspberry Pi screens (800×480), desktop browsers, chart plotter touchscreens. The layout must be fully responsive.

**Layout structure:** Tab-based navigation with a fixed tab bar. Each tab is a vertically scrollable pane. The tab bar is always visible (fixed to top or bottom depending on viewport height — bottom on short/mobile viewports for thumb reach, top on tall/desktop viewports).

**Tabs (4):**

| Tab | Label | Icon | Content |
|---|---|---|---|
| 1 | Polar | radar/chart icon | Polar diagram (dominates the tab), preset selector, TWS band selector |
| 2 | Status | info/pulse icon | Live values, recording state, counters, current decision |
| 3 | Timeline | clock/history icon | 1-minute decision-bucket chart (4 h), time-range buttons |
| 4 | Export | download icon | Export configurator, presets with editable grids, download buttons, reset control |

**Tab bar:** Minimum tap target 44×44px (Apple HIG). Icons with short labels below. Active tab highlighted with `--avnav-active-color`.

**Breakpoints:**
- **Narrow** (< 600px width): Single-column layout. Polar diagram uses full viewport width. Tab bar at bottom.
- **Medium** (600–1024px): Single-column, slightly more padding. Tab bar at top.
- **Wide** (> 1024px): Optional two-column layout on Status tab (values left, counters right). Tab bar at top.

**Font sizing:** Use `rem` units with a base size that respects the device default. Minimum body text 14px equivalent. Values/numbers displayed at 1.2–1.5rem for readability on small screens.

#### 6.G.2. Color Scheme and Day/Night Mode

**Approach:** `viewer.html` is a standalone page outside the AvNav React SPA, so it does not inherit AvNav's CSS variables. The viewer defines its own CSS custom properties that mirror the AvNav palette, and implements a day/night toggle. All CSS below lives in `viewer.css` (not `plugin.css` — see §6.G.9).

**CSS custom properties (day mode — default):**

```css
:root {
  --polarrecorder-fore-color: black;
  --polarrecorder-back-color: white;
  --polarrecorder-main-color: #546E7A;       /* matches --avnav-main-color */
  --polarrecorder-second-color: #E6E6E6;     /* matches --avnav-second-color */
  --polarrecorder-attention-color: #C62828;   /* matches --avnav-attention-color */
  --polarrecorder-active-color: #1DE9B6;     /* matches --avnav-active-color */
  --polarrecorder-border-color: #acacac;     /* matches --avnav-border-color */
  --polarrecorder-widget-head-color: #E2DFDF;
  --polarrecorder-accepted-color: #1DE9B6;   /* green, for accepted samples */
  --polarrecorder-rejected-color: #FF8A80;   /* red, for rejected samples */
  --polarrecorder-quarantined-color: #FFD54F; /* amber, for quarantined samples */
  --polarrecorder-polar-curve-colors: dynamic;
  /* Polar curve colors are generated dynamically in JS, not defined as a fixed CSS list.
     Each TWS band owns one color, and that color is a STABLE property of the band: a band's
     curve, its per-TWA-sector dots, and its selector chip all use the band's color, whether or
     not the band is currently toggled visible. polar-chart.js generates colors using HSL: hue
     evenly spaced across 0–330° (avoiding full wrap to prevent first/last looking identical),
     saturation 70%, lightness 50%. Colors are indexed over the FULL set of bands with data —
     the `tws_bands` list from the `GET /api/polar` response (N = its length), NOT the count of
     currently-visible bands: for the band at index i in `tws_bands`, hue_i = (i / N) * 330.
     Indexing over the stable `tws_bands` set (rather than the visible subset) is deliberate:
     toggling a band's visibility must NOT recolor the other bands, and a hidden band's chip
     must still match the color its curve will use when re-shown. This scales to any number of
     bands (9 for Windy, 15+, or the full 0–60 range) without running out of colors.
     In night mode, all curve strokes get opacity: 0.5 applied uniformly.
     The TWS chip color matches its band's curve color using this same per-band assignment. */
}
```

**Night mode override:**

```css
.nightMode {
  --polarrecorder-fore-color: rgba(252, 11, 11, 0.6);  /* matches AvNav night red */
  --polarrecorder-back-color: black;
  --polarrecorder-main-color: rgba(84, 110, 122, 0.6);
  --polarrecorder-second-color: #5a5a5a;
  --polarrecorder-attention-color: rgba(198, 40, 40, 0.6);
  --polarrecorder-active-color: rgba(252, 11, 11, 0.6);
  --polarrecorder-border-color: rgba(252, 11, 11, 0.36);
  --polarrecorder-widget-head-color: rgba(50, 47, 47, 0.6);
  --polarrecorder-accepted-color: rgba(252, 11, 11, 0.5);
  --polarrecorder-rejected-color: rgba(252, 11, 11, 0.3);
  --polarrecorder-quarantined-color: rgba(252, 11, 11, 0.4);
  /* polar curves: apply opacity: 0.5 to all SVG curve stroke elements in night mode
     rather than defining separate color variables (SVG strokes use per-element colors
     from the day palette; the nightMode class reduces their visibility uniformly) */
}
```

**Toggle mechanism:** A day/night toggle button in the tab bar (sun/moon icon). State persisted in `localStorage`. No auto-detection (the viewer cannot read AvNav's night mode state from a standalone page).

#### 6.G.3. Polar Diagram (Tab 1)

**Diagram type:** Traditional sailing polar plot. Angle axis = TWA (0° at top, 180° at bottom). Radius axis = STW (0 at center, max at edge). Half-polar (0–180°) by default; optional toggle for full 360° (port/starboard overlay, post-MVP).

**Layout on tab:** The polar diagram is the dominant element, filling as much viewport as possible. Below it: a preset selector (dropdown, same list as the Export tab — Windy default, then user-saved presets alphabetically) and a TWS band selector (horizontal scrollable row of tappable chips/buttons, one per display TWS band with data).

**SVG structure:**
- Concentric dashed circles for STW reference values with labels. **Radius auto-scaling:** compute the maximum STW across all visible (selected) TWS curves, round up to the next even integer (e.g., max 7.3 → 8 kt). Place reference circles at 2-knot intervals (e.g., 2, 4, 6, 8 kt). If max STW < 4 kt, use 1-knot intervals. The outermost circle is the radius scale maximum.
- Radial dashed lines at key TWA angles (30°, 60°, 90°, 120°, 150°, 180°) with labels.
- **Coordinate mapping:** SVG center of the plot area at `(200, 200)`, with `plot_radius = 175` (px) — chosen so the outer circle sits 25 px inside the 400-wide viewBox on the left/right/top and leaves ~45 px below center for the 180° label (hence the 420 viewBox height). For a given TWA `a` (degrees) and STW `s` (knots): `x = center_x + r * sin(a * π/180)`, `y = center_y - r * cos(a * π/180)`, where `r = (s / radius_max) * plot_radius`. This places 0° at top, 90° at right, 180° at bottom (standard sailing polar orientation).
- One colored curve per selected TWS band, drawn by connecting the percentile-extracted STW at each TWA where data exists. Gaps (empty bins) are gaps in the curve — no interpolation.
- Legend showing TWS value → color mapping.
- Confidence indicator: curve segments rendered based on sample count per bin — `< 3 samples`: not drawn (too noisy); `3–9 samples`: dashed stroke + 50% opacity (low confidence); `≥ 10 samples`: solid stroke (confident). These thresholds are hardcoded display constants in `polar-chart.js` (not editable parameters — they are a rendering concern, not a data quality decision). These align with the `GET /api/polar` display floor of 3 (§6.F): the endpoint already returns `null` for any cell below 3 samples, so the `< 3` tier corresponds exactly to the null cells the diagram skips, and cells in the 3–9 range are delivered (not nulled) precisely so this dashed low-confidence tier is reachable. The `samples` integer in each non-null entry is what `polar-chart.js` tests against the 3/10 boundaries. The solid (`≥ 10`) tier corresponds to what a **high-confidence export** returns: a default export includes every cell at or above the `MIN_SAMPLES_DISPLAY` floor (the dashed + solid tiers, at the same floor the diagram uses), while `high_confidence=yes` keeps only cells at or above `min_samples_for_export` (default 10) — see the Export tab toggle in §6.G and §6.B step 5. (The diagram's drawn segments and the CSV cells are governed by the same floor but live on different TWA grids — 1° vs. the preset's rows — so this is a floor correspondence, not a one-to-one cell correspondence.)

**Viewbox:** `0 0 400 420` (square plot area + space for labels). Scales to fit container via CSS `width: 100%; height: auto;`.

**Interaction:**
- Tap a TWS chip to toggle that band's curve on/off.
- Tap/hover a point on a curve to show tooltip: TWA, TWS, STW (percentile), sample count.
- Pinch-to-zoom on touch devices (CSS `touch-action: manipulation` on the SVG container, with a transform-based zoom).

**TWS band selector:** One chip per display TWS band value that has at least one non-null cell (i.e., populated from the Windy display grid `[4, 6, 8, 10, 12, 14, 16, 20, 25]` after midpoint-boundary merging — same values as `tws_bands` in the `GET /api/polar` response). Chips show the TWS value in knots. Tapping toggles visibility. Long-press or double-tap selects only that band (solo mode). Each chip uses its band's stable color — the per-band HSL color indexed over the full `tws_bands` list (§6.G.2) — so the chip matches that band's curve and per-TWA-sector dots whether the band is currently shown or hidden, and toggling one band never recolors the others. By default, all bands with data are pre-selected. If no bands have data, the chip bar is empty and the diagram shows "No data yet."

**Data fetch:** `GET /api/polar` on tab activation and every 30 seconds while the tab is visible. Response includes per-bin percentile speeds and sample counts.

**API base URL:** `viewer.js` reads the base URL from a `data-api-base` attribute on `<body>`, defaulting to `'api/'` if absent. All fetch calls use this base: `fetch(API_BASE + 'status')`, `fetch(API_BASE + 'polar')`, etc. In production, `API_BASE` is `'api/'` (relative), which resolves correctly because `viewer.html` is served at `/plugins/polarrecorder/viewer.html` and API endpoints are at `/plugins/polarrecorder/api/<endpoint>`. For testing with the mock server, set `data-api-base="http://localhost:8080/api/"` on `<body>`. The `API_BASE` value is computed once on page load and stored on the `window.Polarrecorder` namespace.

#### 6.G.4. Status Panel (Tab 2)

**Layout:** Vertical stack of cards/sections.

**Section 1 — Recording State:**
- Large status indicator showing one of four states:
  - **"Recording"** (green dot) — `record_enabled=true`, not paused, instruments providing data, samples being accepted or rejected normally.
  - **"Paused"** (amber dot) — `record_enabled=true`, paused via API. Resume button available.
  - **"No Data"** (grey dot) — `record_enabled=true`, not paused, but no instrument data flowing (status demoted to STARTED). Shows "Waiting for instrument data..."
  - **"Disabled"** (grey dot, different icon or label) — `record_enabled=false`. Shows "Recording disabled — enable in AvNav settings." No resume button (pause/resume is independent of `record_enabled`).
- Pause/Resume toggle button (large, touch-friendly, minimum 44px height). Visible in Recording and Paused states. Hidden (or disabled with explanation) in Disabled state.
- Uptime: time since current plugin run started (resets to zero on plugin restart).

**Section 2 — Current Values:**
- Three value displays in a row (or stacked on narrow screens): TWA (°), TWS (kt), STW (kt).
- Each shows the current live value from the most recent loop iteration that produced a **built `Sample`** — all three store values present *and finite* (i.e. `build_sample` returned non-`None`, which subsumes R1 finite + R2 present). A present-but-non-finite read does **not** update these (the display freezes on the last good values; the fault still surfaces as `reject_non_finite_*` in the rejection stream and the recent-decisions strip). Values are converted to display units (TWA in degrees using raw 0–360 convention, speeds in knots). Ages are recomputed on each status request (`now_monotonic - store_timestamp`). If no finite read has occurred yet, `current_values` is `null` in the API response and the UI shows "No Data".
- Below each: age indicator ("0.3s ago") and freshness status (green = fresh, red = stale). The green/red state is driven by the server-computed `<key>_stale` boolean in the status response (§6.F), **not** by a JS-side threshold — so the dot always matches R3's active `stale_threshold` even after the user changes it.
- Current decision badge: "Accepted" / "Rejected: reason_code" / "Quarantined: reason_code", color-coded. **Shown only when `recording=true`.** While `recording=false` (paused or disabled) the badge is hidden — the recording-state indicator in Section 1 already communicates the paused/disabled state, and `last_decision` is not updated during pause/disabled (§6.B3), so its value is never displayed.
- **Recent-decisions strip (live trend — client-side only, no API change).** Directly below the decision badge, a horizontal row of up to **60 small color cells** showing the immediate trend at status-poll resolution (~2 min at the 2 s poll, newest on the right). This absorbs the live "what's happening right now" role: an anchoring stretch reads as a run of red cells (tap → `reject_anchored`), a tack shows the brief rejection plus the trailing maneuver-cooldown run, etc. — without storing or transferring any per-sample data (the historical 4-hour view is the Timeline tab, §6.G.5).
  - **Data source is the status poll already being made — there is no new endpoint, no server change, and no new server-side storage.** On each successful `GET /api/status`, `viewer.js` appends one item to a bounded in-memory array `window.Polarrecorder.recentDecisions` (`maxlen = 60`, oldest dropped). Each item is derived entirely from that one status response: if `recording === false` → state `"paused"`/`"disabled"` (grey cell); else if `data_status !== "receiving"` → `"no_data"` (grey); else the `current_decision.state` (green/red/amber) with its `reason_codes`. A failed poll appends nothing (the strip simply does not grow).
  - **Colors** reuse `--polarrecorder-accepted-color` / `--polarrecorder-rejected-color` / `--polarrecorder-quarantined-color`; grey uses `--polarrecorder-second-color`.
  - **Interaction:** tap/hover a cell → tooltip with that poll's state and reason code(s). Cells are ≥ 44 px tall in their hit area (small visual width, ~5 px, is fine; the row is a single tap target band with per-cell tooltips), and the row never wraps (it stays one line on a 360 px viewport).
  - **Lifecycle:** in-memory only, cleared on page reload; it grows only while the Status tab is visible (polling is gated to the active tab, §6.G.8). It is explicitly a *live* view, not history.

**Section 3 — Counters:**
- Total samples seen, accepted, rejected, quarantined — displayed as a simple four-column stat row.
- Acceptance rate percentage.
- Below: top 5 rejection reasons with counts, sorted by frequency.

**Section 4 — Persistence:**
- Last flush time (relative: "2 min ago") — computed in JS as `Date.now()/1000 - last_flush_wall` from the `persistence.last_flush_wall` field in the status response. `api_handlers.py` does not compute this; it returns `last_flush_wall` only.
- File size of polar.json (from status API).
- Total bins with data / total possible bins.

**Data fetch:** `GET /api/status` every 2 seconds while tab is visible.

#### 6.G.5. Rejection Timeline (Tab 3)

**Visualization:** Horizontal time-series chart. X-axis = time (last 4 hours). Y-axis = not used for magnitude — this is a categorical band chart, one cell per 1-minute bucket.

**Rendering approach:** The server already returns ≤ 240 pre-aggregated 1-minute buckets (§6.F `GET timeline`), so the chart draws **one rect per bucket** directly — no client-side bucketing, no zoom-re-fetch, no element-count concern (240 rects render instantly even on a Kindle or 800×480 Pi). Each bucket rect is positioned by its `t` along the time axis. Its fill encodes that minute's decisions: when one decision dominates, use that color (green = accepted, red = rejected, amber = quarantined); when mixed, split the rect vertically into up to three stacked sub-rects sized in proportion to `accepted`/`rejected`/`quarantined`. An anchored or motoring stretch therefore reads as a solid red/amber band, which is the whole point — confirming at a glance that the detection fired. Minutes absent from the response render as gaps (no rect). Most recent minute on the right.

**Time range controls:** Buttons for "Last 30 min", "Last 1 hour", "Last 4 hours" (full range) re-request `GET /api/timeline?minutes=<30|60|240>` and redraw the returned buckets across the chart width. (Narrower windows simply spread the same minute cells wider.)

**Interaction:**
- Tap a bucket to show a tooltip: the minute's time range, the accepted/rejected/quarantined counts, and the top reason codes from that bucket's `reasons` (e.g. "14:32 — 0 accepted, 60 rejected · reject_anchored ×60").
- No per-sample drill-down: individual-sample TWA/TWS/STW are not stored in the timeline. Live per-value detail and the current decision are on the **Status tab** (§6.G.4, polled every 2 s).

**Data fetch:** `GET /api/timeline?minutes=240` on tab activation and every 10 seconds while visible.

#### 6.G.6. Export and Controls (Tab 4)

**Layout:** Vertical stack of sections.

**Section 1 — Export Configurator:**
- Preset selector: dropdown listing "Windy Passage Planner" (default, always first), then all user-saved presets (alphabetical). No "Custom" option — all grids are named presets. Populated from the shared presets cache (`window.Polarrecorder.presetsCache`) on tab activation.
- When any preset is selected (Windy or user-saved), the TWA and TWS grid editors are populated with that preset's values and are immediately editable. Editing the grid does not change the selected preset name — it just marks the grid as "modified" (tracked in component state).
- **Grid editors — individual number inputs:** Both the TWA editor and the TWS editor are rendered as a horizontally scrollable row of individual `<input type="number">` fields, one per value, plus an "＋" add button at the end and a "✕" remove button on each existing chip. Each input: minimum width 48px, height 44px, font-size 16px (prevents iOS auto-zoom), `inputmode="numeric"`, integer-only. Validation fires on blur: out-of-range or non-integer values are highlighted in `--polarrecorder-attention-color`; the Download and Save buttons are disabled while any field is invalid. Values are kept sorted ascending automatically after each blur (re-sort and re-render the row). The "＋" button appends a new field pre-filled with a sensible next value (last value + typical step: 10° for TWA, 2 kt for TWS). The "✕" button removes that value (disabled if only one value remains). The row scrolls horizontally on narrow viewports — no wrapping, so the layout stays predictable on 360px screens.
- "Save as Preset" button: always visible. On tap: shows a name input pre-filled with the current preset name. User can keep the name (overwrite) or change it (save as new). If the name already exists as a user preset, shows an inline confirmation: "A preset named 'X' already exists. Overwrite it?" with Confirm/Cancel — the save call is only made on explicit confirmation. Calls `GET /api/presets/save?name=...&twa=...&tws=...`. On success, refreshes the shared presets cache and selects the saved preset. Shows error if name is reserved ("windy").
- "Delete Preset" button: visible only when a user-saved preset is selected (not Windy). On tap: confirmation dialog ("Delete preset 'name'?"). Calls `GET /api/presets/delete?name=...&confirm=yes`. On success, refreshes cache and selects Windy.
- Percentile override: single `<input type="number">` (default: use plugin setting, typically 65). Range 1–99. Height 44px, font-size 16px.
- **"High-confidence cells only" checkbox:** unchecked by default. Label: "High-confidence cells only (≥ N samples)", where N is the live `min_samples_for_export` config value (read from the cached `GET /api/config`, fetched once on Export-tab activation per §6.G.8; fall back to "10" if unavailable). A short helper line reads: "Off (default): export everything shown in the preview, including dashed low-confidence cells. On: keep only the solid, well-sampled cells." When unchecked, the download/preview calls omit `high_confidence` (server defaults to the `MIN_SAMPLES_DISPLAY` floor, so the export matches the preview exactly). When checked, the calls append `&high_confidence=yes` (server uses the `min_samples_for_export` floor). The checkbox affects only cell population — not the grid, format, or filename.
- "Preview" button: shows a text preview of the CSV output (first 10 rows) in a scrollable monospace block, using the current (possibly modified) grid values **and the current high-confidence checkbox state** (so the preview matches the download). Disabled while any grid field is invalid.
- "Download CSV" button: triggers download using the **current editor values** as inline params: `GET /api/export?twa=<current-twa>&tws=<current-tws>&percentile=...` plus `&high_confidence=yes` when the checkbox is checked. Always reflects what the user sees in the editors, whether or not it has been saved as a preset. No save step required for download. Disabled while any grid field is invalid.

**Section 2 — JSON Backup:**
- "Download Full Model (JSON)" button: triggers download via `GET /api/export/json`.

**Section 3 — Reset:**
- Visually separated from export (different background, warning color border).
- "Reset Learned Polar" button styled as a destructive action (red/attention color, outlined, not filled — to prevent casual taps).
- On tap: shows a confirmation dialog: "This will permanently delete all learned polar data. This cannot be undone. Type RESET to confirm." with a text input field. The reset API is called only if the user types "RESET" (case-insensitive) and taps "Confirm".

#### 6.G.7. Touch Friendliness

- All tappable elements: minimum 44×44px touch target (padding if the visible element is smaller).
- Buttons: minimum height 44px, generous horizontal padding.
- Tab bar icons: 32×32px icon + label, in a 48px-tall bar.
- Inputs: minimum height 44px, font-size 16px (prevents iOS auto-zoom).
- Spacing between interactive elements: minimum 8px gap to prevent mis-taps.
- No hover-only interactions — all tooltips accessible via tap.
- Swipe between tabs: optional enhancement (not required for MVP, but the tab structure supports it).

#### 6.G.8. Auto-Polling and Performance

**Startup fetch:** `viewer.js` fetches `GET /api/presets` once on page load (before any tab is shown) and caches the result in `window.Polarrecorder.presetsCache`. Both the Polar tab preset selector and the Export tab preset dropdown are populated from this shared cache. If the fetch fails, both dropdowns fall back to showing only the Windy built-in preset. The cache is refreshed after any `presets/save` or `presets/delete` mutation (same fetch, same cache key) so both tabs stay in sync without independent fetches.

| Tab | Endpoint | Poll interval | Condition |
|---|---|---|---|
| — (startup) | `GET /api/presets` | — | Once on page load; refreshed after save/delete mutations |
| Polar | `GET /api/polar?format=<active>` | 30s | Tab visible; re-fetches immediately on preset change |
| Status | `GET /api/status` | 2s | Tab visible |
| Timeline | `GET /api/timeline?minutes=240` | 10s | Tab visible |
| Export | `GET /api/config` | — | Once on first Export-tab activation; cached on `window.Polarrecorder.configCache`. Used only for the high-confidence checkbox label (`min_samples_for_export`); falls back to "10" if the fetch fails. No independent presets fetch (uses the shared presets cache). CSV/JSON downloads are on-demand. |

Polling stops when a tab is not active (use a simple `activeTab` variable to gate `setInterval` fetches). On tab switch, fetch immediately, then resume interval.

The Status tab's recent-decisions strip (§6.G.4 Section 2) introduces **no additional fetch** — it is appended from each `GET /api/status` poll above (the 2 s Status row), so its resolution and visibility are exactly those of the Status poll.

**Error handling:** A fetch is treated as failed on a network error, a non-200 HTTP status, a JSON parse error, **or a 200 response whose body is `{"status": "ERROR", ...}`**. The plugin returns errors as HTTP 200 with a `{"status": "ERROR", "error": "..."}` body (AvNav serializes any returned dict as JSON; only a `None` return yields a non-200), so the JS **must inspect the body's `status` field** — checking the HTTP status alone is insufficient and would let application errors (unknown preset, invalid percentile, reserved name) pass as success. Two surfaces, by trigger:

- **Polling endpoints** (`status`, `polar`, `timeline`): on any failure (including a `status:"ERROR"` body), show a non-intrusive banner at the top of the active tab: "Connection lost — retrying..." styled with `--polarrecorder-attention-color`. Keep existing data visible (do not blank the screen or reset charts). Continue retrying on the normal poll interval. On the next successful fetch, dismiss the banner immediately. On initial load (no data yet), show a centered "Connecting to Polar Recorder..." message with a simple CSS spinner.
- **User-triggered actions** (`presets/save`, `presets/delete`, `export`, `export/json`, `reset`, `pause`, `resume`): on a `status:"ERROR"` body, surface the body's `error` message **inline next to the control that triggered it** (e.g. the reserved-name message on Save, an export-failure message by the Download button) rather than via the global banner — the user is waiting on that specific action. On a network/non-200/parse failure of an action, fall back to the global banner.

This covers: plugin not yet started, plugin crashed, user opened a stale bookmark, transient network issues, and explicit plugin-side validation errors.

**SVG rendering performance:** The polar diagram SVG should be rebuilt only when the rendered result could differ — key the skip on the tuple `(generation, active_format, active_percentile)`, not on `generation` alone. `generation` only changes when bins are updated/reset, so gating on it alone would wrongly suppress a redraw after the user switches preset or changes the percentile override (same bins, different curve). Avoid re-rendering on every 30 s poll when that tuple is unchanged.

#### 6.G.9. File Size and Split Strategy

**Target:** `viewer.html` contains the HTML structure and minimal inline CSS for above-the-fold rendering. `viewer.js` contains all JavaScript logic. `viewer.css` contains all viewer styles. `plugin.css` is an empty file (AvNav auto-loads it into the SPA; keeping it empty prevents style leakage into the chart plotter UI).

**As any viewer JS file approaches the 400-line limit**, split into multiple plain JS files loaded via `<script>` tags in `viewer.html` (AvNav serves all files in the plugin directory as static assets):

| File | Responsibility | Est. lines |
|---|---|---|
| `viewer.js` | App shell: tab switching, polling, state management, API calls | ~200 |
| `polar-chart.js` | SVG polar diagram rendering | ~200 |
| `timeline-chart.js` | SVG timeline: one rect per 1-minute bucket, color-coded by decision | ~100 |
| `export-ui.js` | Export configurator logic, preset management, grid editors (individual inputs, add/remove, auto-sort), CSV preview, download triggers | ~250 (if approaching 400 lines, split grid-editor logic into `grid-editor.js` and register as `Polarrecorder.GridEditor`) |

All files use a single global namespace object (`window.Polarrecorder = window.Polarrecorder || {}`) to avoid polluting the global scope. No ES module `import`/`export`. **Every JS file** begins with `window.Polarrecorder = window.Polarrecorder || {};` defensively so namespace creation doesn't depend on load order. The load order below matters for shared state dependencies (e.g., `API_BASE`), not namespace existence.

**Load order in `viewer.html`:** Script tags must appear in this order:

1. `viewer.js` — first. Creates the namespace, defines shared state (`API_BASE`, polling helpers, tab switching).
2. `polar-chart.js` — adds `Polarrecorder.PolarChart` (or similar) rendering functions.
3. `timeline-chart.js` — adds `Polarrecorder.TimelineChart`.
4. `export-ui.js` — adds `Polarrecorder.ExportUI`.

Each file after `viewer.js` registers its init/render functions on the namespace. `viewer.js`'s `DOMContentLoaded` handler (or a `<script>` block at the end of `<body>`) wires everything together: initializes each component, connects tab visibility to polling, and starts the initial data fetch.

**No-build constraint:** All JS in `viewer.html` or loaded from the plugin directory is plain, non-module JavaScript. No import/export statements. No bundler.

**Plugin.mjs role:** The plugin.mjs file is recognized by AvNav's module loader (Verified Baseline #40) and loaded via dynamic `import()` if present. **plugin.mjs is the one deliberate exception to the "no ES module import/export" rule:** AvNav loads it *as* an ES module, so its `export default` is required and correct. This is not a contradiction of Hard Constraint #7 or the coding standards — those prohibit ES module syntax in the *statically `<script>`-loaded viewer files* (all `*.js` files in the project root), which is why `check-patterns.mjs` scans `*.js` and explicitly excludes `plugin.mjs`. For polarrecorder MVP, plugin.mjs is a **minimal no-op stub** — a default export function that does nothing. User app registration is handled declaratively by `plugin.json`; plugin.mjs must NOT also register it. Post-MVP, plugin.mjs becomes the entry point for a dashboard status widget registered via `registerWidget()`.

**Testing approach for UI:** Manual visual testing in a browser using `tools/mock-server.py` — a minimal stdlib-only Python HTTP server that serves canned JSON responses from `tests/mock-data/` (one file per endpoint — the full set is `status.json`, `polar.json`, `rejections.json`, `timeline.json`, `config.json`, `presets.json`, `export-windy.csv`, and `export-json.json`; see the repository layout in §7 and the Phase 9 deliverables for the complete list and routing rules). Launch: `python tools/mock-server.py` (serves at `http://localhost:8080`). Open `viewer.html` with `<body data-api-base="http://localhost:8080/api/">` (or pass it as a query param). The mock server also serves `viewer.html` and all static files from the plugin directory so CORS is not an issue. Mock data files should contain representative data: multiple TWS bands, a mix of accepted/rejected timeline entries, non-zero counters. Vitest + jsdom tests for data transformation logic (export grid projection, histogram percentile extraction) if those functions are factored into testable JS modules loaded during testing.

---

## 7. Architecture

### Repository Layout

```
polarrecorder/
├── plugin.py                          # Thin AvNav integration shell
├── plugin.mjs                         # AvNav module entry point (user app registration)
├── plugin.css                         # Empty — AvNav auto-loads into SPA; kept empty to prevent style leakage (post-MVP: dashboard widget styles)
├── viewer.css                         # All viewer styles: CSS variables, day/night, responsive layout, components
├── plugin.json                        # Plugin metadata, version, userApp registration
├── icon.svg                           # User app icon
├── viewer.html                        # Full-page polar viewer app (HTML shell)
├── viewer.js                          # App shell: tabs, polling, state, API calls
├── polar-chart.js                     # SVG polar diagram rendering
├── timeline-chart.js                  # SVG timeline: one rect per 1-minute decision bucket
├── export-ui.js                       # Export configurator logic, CSV preview, downloads
│
├── polarrecorder/                               # Python package: all domain logic
│   ├── __init__.py
│   ├── reader.py                      # AvNav store value reading (imports ReadResult from sample.py)
│   ├── sample.py                      # ReadResult + Sample dataclasses, TWA normalization
│   ├── units.py                       # Unit conversion constants and functions
│   ├── bins.py                        # Bin address computation, bin data structures
│   ├── histogram.py                   # Speed histogram operations, percentile extraction
│   ├── polar_model.py                 # Polar model: bin grid, update, per-bin query, reset, sparse-bin accessor (no grid projection — see export.py)
│   ├── commit.py                      # Per-sample model-dispatch: commit_sample() applies the §6.B update contract (decision → update_accepted/record_rejection/record_quarantine). Pure, lock-unaware. Reused by plugin.py (under lock) and the Phase 5 poisoning tests.
│   ├── validation/
│   │   ├── __init__.py
│   │   ├── pipeline.py                # Validation pipeline runner
│   │   ├── state.py                   # ValidationState: rolling windows, cooldowns, previous samples
│   │   ├── angle_math.py             # Circular distance and circular range functions
│   │   ├── rules_core.py             # Rules R1–R10: stateless value checks
│   │   ├── rules_stability.py        # Rules R11–R15: rate-of-change, maneuver, stability window
│   │   ├── rules_heuristic.py        # Rule R16: engine heuristic, quarantine rules
│   │   └── rules_enhanced.py         # Future: optional signal rules (RPM, depth, AWA/AWS, etc.)
│   ├── persistence.py                 # JSON load/save, atomic write, backup, migration
│   ├── timeline.py                    # In-memory 1-minute decision buckets for rejection timeline
│   ├── logger.py                      # Logger protocol (Phase 3) + AvNavLogger adapter (Phase 7)
│   ├── counters.py                    # Aggregated rejection counters
│   ├── api_handlers.py                # API response formatting (no AvNav imports)
│   ├── export.py                      # Export grid presets, CSV generation
│   ├── config.py                      # Configuration dataclass, defaults, parsing from strings
│   └── params.py                      # EDITABLE_PARAMETERS spec (pure data: AvNav param dicts; no AvNav imports)
│
├── tests/                             # All tests
│   ├── conftest.py                    # Shared fixtures, fake AvNav API
│   ├── test_sample.py
│   ├── test_units.py
│   ├── test_bins.py
│   ├── test_histogram.py
│   ├── test_polar_model.py
│   ├── test_commit.py
│   ├── test_validation_core.py
│   ├── test_validation_stability.py
│   ├── test_validation_heuristic.py
│   ├── test_angle_math.py
│   ├── test_validation_pipeline.py
│   ├── test_persistence.py
│   ├── test_timeline.py
│   ├── test_counters.py
│   ├── test_logger.py
│   ├── test_api_handlers.py
│   ├── test_export.py
│   ├── test_config.py
│   ├── test_reader.py
│   ├── test_plugin_integration.py     # Integration tests with fake AvNav API
│   ├── test_poisoning_scenarios.py    # Scenario tests for poisoning resistance
│   └── mock-data/                     # Canned JSON responses for UI mock server
│       ├── status.json                # Mock GET /api/status response
│       ├── polar.json                 # Mock GET /api/polar response
│       ├── rejections.json            # Mock GET /api/rejections response
│       ├── timeline.json              # Mock GET /api/timeline response
│       ├── config.json                # Mock GET /api/config response
│       ├── presets.json              # Mock GET /api/presets response
│       ├── export-windy.csv           # Mock CSV content for GET /api/export?format=windy
│       └── export-json.json           # Mock GET /api/export/json response
│
├── documentation/
│   ├── TABLEOFCONTENTS.md
│   ├── core-principles.md
│   ├── QUALITY.md
│   ├── TECH-DEBT.md
│   ├── conventions/
│   │   ├── coding-standards.md
│   │   ├── smell-prevention.md
│   │   └── testing-infrastructure.md
│   ├── architecture/
│   │   ├── plugin-lifecycle.md
│   │   ├── data-pipeline.md
│   │   ├── polar-model.md
│   │   ├── persistence.md
│   │   ├── api.md
│   │   └── ui.md
│   ├── avnav/
│   │   └── keys-and-units.md
│   ├── filters/
│   │   ├── rejection-rules.md
│   │   └── poisoning-resistance.md
│   ├── user/
│   │   ├── configuration.md
│   │   ├── export-import.md
│   │   └── troubleshooting.md
│   └── guides/
│       └── exec-plan-authoring.md
│
├── misc/                               # Read-only unpacked reference source trees (NOT shipped, NOT modified; deleted in Phase 11 once the project is complete)
│   ├── avnav-master/                   # AvNav source tree (Verified Baseline references)
│   └── dyninstruments/                 # dyninstruments source tree (quality-infra references)
│
├── exec-plans/
│   ├── active/
│   │   ├── PLAN1.md                     # The active execution plan
│   │   ├── PLAN1.progress.md            # Per-plan phase-completion ledger (controller-maintained, §10 Phase 0)
│   │   └── PLAN1.amendments.md          # Per-plan plan-defect/amendment ledger (controller-maintained, §10 Phase 0; created on first amendment)
│   └── completed/
│
├── tools/
│   ├── check-all.sh                   # Master quality gate script (Python + JS checks)
│   ├── check-release.py               # Release artifact validation
│   ├── check-python-filesize.py       # Python file size limit + header enforcement
│   ├── release-zip.py                 # Release zip builder (excludes data/, tests/, tools/, etc.)
│   ├── check-docs.mjs                 # TABLEOFCONTENTS ↔ filesystem sync (from dyninstruments)
│   ├── check-doc-format.mjs           # Status/Overview/Key Details structure (from dyninstruments)
│   ├── check-doc-reachability.mjs     # Internal Markdown link resolution (from dyninstruments)
│   ├── check-ai-instructions.mjs      # AGENTS.md/CLAUDE.md shared block sync (from dyninstruments)
│   ├── sync-ai-instructions.mjs       # Shared block sync tool (from dyninstruments)
│   ├── check-file-size.mjs            # 400-line JS limit + oneliner detection (from dyninstruments)
│   ├── check-headers.mjs              # JS file header enforcement (adapted from dyninstruments)
│   ├── check-patterns.mjs             # JS anti-pattern detection (purpose-built, no dyninstruments dependency)
│   ├── check-namespace.mjs            # window.Polarrecorder enforcement (adapted from check-umd.mjs)
│   ├── check-naming.mjs               # Naming convention enforcement (purpose-built, no dyninstruments dependency)
│   ├── check-dependencies.mjs         # JS dependency direction enforcement (purpose-built, no dyninstruments dependency)
│   ├── install-hooks.mjs              # Git pre-push hook installer (from dyninstruments)
│   └── mock-server.py                 # Minimal HTTP server serving canned API responses for UI testing
│
├── releases/                          # Release zip artifacts
│
├── AGENTS.md                          # AI agent instructions (adapted from dyninstruments)
├── CLAUDE.md                          # Claude-specific agent instructions (shared block with AGENTS.md)
├── README.md                          # User-facing documentation
├── CONTRIBUTING.md                    # Contributor guide
├── ARCHITECTURE.md                    # Root architectural orientation
├── ROADMAP.md                         # Post-MVP roadmap
├── CHANGELOG.md                       # Release history
├── pyproject.toml                     # Python project config (pytest, ruff, mypy, coverage)
├── package.json                       # Node.js quality scripts (doc checks, JS linting, hooks)
├── .gitignore                         # Ignores data/, releases/, __pycache__/, .pytest_cache/, etc.
└── .githooks/
    └── pre-push                       # Runs tools/check-all.sh before push (installed via npm run hooks:install)
```

### Module Boundaries and Contracts

**Layer 1 — AvNav Integration (plugin.py only)**

`plugin.py` is a thin shell. It:
- Defines `Plugin` class with `pluginInfo()`, `__init__(api)`, `run()`.
- Registers a restart callback via `api.registerRestart()` that sets a `_stop_requested` flag (lightweight, no I/O, no lock — safe to call from any thread).
- In `run()`: **first resets `self._stop_requested = False`** (AvNav reuses the same `Plugin` instance across an enable→disable→enable cycle — `pluginhandler.py:935` instantiates once and `:669–675` re-invoke `self.plugin.run()` — so a prior disable left `_stop_requested = True`; without this reset the loop's `while not … and not self._stop_requested` guard would exit immediately and the re-enabled plugin would silently do nothing. The reset is safe even if AvNav ever created a fresh instance, since the flag would already be `False`.) Then captures `run_start_monotonic` and enters the NMEA-queue-coupled sampling loop. When `api.shouldStopMainThread()` returns `True` **or** the `_stop_requested` flag is set (triggered by the restart callback), the loop exits and `run()` performs a **final flush** (serialize under lock, write to disk) before returning. Each loop iteration also flushes when the periodic interval has elapsed **or** when the `_flush_requested` flag has been set by an API handler (e.g. `reset`); after a flag-requested flush the plugin thread clears the flag. All flushes — periodic, final, and flag-requested — happen in the plugin thread only (the single-writer rule, §6.E), so there is no cross-thread flush race.
- Delegates ALL domain logic to `polarrecorder/` modules.
- **Per-sample debug logging is gated on `config.debug_logging`.** This is the sole effect of the `debug_logging` editable parameter and the mechanism that satisfies HC #9 ("debug-level logging only when enabled"). Once per loop iteration that runs the pipeline, when `self.config.debug_logging` is `true`, `plugin.py` emits one `self.logger.debug(...)` line summarizing that sample's decision (the `PipelineResult.decision` and `reason_codes`); when `false`, it emits nothing per-sample. The gate reads the iteration's config snapshot (the same `config = self.config` snapshot taken at the top of the loop, §7 Config hot-swap), so toggling the parameter at runtime takes effect on the next iteration. `AvNavLogger` stays a dumb adapter — it does **not** inspect `debug_logging`; the gate lives in `plugin.py`. The rare, non-per-sample `logger.debug()` diagnostics elsewhere (`config.py` range-clamp, `persistence.py`, `pipeline.py`) are **not** gated by this flag — AvNav's own log level governs their visibility — because HC #9 scopes the constraint to per-sample decision logging.
- Is the ONLY file that imports or references the AvNav API.
- **Imports `avnav_api` only under `TYPE_CHECKING`, never at runtime.** `avnav_api` ships inside the AvNav server tree and is absent from the dev/CI environment, yet `plugin.py` must be importable there (the smoke test and `test_plugin_integration.py` do `import plugin` with a `FakeAvNavAPI`, and the gate runs `mypy … plugin.py`). So the `AVNApi` type used to annotate the injected `api` parameter is imported in a `if TYPE_CHECKING:` block (combined with the mandatory `from __future__ import annotations`, the annotation is a never-evaluated string at runtime). At runtime `plugin.py` touches the AvNav API purely through the duck-typed `api` object AvNav injects into `__init__(self, api)`; it issues no executable `import avnav_api`. `mypy --strict` resolves the type-checking-only import via the `ignore_missing_imports` override for `avnav_api` in `pyproject.toml` (treating `AVNApi` as `Any` at the boundary). This is why the `TID251` ban-exemption is scoped to `plugin.py`.
- Calls `api.setStatus()` at defined state transitions:
  - `STARTED` — set at the beginning of `run()`, before entering the sampling loop.
  - `RUNNING` — set on the first **complete** store read, i.e. all three core values (TWA, TWS, STW) present (instruments providing usable data). A partial read (one or two values present) does not reach `RUNNING`, consistent with the UI mapping partial → "No Data" (§6.F) and the fact that a polar sample requires all three values.
  - `NMEA` — set on first accepted sample (validation pipeline passed, model updated). This is the steady-state status during normal sailing with good data.
  - `ERROR` — set if persistence load fails on both primary and backup (data loss), or if an unrecoverable error is caught. Accompanied by a descriptive `info` string.
  - On clean shutdown, no explicit status change — AvNav handles the transition to `INACTIVE`.
- **Status demotion on data loss:** Status can move backward. The demotion counter is driven by **`last_data_status`, which `plugin.py` computes on every loop iteration including pause/disabled** (§7 Thread Safety) — **not** by the `reject_missing_*` reason codes, which fire only on the normal (non-paused) path via R2 and would therefore never trip while paused or disabled with the instruments off. The counter increments on **any** iteration whose `last_data_status` is `"partial"` or `"no_data"` (one or more core values absent — a partial read counts) and **resets to zero on any `"receiving"` iteration** (all three core values present). If the counter reaches 30 consecutive incomplete iterations (≈30 seconds at 1 Hz), demote to `STARTED` with info `"No instrument data"`. Promote back to `RUNNING` on the next `"receiving"` iteration; promote back to `NMEA` on the next accepted sample. Keying on `last_data_status` keeps demotion consistent with the `RUNNING` transition above and the UI's partial → "No Data" mapping, fires correctly regardless of recording state, and the 30-sample threshold prevents twitchiness on brief dropouts. Tracked via a simple integer counter in `plugin.py` (not in `polarrecorder/` — this is AvNav integration logic).
- Target: a thin shell. Subject to the uniform 400-line hard limit, and expected to sit comfortably under it — `plugin.py` holds only AvNav wiring and the sampling loop; all domain logic lives in `polarrecorder/`.

**Layer 2 — Store Reading (polarrecorder/reader.py)**

- Defines a `StoreAPI` protocol for the AvNav API dependency:
  ```python
  class DataEntryLike(Protocol):
      value: float
      timestamp: float  # time.monotonic()-based

  class StoreAPI(Protocol):
      def getSingleValue(self, key: str, includeInfo: bool = False) -> DataEntryLike | None: ...  # noqa: N802, N803 (mirrors AvNav's API surface)
  ```
  `plugin.py` passes the real AvNav API (which satisfies `StoreAPI` structurally). Tests pass a `FakeStoreAPI`. This keeps `reader.py` free of AvNav imports while enabling `mypy --strict` type checking.
- Reads AvNav store values via the `StoreAPI` interface.
- Receives an injected `clock: ClockFn` (monotonic, default `time.monotonic`) and `wall_clock: WallClockFn` (default `time.time`) — the reader is the single point where read-time is captured. It stamps `ReadResult.timestamp_monotonic = clock()` and `ReadResult.timestamp_wall = wall_clock()` once per read. No hidden `time.*` calls (core principle #9); tests inject `FakeClock`.
- Returns a `ReadResult` dataclass (imported from `polarrecorder/sample.py`) with raw values (`float | None`) and store timestamps (`float | None`).
- When `getSingleValue(key, includeInfo=True)` returns `None`, the corresponding fields in `ReadResult` are `None`.
- Testable with a fake API object implementing `StoreAPI`.

**Layer 3 — Sample Normalization (polarrecorder/sample.py, polarrecorder/units.py)**

- `ReadResult` dataclass defined in `polarrecorder/sample.py` (raw store output, allows `None`).
- `Sample` dataclass defined in `polarrecorder/sample.py` (normalized, all `float` fields guaranteed).
- `RuleResult` dataclass defined in `polarrecorder/sample.py` (per-rule `decision` + `reason_codes`, §6.C). It lives here — not in `pipeline.py` — so the rule modules and the runner can both import it without a `pipeline`↔`rules_*` circular import (see §6.C).
- `PipelineResult` dataclass defined in `polarrecorder/validation/pipeline.py` (decision + reason codes, returned by the pipeline runner).
- `build_sample(read_result: ReadResult) -> Sample | None` constructs a `Sample` from a `ReadResult`. Returns `None` if any required field (`twa_raw`, `tws_raw`, `stw_raw`) is `None` or non-finite (NaN, Inf) — this embodies the same checks as R1/R2 without coupling to the pipeline. When it returns a `Sample`, all `float` fields are guaranteed non-None. Converts m/s to knots, normalizes TWA, computes freshness ages **entirely from `ReadResult` fields** (each `*_age_s` = `read_result.timestamp_monotonic - read_result.*_timestamp`), and sets `enhanced=None` in MVP (no enhanced signals are read — the `Sample.enhanced` field is the post-MVP extension point, §4 Enhanced Data Mode). **Because the reader sets each `*_timestamp` non-None whenever the matching `*_raw` is non-None (§6.A), `build_sample` must narrow the three timestamps to `float` before this subtraction** — otherwise `mypy --strict` rejects `float - (float | None)`. Narrow them in the same presence guard that checks the raw values (e.g. treat a `None` timestamp as a missing value and return `None`, or `assert read_result.twa_timestamp is not None` — `S101` is globally ignored), so the age arithmetic type-checks. It takes no clock argument — the read-time was already captured by the reader, so `build_sample` is a pure function of its input. Called by the pipeline runner (Phase A calls `build_sample` after R1/R2 pass and the runner returns the result to `plugin.py`, §6.C) and directly by `plugin.py` only during pause/disabled (to warm `ValidationState` without running the pipeline). On the normal path `plugin.py` does not call it — it uses the `Sample` the runner returns.
- Pure functions. No AvNav dependency.

**Layer 4 — Validation (polarrecorder/validation/)**

- Pipeline runner executes rules in order. Signature: `run(read_result, state, config, logger=None) -> tuple[PipelineResult, Sample | None]` — it owns R1/R2 and `Sample` construction and returns the built `Sample` (or `None` on an R1/R2 rejection) so `plugin.py` reuses it for `observe()` and the model update (§6.C "Pipeline runner return type").
- Each rule is a pure function or uses `ValidationState` for rolling windows.
- Rules return `RuleResult`.
- `ValidationState` tracks previous samples, cooldown timers, stability buffers.
- **Stability buffer:** Time-based, not count-based. Each entry is stamped with the current sample's `timestamp_monotonic` (the read-time captured by `reader.py`), **not** a fresh clock call. On each evaluation, "now" is the current sample's `timestamp_monotonic`; entries older than `now - stability_window_seconds` are pruned first, then the range check is applied to remaining entries. This handles irregular sampling gracefully (if samples are skipped due to stale data or no NMEA traffic, the window still represents real elapsed time) and keeps a single time source per iteration (matching R11–R13, which compute deltas from sample timestamps). Data structure: `collections.deque` of `(monotonic_time, twa_deg_raw, tws_kt, stw_kt)` tuples with `maxlen=300` as a safety cap (5 minutes at 1 Hz — well above the default 15-second window, prevents unbounded growth if the pruning logic malfunctions). **Field selection is fixed, not free:** the buffer (and `previous_sample` below) store the `Sample`'s **raw 0–360° TWA** (`twa_deg_raw`), and TWS/STW **in knots** (`tws_kt`, `stw_kt`). R15's circular range (and R11's circular distance) require the wrapping 0–360 representation — a tack from 30° starboard to 30° port is `30 → 330` (a 60° circular swing) in raw degrees but `30 → 30` (no change) in the folded `twa_deg_abs`, which would make the rule blind to the maneuver. Speeds are in knots to match the kt and kt/s thresholds of R12/R13/R15. Do **not** store `twa_deg_abs`/`twa_deg_signed` or `*_ms` here.
- **Cooldown timer:** Stored as a monotonic timestamp of when the cooldown expires, computed as `sample.timestamp_monotonic + cooldown_seconds` when R11 fires. Checked against the current sample's `timestamp_monotonic`: `sample.timestamp_monotonic < cooldown_expires` → in cooldown. No clock call.
- **`ValidationState` takes no clock.** All of its time reasoning derives either from the `timestamp_monotonic` field of the `Sample` passed in on each call, or from an explicit `now_monotonic` argument the caller supplies (see `is_warming_up` below) — never from a hidden `time.*` call. This is why `state.py` is absent from the clock-injection list (§8 Testing Approach).
- **`is_warming_up(now_monotonic: float) -> bool`** — the single source of the status `warming_up` flag (§6.F, §7 Thread Safety). It is the exact complement of R15's "filled" predicate: it prunes entries strictly older than `now_monotonic − stability_window_seconds` from the stability buffer, then returns `True` iff the buffer is empty **OR** `now_monotonic − oldest_retained_entry.timestamp_monotonic < stability_window_seconds` (i.e. the buffer does not yet span a full window). Returns `True` on an empty buffer (post-startup/restart). It takes `now_monotonic` as an argument rather than reading a clock — keeping `ValidationState` clockless (principle #9) — and `plugin.py` passes the **same `now` R15 used that iteration** so the stored flag agrees with R15's `reject_warming_up` branch by construction (see the call-ordering rule in §6.C "ValidationState update policy"). Pruning here is idempotent with R15's prune and with `observe()`'s prune (all use the strict `> now − window` rule on the same monotonic timeline), so calling it does not disturb buffer contents that a later same-iteration step depends on.
- **Previous sample:** The last `(monotonic_time, twa_deg_raw, tws_kt, stw_kt)` for rate-of-change delta computation — same field/unit selection as the stability buffer above (raw 0–360° TWA so R11's circular distance handles the wrap; speeds in knots to match R12/R13 thresholds).
- **Update policy:** maintenance (prune+append stability buffer, update `previous_sample`) is the single method `ValidationState.observe(sample)`, called by `plugin.py` once per valid `Sample` after the pipeline runs (or after `build_sample` during pause/disabled). The pipeline runner never calls `observe()`; it only reads prior state, and R11 sets the cooldown timer. The full ordering and rationale are specified in §6.C ("ValidationState update policy").
- No AvNav dependency. No persistence dependency. No model dependency.

**Layer 5 — Polar Model (polarrecorder/polar_model.py, polarrecorder/bins.py, polarrecorder/histogram.py)**

- `Histogram` handles speed frequency counting and percentile extraction.
- `Bin` holds per-bin histogram and counters.
- `PolarModel` holds the full bin grid, provides update, per-bin query, reset, a read accessor exposing its sparse bins (`iter_bins()`/`bins`) for in-process single-threaded consumers, and **`snapshot_bins()` — the detached read accessor for the API read path** (returns plain, freshly-copied per-bin dicts that share no mutable state with the live model, so formatters can run outside the lock; §6.B, §7 Thread Safety). The coarse export-grid projection lives in `export.py` (Layer 8), not here.
- Pure data structure. No AvNav dependency. No persistence dependency.

**Layer 6 — Persistence (polarrecorder/persistence.py)**

- Serializes/deserializes `PolarModel` and `Counters` to/from JSON (both are top-level keys in the persistence schema).
- Exposes a **pure** `serialize_to_dict(model, counters, metadata) -> dict` (no disk I/O) as the single source of truth for the persistence schema. It walks the **live** model via `iter_bins()`, so every caller invokes it **under the lock**: `save()` calls it on the plugin thread during the flush; for the `export/json` backup body, `plugin.py` calls it under the lock and then hands the result to `api_handlers.export_json` (which only wraps it). This guarantees the on-disk file and the backup endpoint share one shape while keeping all live-model access under the lock.
- **`load(...)` return contract.** `load()` returns a `LoadResult` dataclass carrying: `model` (the deserialized `PolarModel`, or a fresh empty model), `counters` (deserialized `Counters`, or fresh), `created_wall: float | None` (the dataset birth time read from the file, or `None` when no usable file existed so `plugin.py` mints it on the first `save()` — see the §6.E timestamp lifecycle), and `status` — one of `"loaded"` (primary file valid), `"recovered_backup"` (primary corrupt/missing, backup valid), `"fresh"` (neither file exists — normal first run), `"corrupt_empty"` (both files exist but are corrupt — data loss), or `"schema_too_new"` (file's `schema_version` exceeds the code's max known version). `plugin.py` maps `status` to `api.setStatus()`: `"corrupt_empty"` and `"schema_too_new"` → `ERROR` (with the descriptive `info` strings from §6.E, the latter including the version numbers); `"fresh"`, `"loaded"`, and `"recovered_backup"` are non-error startups (`"recovered_backup"` having already logged a warning inside `load()`). This is the only way `plugin.py` can satisfy both the §6.E created-wall carry-over and the §7 Layer 1 ERROR-status rule.
- Handles atomic writes, backup, corruption recovery, schema migration.
- Receives a file path, not an AvNav API.
- Testable with temp directories.

**Layer 7 — API Response Formatting (polarrecorder/api_handlers.py)**

- Owns the **read endpoints only** (`status`, `polar`, `rejections`, `timeline`, `export`, `config`, `presets`, `export/json`). Each is a pure formatter function (e.g. `format_status(...)`, `format_polar(...)`) that turns pre-snapshotted data — `PolarModel`, counters, timeline data, config, and derived status fields (`warming_up`, current input values, current decision) — into an API response dict. The **mutating** endpoints (`reset`, `pause`, `resume`, `presets/save`, `presets/delete`) are **not** handled here: they mutate live state and/or write files, which a pure snapshot formatter cannot do. They live in `plugin.py` (reset/pause/resume, under the lock) and `export.py` (preset save/delete, file I/O — invoked by `plugin.py` while it holds the lock, §7 Thread Safety) — see §6.F, §7 Thread Safety, and the dispatch note below.
- **Dispatch location.** The single request dispatcher is `plugin.py._handle_request` (Layer 1), not `api_handlers`. After normalizing args and resolving recording state, it routes: mutation endpoints → handled inline in `plugin.py` (reset/pause/resume, under the lock) or via `export.py` (preset save/delete, with `plugin.py` holding the lock around the `export.py` call — see §7 Thread Safety); read endpoints → snapshot the needed state under the lock, release the lock, then call the matching `api_handlers.format_*` function outside the lock. `api_handlers` therefore exposes one pure formatter per read endpoint and contains **no live-state mutation and no dispatcher over all 13 endpoints**.
- **Pylint return/branch limits and the two intrinsic multi-return functions.** The strict `max-returns = 4` (PLR0911) and `max-branches = 10` (PLR0912) limits stay in force. Two functions in this plan have a return/branch count that is intrinsic to their spec and may exceed them: (1) the `export` `format`-param resolution helper in `api_handlers`/`export.py` (§6.B "Export `format` param resolution order" — ~6 distinct return points), and (2) `plugin.py`'s request dispatcher (`_handle_request`) if written as an if/elif chain over the ~13 endpoints. For these two, a **targeted suppression is acceptable** — add `# noqa: PLR0911` (and `# noqa: PLR0912` where branches also exceed) on the function's `def` line with a brief inline reason comment. (For the dispatcher, a module-level `dict[str, Callable]` route table — `ROUTES.get(url, _not_found)(...)` — is the preferred alternative because it collapses the dispatcher to ~1 branch / ~1 return; the if/elif-plus-suppression form is permitted but not preferred. The route table lives in `plugin.py` because it must bind to live state, the lock, and `export.py` preset I/O.)
- Builds the `export/json` backup body via `export_json(serialized: dict) -> dict`, which simply wraps the **already-serialized** dict in `{"status": "OK", "data": serialized}`. `plugin.py` produces that dict by calling `persistence.serialize_to_dict(model, counters, metadata)` **under the lock** (the live model walk must be locked — §6.E, §6.B) and passes the result in. `api_handlers` therefore does **not** import or call `persistence` and never touches the live model — there is no `api_handlers → persistence` dependency.
- Receives **detached, deep-copied snapshots** from `plugin.py` (taken under the lock): `PolarModel.snapshot_bins()` output for `polar`/`export`, fresh `dict(...)` copies of the global and per-bin rejection histograms for `rejections`, a counters copy and the `top_rejections` derived from a `rejection_histogram` copy for `status`, and `timeline.query()` output (already plain dicts) for `timeline`. Because each is a fresh, fully-detached structure, the formatters iterate them **outside** the lock with no risk of racing the sampling thread's in-place mutations (§7 Thread Safety). `api_handlers` never accesses `PolarModel`, `Counters`, or `ValidationState` live objects directly.
- **Formatter input shape (satisfies `max-args = 6` and `mypy --strict`).** `format_status` needs ~13 logical inputs (record_enabled, recording, data_status, warming_up, uptime, current values, current decision, counters, the pre-derived `top_rejections` list, persistence info, generation, now_monotonic, and `stale_threshold` — supplied so the handler can derive each per-value `<key>_stale` flag, §6.F), which would breach `max-args = 6` if passed individually and is awkward to type as a bare `dict` under strict mypy. It is the **only** read endpoint that breaches the limit, so the rule is asymmetric by design:
  - `format_status(snapshot: StatusSnapshot) -> dict` takes a **single typed snapshot dataclass** `StatusSnapshot`, **defined in `api_handlers.py`** alongside the formatter that consumes it (keeps the input type next to its only reader; `plugin.py` already imports `api_handlers`). `plugin.py` populates `StatusSnapshot` from live state **under the lock** (the plain scalars from §7 Thread Safety plus `now_monotonic`, a counters snapshot, the `top_rejections` list derived under the lock from a `rejection_histogram` copy per §7 Thread Safety, and the persistence-info fields), then calls `format_status` outside the lock. Populating the dataclass is trivial wiring, not business logic. (`format_status` formats the four-total `counters` block and `acceptance_rate`; the full `rejection_histogram` is **not** carried on the snapshot — only the pre-derived `top_rejections` is — so the formatter never iterates a live histogram.)
  - The other read formatters take the already-bundled live/snapshot objects plus only the scalar query-derived args they need, all naturally ≤ 6: `format_polar(model_bins, tws_grid, percentile, generation, format_name)`, `format_export(model_bins, twa_grid, tws_grid, percentile, min_samples)`, `format_timeline(entries)` (the `minutes` window filtering and the oldest-first ordering already happened in `timeline.query(minutes)`, §7 Layer 9, so the formatter is a pure serializer of the already-filtered plain-dict buckets — it takes no `now_wall`/`minutes`, which it could not use and which would trip the blocking `ARG` rule), `format_rejections(global_hist, per_bin)`, `format_config(config)`, `format_presets(presets_data)`, and `export_json(serialized)` (a one-line wrapper around the dict `plugin.py` already built under the lock via `serialize_to_dict` — see the `export/json` bullet above). No additional snapshot dataclasses are introduced for these.
  - `test_api_handlers.py` constructs a `StatusSnapshot` directly to exercise `format_status`.
- For freshness ages in `GET status`, `plugin.py` includes a `now_monotonic` value (read from its injected clock at snapshot time) in the snapshot it passes in; the handler computes each `*_age_s` as `now_monotonic - store_timestamp` and each `*_stale` boolean as `*_age_s > stale_threshold` (using the `stale_threshold` carried in the snapshot). `api_handlers.py` never calls `time.monotonic()` itself (core principle #9) — all "current time" values are supplied by `plugin.py`.
- Pure functions. No AvNav dependency.

**Layer 8 — Export (polarrecorder/export.py)**

- Defines the Windy Passage Planner built-in preset (hardcoded TWA/TWS grids).
- Loads/saves/deletes user presets from `data/presets.json` (atomic write, corruption-tolerant — falls back to empty on corrupt/missing file).
- Projects polar model onto target grids (built-in or user-defined). The projection function receives a **detached snapshot of the sparse bins** as an argument — the plain-dict output of `PolarModel.snapshot_bins()` (§6.B), taken by `plugin.py` under the lock — **not** the live `iter_bins()` objects, because the projection runs outside the lock (§7 Thread Safety). It does **not** import `polar_model` (preserving the dependency direction; annotate the snapshot argument with a structural type — e.g. `Mapping[tuple[int, int], Mapping]` — or a `typing.TYPE_CHECKING` import). It takes `min_samples` as a parameter. The caller chooses the floor: the `/api/polar` diagram always passes `MIN_SAMPLES_DISPLAY` (3); CSV export passes `MIN_SAMPLES_DISPLAY` (3) by default and `min_samples_for_export` (default 10) only when `high_confidence=yes` (§6.B step 5). `MIN_SAMPLES_DISPLAY` is a named constant defined in this module and reused by `api_handlers` for both the polar and default-export paths.
- Generates CSV strings.
- Projection and CSV generation are pure functions. Preset I/O receives a file path, not an AvNav API.

**Layer 9 — Timeline (polarrecorder/timeline.py)**

- **1-minute decision buckets**, not per-sample entries. The timeline's sole purpose is to let the user see *when* the recorder was accepting vs. rejecting data — e.g. to confirm an anchoring or motoring stretch was detected — so it stores aggregate counts per minute, not individual samples. This makes it tiny (constant size, independent of `sample_interval`), eliminates the ~3 MB transfer, and removes all client-side pixel-bucketing/zoom machinery.
- **Structure:** a fixed window of **240 buckets = 4 hours at 1-minute resolution**. Each bucket is keyed by its minute-start wall time and holds:
  - `t` (float) — bucket start, wall clock (`bucket_start = (int(wall_time) // 60) * 60`).
  - `accepted`, `rejected`, `quarantined` (int) — decision counts in that minute.
  - `reasons` (`dict[str, int]`) — reason-code counts for that minute (every `reject_*`/`quarantine_*` code that fired, including candidacy-gate, `reject_warming_up`, pause, and disabled codes). This is what surfaces *which* rule caught a stretch (e.g. `reject_anchored`, `quarantine_engine_suspected`).
  - No TWA/TWS/STW values are stored — live per-value detail lives on the Status tab (polled every 2 s), so the R1/R2 "null values" problem of the old per-sample design no longer exists.
- **`record(decision, reason_codes)`** — called by `plugin.py` under the lock once per loop iteration (every iteration: accepted, rejected, quarantined, paused, disabled). Computes the current bucket from the injected `wall_clock()`, creates it on first contact, increments the matching decision counter, and adds each reason code to that bucket's `reasons`. Evicts buckets older than 4 hours (keeps at most 240). The bucket span is fixed in wall-clock time regardless of `sample_interval`.
- **`query(minutes) -> list[dict]`** — returns the buckets whose start falls within the last `minutes` minutes (using `wall_clock()`), oldest-first, serialized to plain dicts. Empty (no-sample) minutes are simply absent from the result; the UI renders them as gaps on the time axis.
- Receives the injected `wall_clock` callable (the same one `plugin.py` injects into `reader.py`/`persistence.py`; §6.B2). No monotonic clock needed. Estimated memory: a few KB at full capacity.
- Pure data structure.

**Layer 10 — Config (polarrecorder/config.py)**

- Configuration dataclass with defaults.
- Parsing from string values (for AvNav editable parameters — all values arrive as strings). **`BOOLEAN` parameters (`record_enabled`, `debug_logging`) must be parsed with AvNav's own convention — `value.strip().upper() == "TRUE"` — so the strings `"true"`/`"false"` (case-insensitive) round-trip correctly; any other string is `False`. `NUMBER` parses via `int(...)`, `FLOAT` via `float(...)`, matching AvNav's `WorkerParameter` coercion (`avnav_worker.py`).**
- Validation of config values: parse string to target type. If parsing fails (e.g., `"abc"` for a FLOAT field), log a warning and keep the previous value for that parameter. If parsing succeeds but the value is outside the declared range, clamp to the nearest range bound and log a debug message. The parsing function accepts an **optional `logger` parameter** (`Logger | None`, default `None`) for these diagnostics — the same optional-logger convention used by `persistence.py`/`reader.py`/`pipeline.py`. When `logger is None` (e.g. unit tests not asserting on log output), parsing still clamps/falls back silently. `plugin.py` passes its `AvNavLogger` when calling the parser from `__init__` and `_on_config_change`.
- `config.py` holds the parsed `Config` dataclass and the parsing/validation logic only — it does **not** hold the AvNav-facing parameter spec (that lives in `params.py`, Layer 11).
- **Range bounds come from `params.py` — single source of truth.** The min/max used by the range-clamp step above are **not** duplicated in `config.py`; the parse/validation function reads each parameter's `rangeOrList` from `params.EDITABLE_PARAMETERS` (imported from `polarrecorder/params.py`) and clamps `NUMBER`/`FLOAT` values to those bounds. This avoids a second copy of every threshold range (which would be the duplicated-magic-number smell and could silently drift from the registered AvNav spec). `config → params` is a clean forward dependency: `params.py` has no dependencies, so there is no cycle (see Dependency Direction). `BOOLEAN` parameters have no range (`rangeOrList` absent) and are not clamped.
- The `Config` dataclass itself is pure data; only the parse/validation function carries the optional `logger` (see above).

**Layer 11 — Editable-Parameter Spec (polarrecorder/params.py)**

- Defines `EDITABLE_PARAMETERS: list[dict]` — the AvNav parameter dicts (`name`, `type`, `default` as a string, `rangeOrList`, `description`) for the full table below. Pure data; no AvNav imports (it is AvNav-*shaped* data, not AvNav code).
- Consumed only by `plugin.py`: passed verbatim to `api.registerEditableParameters()`, and iterated to read each initial value via `api.getConfigValue(name, default)`. Externalizing it here (rather than inline in `plugin.py`) is what keeps `plugin.py` under the 400-line limit.
- A consistency test in `test_config.py` asserts: (1) every entry's `name` maps to a `Config` field; (2) every `default` string parses cleanly to that field's type; (3) every `NUMBER`/`FLOAT` entry has a `rangeOrList` and every `BOOLEAN` entry has none; and (4) **behaviorally** — that `config.py`'s parser actually reads and applies `params.rangeOrList`: for each `NUMBER`/`FLOAT` parameter, a value above `max` parses to `max` and a value below `min` parses to `min`. (A bare "`rangeOrList` equals the clamp bound" assertion would be a tautology here — `params.py` is the single source of those bounds per Layer 10, so the clamp bound *is* `rangeOrList`; the behavioral check is what proves the wiring is live rather than asserting `X == X`.)

**Complete editable parameters list:**

All parameters are registered via `api.registerEditableParameters()` in `__init__`, using the `EDITABLE_PARAMETERS` spec defined in `polarrecorder/params.py` (Layer 11) — not a literal inlined in `plugin.py`. AvNav delivers all values as strings; `config.py` parses and validates them. **All `default` values must be defined as strings** — both in `params.EDITABLE_PARAMETERS` (passed to `registerEditableParameters()`) and in the `api.getConfigValue(name, default)` calls that read initial values in `__init__`. On first run a parameter has no stored value, so `getConfigValue` returns the supplied `default` verbatim; if that default were a raw `bool`/`int`/`float`, `config.py` would receive a non-string and the BOOLEAN parser (`value.strip().upper() == "TRUE"`) would raise `AttributeError`. Defaults are therefore written as `"true"`, `"1.0"`, `"65"`, etc. — never `True`, `1.0`, `65` — so `config.py` only ever parses strings.

| Name | Type | Default | Range | Description |
|---|---|---|---|---|
| `record_enabled` | BOOLEAN | `true` | — | Master recording enable/disable (plugin-owned; NOT named `enabled`, which is reserved by AvNav — see §6.B4) |
| `sample_interval` | FLOAT | `1.0` | 0.5–5.0 | Seconds between store value reads |
| `percentile` | NUMBER | `65` | 1–99 | Percentile for polar speed extraction |
| `flush_interval` | NUMBER | `300` | 60–3600 | Seconds between persistence flushes |
| `stale_threshold` | FLOAT | `3.0` | 1.0–30.0 | Max age (seconds) for a store value before it's considered stale |
| `age_skew_threshold` | FLOAT | `2.0` | 0.5–10.0 | Max timestamp difference (seconds) between the three core values |
| `max_tws` | NUMBER | `60` | 20–60 | Max plausible TWS in knots (R6). Capped at 60 to match the bin grid ceiling — values above 60 kt would silently clamp to bin 60. Extending beyond 60 requires a bin grid schema change (post-MVP). Note: this is a validation/input threshold only; it does **not** set the export projection's TWS axis maximum, which is the fixed bin-grid ceiling of 60 (§6.B Boundary computation). |
| `max_stw` | NUMBER | `40` | 10–80 | Max plausible STW in knots (R7) |
| `low_wind_threshold` | FLOAT | `3.0` | 0.5–10.0 | TWS below this (knots) → rejected (R9) |
| `head_to_wind_threshold` | NUMBER | `10` | 5–30 | TWA abs below this (degrees) → rejected (R8) |
| `anchored_stw_threshold` | FLOAT | `0.3` | 0.1–1.0 | STW below this (knots) with TWS > 0 → rejected (R10) |
| `twa_roc_threshold` | FLOAT | `15.0` | 5.0–45.0 | Max TWA change (degrees/second) before maneuver detected (R11) |
| `tws_roc_threshold` | FLOAT | `10.0` | 3.0–30.0 | Max TWS change (knots/second) before spike detected (R12) |
| `stw_roc_threshold` | FLOAT | `2.0` | 0.5–10.0 | Max STW change (knots/second) before acceleration detected (R13) |
| `cooldown_seconds` | NUMBER | `30` | 5–120 | Seconds to reject after a maneuver detection (R14) |
| `stability_window_seconds` | NUMBER | `15` | 5–60 | Seconds of stable values required (R15) |
| `stability_twa_range` | FLOAT | `20.0` | 5.0–45.0 | Max TWA range (degrees) in stability window (R15) |
| `stability_tws_range` | FLOAT | `10.0` | 3.0–20.0 | Max TWS range (knots) in stability window (R15) |
| `stability_stw_range` | FLOAT | `4.0` | 1.0–10.0 | Max STW range (knots) in stability window (R15) |
| `engine_tws_ceil` | FLOAT | `5.0` | 2.0–15.0 | TWS below this + STW above floor → quarantine (R16) |
| `engine_stw_floor` | FLOAT | `3.0` | 1.0–10.0 | STW above this + TWS below ceil → quarantine (R16) |
| `min_samples_for_export` | NUMBER | `10` | 3–100 | High-confidence floor: minimum samples in a merged histogram for a cell to be included **when a high-confidence export is requested** (`GET /api/export?high_confidence=yes`). The **default** export and the polar preview instead use the fixed `MIN_SAMPLES_DISPLAY` (3), so this value only affects opt-in high-confidence exports (§6.B step 5). The range minimum equals `MIN_SAMPLES_DISPLAY` (3) on purpose: high-confidence must never be *looser* than the default display floor, so the high-confidence export is always a subset of the default export. (If `MIN_SAMPLES_DISPLAY` ever changes, update this lower bound to match.) |
| `debug_logging` | BOOLEAN | `false` | — | Enable verbose debug logging of each sample decision. When `true`, `plugin.py` emits one `logger.debug()` line per pipeline iteration with the decision and reason codes (gated in `plugin.py`, not in `AvNavLogger`; §7 Layer 1). Does not affect the rare non-per-sample debug diagnostics in `config.py`/`persistence.py`/`pipeline.py`. Satisfies HC #9. |

**Config hot-swap behavior:** When a user changes parameters via AvNav's settings UI, the `changeCallback` registered with `api.registerEditableParameters()` fires with a dict of changed values. The callback acquires the threading lock, parses and validates the new values via `config.py`, and replaces the config object (a single reference reassignment, atomic under the GIL). To make "changes take effect on the next sample cycle" exact and race-free, the sampling loop **snapshots `config = self.config` once at the top of each iteration** (an atomic reference read; no lock needed for the read) and passes that local reference to the reader, pipeline, and model-update for the whole iteration. A swap that lands mid-iteration therefore applies cleanly on the *next* iteration — never split across reads within one iteration.

Stateful validation objects (rolling window, cooldown timer, previous sample) are NOT reset on config change — they continue with existing state and new thresholds apply on the next evaluation. If `stability_window_seconds` increases, the stability rule naturally rejects until the buffer fills to the new length (the buffer is time-bounded, not fixed-size). If `stability_window_seconds` decreases, existing older entries are simply outside the new window and get ignored.

No special warm-up restart. No validation state reset. This is simple and predictable.

**Layer 12 — Per-Sample Commit (polarrecorder/commit.py)**

- Exposes one pure function: `commit_sample(pipeline_result: PipelineResult, sample: Sample | None, model: PolarModel) -> None`. It is the single, tested implementation of the §6.B `PolarModel` update contract — the decision→method dispatch:
  - `pipeline_result.decision == 'accepted'` → `model.update_accepted(sample)`.
  - `'rejected'` **and** `pipeline_result.is_sailing_candidate` (a quality-gate reject: R11–R14 or R15 `reject_unstable`) → `model.record_rejection(sample, pipeline_result.reason_codes)`.
  - `'quarantined'` (R16; always a candidate) → `model.record_quarantine(sample, reason_code)`.
  - `'rejected'` **and not** `is_sailing_candidate` (R1–R10 or `reject_warming_up`), **or** `sample is None` (R1/R2 rejection, no `Sample` built) → **no model touch** (§6.B candidacy-gate / warm-up exclusion).
- **Scope is deliberately model-only.** It does **not** update the global `Counters` (§6.C2 `total_seen`/`total_accepted`/…/`rejection_histogram`) and does **not** call `timeline.record`; those remain `plugin.py`'s per-iteration responsibility (they also fire on the pause/disabled path, where `commit_sample` is not called, so keeping them in `plugin.py` keeps them uniform across all paths). The per-bin counters that *are* model state (`bin.total_accepted`/`total_rejected`/`total_quarantined`, per-bin `rejection_histogram`, `generation`, `last_update_wall`) are updated by the `model.*` methods `commit_sample` invokes, exactly as §6.B specifies.
- **Pure, lock-unaware, clock-free.** It takes no lock (core principle #8 — `plugin.py` owns all locking and calls `commit_sample` *under* the lock as the model-write step, §7 Thread Safety) and no clock (`update_accepted` reads `sample.timestamp_wall` for `last_update_wall`). No AvNav dependency.
- **Dependencies:** imports `PolarModel` (`polar_model.py`), `PipelineResult` (`validation/pipeline.py`), and `Sample` (`sample.py`) — all from earlier phases, so `commit.py` is buildable in Phase 5. Nothing imports `commit.py` except `plugin.py` and tests, so it adds no cycle.
- **Reuse:** `plugin.py` (Phase 7) calls it under the lock on the normal path; the Phase 5 poisoning tests call it directly in their per-sample driver (`run() → observe() → commit_sample()`), so the suite validates the production dispatch rather than a hand-rolled copy.

### Python Import Path Strategy

AvNav's plugin loader (`pluginhandler.py:941–959`, `loadPluginFromDir`) loads `plugin.py` via `importlib.util.spec_from_file_location(name, moduleFile)` followed by `spec.loader.exec_module(module)`. **It does NOT add the plugin directory to `sys.path`.** (Verified against source — an earlier draft of this plan claimed otherwise; that claim was wrong.) Consequently `import polarrecorder.reader` from `plugin.py` will fail unless `plugin.py` puts its own directory on `sys.path` first. The path-insertion guard below is therefore **mandatory, not merely defensive** — it is the only thing that makes the `polarrecorder/` sub-package importable.

**Mandatory import-path guard:** `plugin.py` must fix its own import path at the top of the file, before any `import polarrecorder.*`:

```python
import os
import sys
_plugin_dir = os.path.dirname(os.path.abspath(__file__))
if _plugin_dir not in sys.path:
    sys.path.insert(0, _plugin_dir)
```

**Why a unique package name (not `src`):** All AvNav plugins are loaded into the *same* Python interpreter, and `plugin.py` registers its package in the shared, process-global `sys.modules`. A generic name like `src` would collide catastrophically with any other installed plugin that also ships a `src/` package — whichever loaded first would win, and the other plugin's `import src.*` would silently resolve to the wrong modules. The package is therefore named `polarrecorder` (a unique, project-specific identifier) so no such collision can occur regardless of what other plugins are installed. Do not rename it back to a generic name.

**Test requirement:** `test_plugin_integration.py` must include a test that imports `polarrecorder.reader`, `polarrecorder.sample`, etc. from a directory structure matching the plugin layout, confirming the import chain works.

### Dependency Direction

```
plugin.py → polarrecorder/reader → polarrecorder/sample, polarrecorder/units
plugin.py → polarrecorder/validation/pipeline → polarrecorder/validation/rules_*, polarrecorder/validation/state, polarrecorder/sample
plugin.py → polarrecorder/polar_model → polarrecorder/bins, polarrecorder/histogram
plugin.py → polarrecorder/persistence
plugin.py → polarrecorder/api_handlers → polarrecorder/export → polarrecorder/histogram
plugin.py → polarrecorder/persistence → polarrecorder/polar_model, polarrecorder/counters   (load() constructs/returns a PolarModel + Counters and serialize_to_dict walks the live PolarModel; polar_model and counters import neither persistence nor each other, so this forward dep adds no cycle)   (plugin.py calls serialize_to_dict under the lock for both the flush and the export/json body; api_handlers.export_json only wraps the finished dict, so there is NO api_handlers→persistence edge)
plugin.py → polarrecorder/export   (direct: preset save/delete/list mutations + named-format preset resolution for GET presets/polar/export, dispatched under the lock — §7 Thread Safety; api_handlers stays read-only)
plugin.py → polarrecorder/timeline
plugin.py → polarrecorder/counters
plugin.py → polarrecorder/commit → polarrecorder/polar_model, polarrecorder/validation/pipeline (PipelineResult), polarrecorder/sample   (per-sample model dispatch; no counters/timeline dep — global counters and timeline stay in plugin.py; nothing imports commit, so no cycle)
plugin.py → polarrecorder/config → polarrecorder/params   (config reads rangeOrList clamp bounds; params has no deps, no cycle)
plugin.py → polarrecorder/params   (reads EDITABLE_PARAMETERS for registerEditableParameters + initial getConfigValue reads)

No reverse dependencies. No circular imports.
polarrecorder/ modules never import plugin.py.
polarrecorder/ modules never import AvNav API classes.
polarrecorder/sample.py is a shared type definition module — imported by reader.py and validation/rules_core.py.
```

### Enforced Rules

- `plugin.py` is subject to the uniform 400-line limit (and should stay well under it as a thin shell).
- No business logic inside the request handler callback — delegate to `polarrecorder/api_handlers`.
- No drawing/rendering logic inside model code.
- No persistence logic inside validation code.
- No AvNav API calls inside any `polarrecorder/` module — the API is accessed only through `reader.py`'s interface, which receives the API as a constructor argument.
- All core logic testable with fake samples and a fake AvNav API stub.

### Thread Safety

**Concurrency model:** The `run()` loop executes in a dedicated plugin thread. API request handlers are called from AvNav's HTTP server thread(s). Both access shared state: `PolarModel`, counters, timeline, recording state (paused/active), config, and a set of plain-scalar status fields the sampling thread computes each iteration and the API thread only reads: `last_current_values` (updated every iteration that produced a **built `Sample`** — all three values present *and finite*, i.e. `build_sample` returned non-`None`; including while paused/disabled — so it can never hold a `NaN`/`Inf`, §6.B3/§6.G.4/§6.F; in addition to the display values `twa_deg`/`tws_kt`/`stw_kt` it retains the three **store monotonic timestamps** `twa_timestamp`/`tws_timestamp`/`stw_timestamp` from that read's `ReadResult`, which `format_status` needs to recompute each `*_age_s = now_monotonic − store_timestamp` and derive each `*_stale` at request time — §6.F, §7 Layer 7), `last_decision` (updated only on iterations that run the pipeline — not during pause/disabled, where the decision badge is hidden, §6.B3/§6.G.4), `warming_up` (a `bool` the sampling thread computes as `state.is_warming_up(now_monotonic)` each iteration — pre-`observe()`, with the same `now` R15 used; see §6.C "Ordering" step 3 and §7 Layer 4 — and stores), and `last_data_status` (the `'receiving'`/`'partial'`/`'no_data'` classification of the most recent store read — all three core values present, some present, or none — which the sampling thread computes from each `ReadResult` on **every** iteration, including pause/disabled, and which becomes the `data_status` field of `GET status` per §6.F). These scalars are initialized in `__init__` to safe defaults (`last_current_values = None`, `last_decision = None`, `warming_up = True`, `last_data_status = "no_data"`) so a `GET status` arriving before the first loop iteration completes returns a well-formed response. **`run_start_monotonic` is likewise initialized in `__init__` (to `self._clock()`) and then re-captured at the top of `run()`** — the request handler is registered in `__init__`, so a `GET status` arriving in the brief window between `__init__` returning and AvNav's thread entering `run()` must find `run_start_monotonic` already defined (it computes `uptime_seconds` from it, §6.F). Without the `__init__` initialization that early poll would reference an undefined attribute, get caught by the dispatcher's try/except, and surface as a spurious "Connection lost" in the viewer. **`ValidationState` itself is touched only by the sampling thread and is never accessed by API handlers or the HTTP thread.** This is deliberate: the validation pipeline mutates `ValidationState` (the `observe()` append, R11's cooldown) *outside* the lock (see Locking strategy below), so reading the live `ValidationState` — even under the lock — from the HTTP thread would race the unlocked write and tear the `deque`. Instead the sampling thread reduces everything the UI needs (`warming_up`, current input values, current decision) to plain scalars and writes them under the lock alongside the model update; `GET status` reads those scalars under the lock. The rolling buffer, cooldown timer, and previous sample are never shared.

**Locking strategy:** A single `threading.Lock` instance, owned by the `Plugin` class in `plugin.py`. Acquired briefly for:

1. **Model writes** (in the sampling loop): after validation, acquire lock → `commit.commit_sample(pipeline_result, sample, model)` (the §6.B model dispatch, Layer 12) + global-counter updates (§6.C2) + `timeline.record(...)` + status-scalar writes → release lock. The lock is NOT held during store reads, validation pipeline execution, `ValidationState.observe()`, or persistence writes.
2. **Model reads** (in API handlers): acquire lock → take a **deep, fully-detached snapshot** of every mutable structure the response needs → release lock → format response outside the lock. "Detached" is mandatory, not optional: the sampling thread mutates the live model **in place** under the same lock (`update_accepted` appends to a bin's `histogram` dict and increments counters — §6.B), so a *shallow* snapshot (e.g. handing the formatter the live `iter_bins()` `Bin` objects or the live `rejection_histogram` dict) would let the formatter iterate a dict the sampling thread mutates after the lock is released — an intermittent `RuntimeError: dictionary changed size during iteration` or a torn count. The detached snapshot is built with: `PolarModel.snapshot_bins()` (§6.B — fresh per-bin dicts with `dict(...)`-copied histograms; `polar`/`export`), fresh `dict(...)` copies of the global and per-bin rejection histograms (`rejections`), a counters copy plus a `top_rejections` list derived from a `rejection_histogram` copy (`status`), and `timeline.query()` (already returns plain dicts; `timeline`). Histogram and counter values are plain `int`s, so a one-level `dict(...)` copy per nested dict is a complete detach — no `copy.deepcopy` needed. The cost is a handful of small-dict copies per read, negligible at the 2 s / 10 s / 30 s poll intervals. The pure `format_*` functions then operate solely on these detached copies.
3. **State mutations** (pause/resume/reset): acquire lock → mutate state → release lock. `reset` additionally sets `_flush_requested = True` while holding the lock; it does **not** write to disk on the HTTP thread. The plugin thread performs the actual flush on its next iteration (§6.E single-writer rule), keeping all polar-file writes on one thread.

**Persistence writes** happen outside the lock: the sampling loop acquires the lock, serializes the model to a JSON string (fast, in-memory), releases the lock, then writes the string to disk (slow, I/O). This avoids holding the lock during disk I/O.

**No nested locks.** There is exactly one lock. No `polarrecorder/` module acquires any lock — locking is exclusively `plugin.py`'s responsibility. `polarrecorder/` modules are lock-unaware and thread-unaware.

**Preset I/O** (`presets.json` save/delete/list) is independent of the polar model and sampling loop — the sampling thread never touches `presets.json`. However, it is **not** safe to run lock-free. AvNav's HTTP server is `socketserver.ThreadingMixIn`-based (`httpserver.py:69`) and invokes the plugin request handler directly on a per-request worker thread (`pluginhandler.py:1084`), so requests are **not** serialized: two concurrent `presets/save` (or save + delete, or save + the `presets` read) can execute at the same time. Because the atomic write uses a fixed temp filename (`presets.tmp.json`, mirroring `polar.tmp.json`), concurrent writers would collide on that temp file and lost-update each other (both read the same prior `presets.json`, each writes its own change, one wins). The GIL does not prevent this — file I/O releases the GIL.

Therefore **preset mutations (`presets/save`, `presets/delete`) are serialized by the same single `threading.Lock`**: `plugin.py`'s dispatcher acquires the lock, calls the relevant `export.py` preset function (which performs the file read-modify-atomic-write), then releases the lock. This keeps `export.py` lock-unaware (core principle #8 — `plugin.py` owns all locking; `export.py` just receives a data-dir path) while making preset writes both collision-free and lost-update-free. Holding the lock across this disk I/O is an accepted, deliberate exception to "persistence writes happen outside the lock": that rule exists to keep the **hot path** — the periodic 5-minute polar flush in the sampling loop — off the lock; a preset write is a rare, explicit, user-triggered action, so briefly holding the lock for it has no practical impact on sampling. (The polar files remain governed by the separate single-writer rule of §6.E — only the plugin thread ever writes them. The lock here protects `presets.json` specifically, against concurrent HTTP worker threads.) The read-only `GET presets` endpoint, which loads `presets.json` from disk, also acquires the lock for its read so it never observes a write in progress. Likewise, the `GET polar` and `GET export` endpoints resolve a named `format` against `presets.json` (loading the preset's TWA/TWS grid); for consistency this resolution happens **under the lock as part of the read snapshot** — `plugin.py` loads/resolves the grid while holding the lock, releases the lock, then runs the (pure) bins projection on the snapshot outside the lock. (The atomic temp→rename write already guarantees any reader sees a complete old-or-new file, so this is for consistency with `GET presets` rather than a corruption fix.)

**Test requirement:** `test_plugin_integration.py` must include a test that simulates concurrent model update and API read to verify no data corruption — specifically, that a `snapshot_bins()` read taken while the sampling thread is appending to bins neither raises nor returns torn data, and that mutating the model after the snapshot leaves the snapshot unchanged (detachment) — and a test that simulates two concurrent preset mutations (e.g. two `presets/save` of different presets dispatched from separate threads through `_handle_request`) and asserts both presets survive in `presets.json` (no lost update, no corrupt temp file) — verifying the preset lock serialization above. **Phase placement:** the concurrent model-update/API-read test is added in **Phase 7** (the loop and model exist then); the concurrent-preset-mutation test is added in **Phase 8**, once `export.py` and the dispatcher's preset routing exist (in Phase 7 the preset endpoints route to a placeholder, so the preset test cannot yet pass). This keeps each phase's full-gate invariant satisfiable.

---

## 8. Development Infrastructure

### AI Agent Instructions

**AGENTS.md and CLAUDE.md** share a `SHARED_INSTRUCTIONS` block between `<!-- BEGIN SHARED_INSTRUCTIONS -->` and `<!-- END SHARED_INSTRUCTIONS -->` markers, kept in sync by `tools/sync-ai-instructions.mjs` (from dyninstruments). Validated by `tools/check-ai-instructions.mjs`.

**Required `SHARED_INSTRUCTIONS` sections (adapted from dyninstruments):**

**Section 0 — Mandatory Session Preflight (No Exceptions):** Before planning, coding, review, or documentation edits, always read: (1) `documentation/TABLEOFCONTENTS.md`, (2) `documentation/conventions/coding-standards.md`, (3) `documentation/conventions/smell-prevention.md`. Precedence on conflict: `core-principles.md` > `coding-standards.md` > `smell-prevention.md` > task-specific docs.

**Section 1 — Project Constraints (AvNav Plugin Environment):** Python 3.9+ stdlib-only runtime (no pip install on target Raspberry Pi). No bundler, no build step for runtime files. Plain JS served as static files by AvNav. `window.Polarrecorder` namespace for JS. Dev-only tooling: pytest, ruff, mypy, Node.js check scripts. `avnav_api` is referenced only by `plugin.py`, and only as a `TYPE_CHECKING`-guarded type import (never imported at runtime, since it is absent from the dev/CI environment); the AvNav API is otherwise reached purely through the duck-typed `api` object AvNav injects. No AvNav imports in `polarrecorder/`.

**Section 2 — Token-Efficient Documentation System:** Read `TABLEOFCONTENTS.md` first. Identify 1–3 relevant files for the task. Read only those. Never read all documentation files sequentially. Documentation structure mirrors dyninstruments format: every file has Status, Overview, Key Details, Related sections.

**Section 3 — Coding Standards Summary:** Python: **400-line file limit** (`plugin.py`, `polarrecorder/`, `tests/` — uniform with JS; `tools/` exempt), mandatory file headers (`"""Module: ...`), type annotations on all functions, google-style docstrings on all public functions, ruff formatting enforced, mypy strict, no `print()`, no bare `except` in `polarrecorder/`. JS: 400-line file limit, mandatory `/** Module: ... */` headers, `window.Polarrecorder` namespace, no ES module `import`/`export`, no `console.log`, no `var`, strict equality (`===`/`!==` only), no `eval()`/`innerHTML`.

**Section 4 — Smell Prevention Summary:** Reference `smell-prevention.md` for the full catalog. Key blocking smells for polarrecorder: AvNav imports in `polarrecorder/`, circular imports between `polarrecorder/` modules, one-liner compression to bypass file size limits, commented-out code blocks, redundant try/except in pure logic modules, hardcoded magic numbers (use named constants in `config.py` or `units.py`), `plugin.py` acquiring business logic.

**Section 5 — Quality Gate:** `tools/check-all.sh` must pass before any commit. Lists: ruff check, ruff format, mypy strict, pytest, coverage ≥ 90%, check-python-filesize.py, check-release.py, npm run check:all (JS + doc checks). Agent must run the gate after every implementation phase and fix all failures before proceeding.

**Section 6 — File Map:** Lists every directory and its purpose: `polarrecorder/` (domain logic, no AvNav dependency), `polarrecorder/validation/` (pipeline + rules), `tests/` (all tests), `tools/` (quality gate scripts), `documentation/` (modular docs), `exec-plans/` (active + completed plans), `releases/` (zip artifacts). Root files: `plugin.py` (thin AvNav shell), `viewer.html` + `viewer.css` + JS files (UI), `plugin.json`/`plugin.mjs`/`plugin.css`/`icon.svg` (AvNav metadata — `plugin.css` is intentionally empty).

**Section 7 — Exec-Plan Workflow:** Active plans in `exec-plans/active/`, completed in `exec-plans/completed/`. Sequential numbering `PLAN{N}.md`. Implementation follows the active plan unless amended by a subsequent plan. Agent must not skip phases or reorder deliverables.

**CLAUDE.md-only additions (outside shared block):** Claude-specific hints: tool usage patterns, preferred response format, context window management tips. These do not need to stay in sync with AGENTS.md.

### Core Principles (`documentation/core-principles.md`)

This is the highest-precedence document in the project. Numbered, non-negotiable rules derived from Section 9 Hard Constraints and Section 7 architecture decisions:

1. **Stdlib-only runtime.** No pip dependencies in `plugin.py` or `polarrecorder/`. Users install by dropping a directory — no `pip install`. (HC #19)
2. **AvNav boundary isolation.** `polarrecorder/` never imports AvNav modules. Only `plugin.py` touches the AvNav API. The API is injected via `reader.py`'s constructor. (HC #18)
3. **No build step.** All runtime files (`plugin.py`, `viewer.html`, JS, CSS) are served as-is by AvNav. (HC #7)
4. **Histogram, not average.** The polar model uses per-bin speed histograms with configurable percentile extraction, never a naïve mean. (HC #1)
5. **Honest uncertainty.** Empty bins are empty, not interpolated. Confidence is visible per bin. Undetectable threats are documented. (HC #14, #15)
6. **Never crash AvNav.** All exceptions caught at the `plugin.py` boundary. Corrupt files fall back gracefully (backup → empty model). (HC #11)
7. **Minimal disk writes.** In-memory model with configurable flush interval (default 5 min). No per-sample disk writes. (HC #8)
8. **Single lock, no nesting.** Threading is `plugin.py`'s responsibility. `polarrecorder/` modules are lock-unaware and thread-unaware. (Section 7, Thread Safety)
9. **Clock injection.** Every time-dependent module receives a clock callable (`ClockFn`). No hidden `time.monotonic()` calls in `polarrecorder/`. Enables fully deterministic tests. (Section 8, Testing Approach)
10. **Quality gate before commit.** `tools/check-all.sh` must pass. No exceptions, no "fix it later." (Section 8, Quality Gate Scripts)
11. **Documentation before code.** Every module has a documentation target. Doc stubs with Status/Overview/Key Details exist before implementation starts. (Phase 1 deliverables)
12. **File size limits are absolute.** A single **400 non-empty-line hard limit** applies to every Python and JS source file — `plugin.py`, all `polarrecorder/` modules, all `tests/`, and the viewer JS files — matching dyninstruments. `tools/` scripts and non-code files (Markdown, JSON, etc.) are exempt. Split the module, don't compress code. (Section 8, Python Rules / JS Tooling)

### Quality Gate Scripts

**Master gate (`tools/check-all.sh`):**

```bash
#!/bin/bash
set -euo pipefail
# Python checks
python -m ruff check .
python -m ruff format --check .
python -m mypy polarrecorder tests plugin.py --strict
python -m pytest tests/ --tb=short
python -m pytest tests/ --cov=polarrecorder --cov-report=term-missing --cov-fail-under=90
python tools/check-python-filesize.py
python tools/check-release.py --dry-run  # exits 0 if no zip in releases/; validates if present
# JS checks (dyninstruments-derived)
npm run check:all
echo "All checks passed."
```

**Individual commands:**

| Command | Purpose |
|---|---|
| `python -m ruff check .` | Lint Python code (all rule categories; `tools/` is excluded via `extend-exclude`) |
| `python -m ruff format --check .` | Check Python formatting |
| `python -m mypy polarrecorder tests plugin.py --strict` | Type checking |
| `python -m pytest tests/` | Run all tests |
| `python -m pytest tests/ --cov=polarrecorder --cov-report=term-missing --cov-fail-under=90` | Coverage enforcement |
| `python tools/check-python-filesize.py` | Python file size limits + header enforcement |
| `python tools/check-release.py --dry-run` | Release artifact validation (exits 0 if no zip in `releases/`; validates contents if one exists) |
| `npm run check:all` | All JS + doc checks (patterns, docs, filesize, headers, namespace, naming, deps) |

Documentation checks are handled entirely by the dyninstruments-derived JS tools via `npm run check:docs`, which runs `check-docs.mjs` (TABLEOFCONTENTS ↔ filesystem sync, orphan detection), `check-doc-format.mjs` (Status/Overview/Key Details structure), `check-doc-reachability.mjs` (internal cross-reference resolution), and `check-ai-instructions.mjs` (AGENTS.md/CLAUDE.md shared block sync).

**The final gate (`check-all.sh`) always runs both Python and JS checks.**

### Python Tooling (pyproject.toml)

```toml
[project]
name = "polarrecorder"
version = "1.0.0"
requires-python = ">=3.9"

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
# Put the repo root on sys.path so `import polarrecorder` / `import plugin` resolve from
# tests regardless of invocation. `python -m pytest` already does this via the -m flag, but
# this makes bare `pytest` work too (the layout has conftest.py under tests/, not at root).
pythonpath = ["."]

[tool.ruff]
target-version = "py39"
line-length = 100
# tools/ is dev-only CLI tooling (print()-based output, http.server, etc.) and is exempt
# from ruff, consistent with its existing exemption from mypy, the file-size limit, and
# header checks. extend-exclude (not per-file-ignores) so `ruff format --check` skips it too.
extend-exclude = ["tools"]

[tool.ruff.lint]
select = [
  "E", "F", "W", "I", "N", "UP", "B", "A", "SIM", "TCH", "RUF",
  "C90", "D", "PT", "ARG", "ERA", "S", "PIE", "RSE", "RET", "FBT", "PL",
  "T20", "TID", "FA",
]
# E=pycodestyle, F=pyflakes, W=warnings, I=isort, N=naming,
# UP=pyupgrade, B=bugbear, A=builtins, SIM=simplify, TCH=type-checking, RUF=ruff-specific,
# C90=mccabe complexity, D=pydocstyle docstrings, PT=pytest-style, ARG=unused-arguments,
# ERA=commented-out code, S=bandit security, PIE=unnecessary-pass/reimplemented-builtins,
# RSE=raise-without-message, RET=return-consistency, FBT=boolean-trap, PL=pylint-subset,
# T20=flake8-print (no print() calls), TID=flake8-tidy-imports (banned imports),
# FA=flake8-future-annotations (enforces `from __future__ import annotations` in every file)
ignore = [
  "D100",   # missing module docstring (covered by file headers)
  "D104",   # missing __init__.py docstring
  "D203",   # conflicts with D211 (no-blank-line-before-class vs one-blank-line-before-class)
  "D213",   # conflicts with D212 (multi-line-summary-second-line vs first-line)
  "S101",   # assert in non-test code (used for internal invariants)
  "FBT001", # boolean positional arg in function def (too strict for dataclass fields)
  "FBT002", # boolean default value in function def (same reason)
]

[tool.ruff.lint.mccabe]
max-complexity = 10

[tool.ruff.lint.pylint]
max-args = 6
max-branches = 10
max-returns = 4
max-statements = 40

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.lint.flake8-tidy-imports]
# Ban AvNav imports in polarrecorder/ — AvNav API is injected via reader.py's StoreAPI protocol
[tool.ruff.lint.flake8-tidy-imports.banned-api]
"avnav_api".msg = "AvNav imports are not allowed in polarrecorder/. Use dependency injection via StoreAPI."
"pluginhandler".msg = "AvNav imports are not allowed in polarrecorder/. Use dependency injection via StoreAPI."
"avnav_store".msg = "AvNav imports are not allowed in polarrecorder/. Use dependency injection via StoreAPI."
"avnav_nmea".msg = "AvNav imports are not allowed in polarrecorder/. Use dependency injection via StoreAPI."

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = [
  "D",       # docstrings not required on test functions
  "S101",    # assert is the whole point of tests
  "PLR2004", # magic values in test assertions are fine
  "ARG001",  # unused function arguments (pytest fixtures appear unused)
  "ARG002",  # unused method arguments (same reason)
  "N802",    # FakeAvNavAPI mirrors AvNav method names (getSingleValue, setStatus, ...)
  "N803",    # FakeAvNavAPI mirrors AvNav arg names (includeInfo, iconFile, ...)
]
"polarrecorder/__init__.py" = ["D104"]  # __init__.py needs no docstring
"plugin.py" = ["D100", "TID251", "E402", "N802"]  # module docstring covered by file header; AvNav imports are legitimate here; E402 for the mandatory sys.path import guard (imports follow the path-insertion); N802 for the AvNav-mandated classmethod name pluginInfo

[tool.mypy]
python_version = "3.9"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

# `avnav_api` lives in the AvNav server source tree, not on the dev/CI sys.path. plugin.py
# imports `AVNApi` only under `if TYPE_CHECKING:` (never at runtime — see Layer 1 / Python
# Rules), so this override lets `mypy --strict` resolve that type-checking-only import without
# AvNav installed. `AVNApi` is then treated as `Any` at the boundary, which is acceptable.
[[tool.mypy.overrides]]
module = ["avnav_api"]
ignore_missing_imports = true

[tool.coverage.run]
source = ["polarrecorder"]
# Coverage is gated on polarrecorder/ only. plugin.py is the AvNav integration boundary and is
# exercised by test_plugin_integration.py but NOT included in the 90% gate; its ~70%
# figure in "Coverage Targets" is an informational guideline, not an enforced threshold
# (it cannot be unit-tested fully without a real AvNav server).

[tool.coverage.report]
fail_under = 90
show_missing = true
# Lines that never execute at runtime by design — excluded so they don't count as "missing".
# Covers the TYPE_CHECKING import blocks (export.py) and the Protocol method stub bodies
# (reader.py StoreAPI, logger.py Logger). NOTE: rules_enhanced.py is NOT covered by these
# excludes — per Phase 4 it ships with no `...`/NotImplementedError bodies at all and reaches
# full line coverage via the smoke `import` in test_validation_heuristic.py.
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
    "@(abc\\.)?abstractmethod",
    "@(typing\\.)?overload",
    "^\\s*\\.\\.\\.\\s*$",
    "if __name__ == .__main__.:",
]
```

### Python Rules

- No unchecked broad `except` blocks except at the AvNav boundary in `plugin.py` (with logging).
- All `except` blocks in `polarrecorder/` must catch specific exceptions.
- Every function in `polarrecorder/` must have type annotations.
- **Python 3.9 annotation syntax:** Every Python file in `polarrecorder/` and `plugin.py` must include `from __future__ import annotations` as the first import (after the module docstring). This enables PEP 604 union syntax (`float | None`) on Python 3.9. The pseudocode in this plan uses `float | None` for readability; the `__future__` import makes it valid at runtime. Without it, Python 3.9 raises `TypeError` on `float | None` type expressions.
- Every public function must have a docstring.
- Ruff strict formatting enforced.
- No `print()` calls — use the logging interface.
- **File size limit: 400 non-empty lines** per Python file, applied uniformly to `plugin.py`, `polarrecorder/`, and `tests/` (matching the JS limit; `tools/` scripts are exempt). Enforced by `tools/check-python-filesize.py`. If a module approaches 400 lines, split it before continuing — do not wait for a cleanup phase. One-liner compression (collapsing multiline code to stay under the limit) is prohibited.
- **Mandatory file headers** for all Python files in `polarrecorder/`:
  ```python
  """Module: <Name> - <One-line description>.

  Documentation: documentation/<path>.md
  Depends: <list of polarrecorder/ module dependencies>
  """
  ```
  Enforced by `tools/check-python-filesize.py` (checks first non-empty line starts with `"""`).

`tools/check-python-filesize.py` is added to `check-all.sh` and checks:
1. Non-empty line count for every `.py` file in `polarrecorder/`, `tests/`, and `plugin.py`.
2. Files exceeding their limit cause exit code 1 with a clear error message.
3. File header presence for `polarrecorder/**/*.py` (excluding `__init__.py`).

**Logging interface:** `polarrecorder/` modules that need to log receive a logger object implementing a simple protocol. The `Logger` `Protocol` is defined in `polarrecorder/logger.py`, which is created in **Phase 3** (protocol only) so that consumers in Phases 3–6 can annotate against it; the `AvNavLogger` adapter is added to the same file in Phase 7:

```python
class Logger(Protocol):
    def info(self, msg: str) -> None: ...
    def warn(self, msg: str) -> None: ...
    def debug(self, msg: str) -> None: ...
    def error(self, msg: str) -> None: ...
```

`plugin.py` creates a concrete implementation that delegates to `api.log()` (for info and warn), `api.debug()`, `api.error()`. AvNav has no separate warn level, so warn maps to `api.log()` with a `[WARN]` prefix. For tests, `conftest.py` provides a `FakeLogger` that collects messages into a list for assertion.

Modules that don't need logging (pure functions like `units.py`, `bins.py`, `histogram.py`) receive no logger. Modules that need logging (`config.py` parse function, `persistence.py`, `pipeline.py`, `reader.py`) accept an optional `logger` parameter in their constructors or top-level functions.

### JS Tooling (derived from dyninstruments)

JS quality enforcement reuses dyninstruments tooling scripts (`tools/*.mjs`), classified by adaptation level. All tools are Node.js scripts run via `npm run` commands — no ESLint or external linter dependency.

**Copy as-is (path/config changes only):**

| dyninstruments tool | Adaptation |
|---|---|
| `check-file-size.mjs` | 400-line hard limit per JS file + oneliner compression detection. Change scanned paths to all `*.js` files in the project root (i.e. `viewer.js`, `polar-chart.js`, `timeline-chart.js`, `export-ui.js`, and any future split files such as `grid-editor.js`). Explicitly excludes `plugin.mjs`. |
| `check-doc-format.mjs` | Status/Overview/Key Details structure check on all `documentation/**/*.md`. Works unchanged. |
| `check-doc-reachability.mjs` | Internal Markdown link resolution. Works unchanged. |
| `check-docs.mjs` | TABLEOFCONTENTS ↔ filesystem sync. Works unchanged. |
| `check-ai-instructions.mjs` | AGENTS.md/CLAUDE.md shared block sync validation. Works unchanged. |
| `sync-ai-instructions.mjs` | Shared block sync tool. Works unchanged. |
| `check-headers.mjs` | Change expected header to `/** Module: ... \n * Documentation: ... \n * Depends: ... */`. Scan polarrecorder JS files. |

**Adapt (keep scanning framework, replace rules):**

| dyninstruments tool | polarrecorder adaptation |
|---|---|
| `check-namespace.mjs` → `check-namespace.mjs` | Checks that every scanned JS file (all root `*.js`, excluding `plugin.mjs`): (1) contains `window.Polarrecorder` at least once (namespace is used), and (2) does not assign any identifier directly to `window.<name>` other than `window.Polarrecorder` (no other global pollution). Exit code 1 with filename and line number on any violation. |

**Build standalone — purpose-built scripts with NO dyninstruments dependency:**

The three tools below are **NOT copied or adapted from dyninstruments.** Inspection of the dyninstruments sources shows they are coupled to dyninstruments' component-registry architecture (`check-naming.mjs` and `check-dependencies.mjs` both `import` from `tools/components-registry-loader.mjs` and use a `SENTINEL_BASE`/cluster-widget registry; `check-patterns.mjs` is not a single file — it imports from a `tools/check-patterns/` subdirectory of rule/shared modules). polarrecorder has no component registry (just four flat, namespaced JS files with a fixed load order), so importing that machinery would either fail at runtime or require porting the whole registry. Each is therefore written from scratch as a small, self-contained Node.js script using only built-ins (`fs`, `path`, `readline`), with no imports from any other `tools/` module.

| polarrecorder tool | Specification |
|---|---|
| `check-patterns.mjs` | Standalone regex scanner; no `check-patterns/` subtree. **Scans both JS and Python files** with separate rule sets. **JS rules** (scans all `*.js` files in the project root — explicitly NOT `plugin.mjs`, which is a legitimate ES module): no `console.log` (only `console.warn`/`console.error`), no `var` declarations, no `eval()`/`innerHTML` assignment, no `==`/`!=` (only `===`/`!==`), no ES module `import`/`export`, no commented-out code blocks (≥3 consecutive lines containing `=`, `{`, `(`, `function`, or `return`). **Python rules** (scans `polarrecorder/**/*.py`): no `import avnav` / `from avnav` / `import pluginhandler`, no `from plugin import` / `import plugin`, no `threading.Lock` / `threading.RLock` / `threading.Condition` acquisition, no `time.sleep()` calls in `polarrecorder/`. All violations are blocking (exit code 1). |
| `check-naming.mjs` | polarrecorder conventions only, no registry: JS file names are kebab-case, exported namespace members are PascalCase, functions are camelCase. Scans all `*.js` files in the project root (excluding `plugin.mjs`). |
| `check-dependencies.mjs` | polarrecorder rules only, no registry: no circular references among the viewer JS files (build a load-order/reference graph from `Polarrecorder.*` member usage and `<script>` order), and `viewer.js` must not reference members defined by `polar-chart.js` / `timeline-chart.js` / `export-ui.js` / `grid-editor.js` (if present) at module-load time (only at/after `DOMContentLoaded` wiring). Scans all `*.js` files in the project root (excluding `plugin.mjs`). |

These three run on the empty/minimal Phase 1 repo without error (no registry to load), so the Phase 1 exit condition "`npm run check:all` passes" is achievable. `tools/components-registry-loader.mjs` and the `tools/check-patterns/` subtree are **not** copied into polarrecorder.

**Drop (not applicable to polarrecorder):**

| dyninstruments tool | Reason |
|---|---|
| `check-smell-contracts.mjs` | All contracts are dyninstruments-specific (theme-cache, formatter-boundary, placeholder, state-screen). Not worth adapting for 4 JS files; `check-patterns.mjs` covers polarrecorder needs. |
| `check-coverage.mjs` | JS coverage not required for MVP. Python coverage handles domain logic. |
| `perf-run.mjs` / `perf-check.mjs` | No JS performance benchmarks needed. |

**`package.json` scripts:**

```json
{
  "scripts": {
    "ai:sync:agents": "node tools/sync-ai-instructions.mjs --from=agents",
    "ai:sync:claude": "node tools/sync-ai-instructions.mjs --from=claude",
    "ai:check": "node tools/check-ai-instructions.mjs",
    "check:docs": "node tools/check-docs.mjs && node tools/check-doc-format.mjs && node tools/check-doc-reachability.mjs && npm run ai:check",
    "check:filesize": "node tools/check-file-size.mjs --oneliner=block",
    "check:headers": "node tools/check-headers.mjs",
    "check:namespace": "node tools/check-namespace.mjs",
    "check:naming": "node tools/check-naming.mjs",
    "check:patterns": "node tools/check-patterns.mjs",
    "check:deps": "node tools/check-dependencies.mjs",
    "check:core": "npm run check:patterns && npm run check:docs && npm run check:filesize && npm run check:headers && npm run check:namespace && npm run check:naming && npm run check:deps",
    "check:all": "npm run check:core",
    "hooks:install": "node tools/install-hooks.mjs"
  },
  "devDependencies": {}
}
```

No npm dependencies required — all check scripts use only Node.js built-ins (`fs`, `path`, `readline`).

### Git Hooks

**Pre-push hook** — `tools/install-hooks.mjs` (copied from dyninstruments) creates `.githooks/pre-push` which runs `tools/check-all.sh`. Push is blocked if any check fails. Setup:

1. `npm run hooks:install` — creates `.githooks/pre-push`, sets `git config core.hooksPath .githooks`.
2. The hook file is committed to the repo (`.githooks/` directory). `install-hooks.mjs` only needs to run once per clone to set the git config.
3. Phase 1 deliverables include running `npm run hooks:install` as part of repo setup.

The hook runs the full gate (Python + JS checks). There is no pre-commit hook — the gate runs on push only to avoid slowing down local iteration.

**`viewer.html` and all JS files are plain files served statically by AvNav.** No build step. No bundler. No ES module `import`/`export` in served files.

### Smell Prevention Catalog (for `documentation/conventions/smell-prevention.md`)

The smell catalog follows the dyninstruments format: tabular, with columns Smell Class, Anti-Pattern, Required Pattern, Enforcement, Severity (block/warn). The following smells are specific to polarrecorder:

**Python smells (enforced by ruff, mypy, `check-python-filesize.py`, and code review):**

| Smell Class | Anti-Pattern | Required Pattern | Enforcement | Severity |
|---|---|---|---|---|
| AvNav import leak | `polarrecorder/` module imports `avnav_api`, `pluginhandler`, or any AvNav module | `polarrecorder/` receives AvNav API only via dependency injection in `reader.py` | ruff banned-import rule (`[tool.ruff.lint.flake8-tidy-imports]`) + `check-patterns.mjs` | block |
| Reverse dependency | `polarrecorder/` module imports `plugin` (the AvNav shell) | `polarrecorder/` modules never import `plugin.py`; dependency flows inward only | ruff banned-import rule + code review | block |
| Lock acquisition in polarrecorder/ | Any `polarrecorder/` module acquires `threading.Lock` | All locking is exclusively `plugin.py`'s responsibility; `polarrecorder/` modules are lock-unaware | grep-based check in `check-patterns.mjs` | block |
| Bare except in domain logic | `except:` or `except Exception:` in `polarrecorder/` without re-raise | Catch specific exceptions; broad `except` allowed only in `plugin.py` boundary | ruff `B001`/`B036` + code review | block |
| Print statement | `print()` in any `polarrecorder/` or `plugin.py` file | Use logger protocol (`logger.info/warn/debug/error`) | ruff `T201` | block |
| Magic number | Hardcoded numeric threshold in validation rules or model logic | Use named constants from `config.py` defaults or `units.py` | code review | block |
| File size bypass | One-liner compression to stay under the 400-line limit | Keep multiline formatting; split module if approaching limit | `check-python-filesize.py` | block |
| Commented-out code | ≥3 consecutive commented lines containing code patterns | Delete dead code; use version control for history | ruff `ERA001` | block |
| Missing type annotation | Function in `polarrecorder/` without full parameter and return type hints | All functions fully annotated | mypy `--strict` | block |
| Circular import | Two `polarrecorder/` modules importing each other | Restructure to eliminate cycle; follow dependency direction diagram | manual check + import-time test in `test_plugin_integration.py` | block |
| God function | Function with cyclomatic complexity > 10 | Split into smaller functions | ruff `C901` | block |
| Unused parameter | Function parameter never referenced in body | Remove parameter or prefix with `_` if required by interface | ruff `ARG` | block |

**JS smells (enforced by `check-patterns.mjs`, `check-namespace.mjs`, `check-file-size.mjs`):**

| Smell Class | Anti-Pattern | Required Pattern | Enforcement | Severity |
|---|---|---|---|---|
| Global scope pollution | Variables/functions defined outside `window.Polarrecorder` namespace | All code in namespace or local scope | `check-namespace.mjs` | block |
| ES module syntax | `import`/`export` in served JS files | Plain `<script>` loading, namespace registration | `check-patterns.mjs` | block |
| Debug leftover | `console.log()` in served JS files | Remove or use `console.warn`/`console.error` only | `check-patterns.mjs` | block |
| Var declaration | `var` keyword | `let` or `const` only | `check-patterns.mjs` | block |
| Loose equality | `==` or `!=` | `===` or `!==` only | `check-patterns.mjs` | block |
| Unsafe DOM mutation | `innerHTML` assignment or `eval()` | DOM API (`createElement`, `textContent`) or template literals with `insertAdjacentHTML` after sanitization | `check-patterns.mjs` | block |
| Commented-out code | ≥3 consecutive `//` lines containing code patterns | Delete dead code | `check-patterns.mjs` | block |
| File size bypass | One-liner compression to stay under 400-line limit | Keep multiline formatting; split module if approaching limit | `check-file-size.mjs` (oneliner detection) | block |

### Coverage Targets

| Area | Target | Rationale |
|---|---|---|
| `polarrecorder/validation/` | ≥ 95% branch | Core safety logic |
| `polarrecorder/histogram.py` | ≥ 95% branch | Percentile correctness |
| `polarrecorder/polar_model.py` | ≥ 90% branch | Model update/query |
| `polarrecorder/persistence.py` | ≥ 90% branch | Corruption recovery paths |
| `polarrecorder/` overall | ≥ 90% line | Quality floor |
| `plugin.py` | ~70% line (guideline, not gated) | Integration boundary, hard to unit-test fully; excluded from the coverage gate (source = polarrecorder only) |

**Enforcement of these sub-targets:** `tools/check-all.sh` machine-enforces only the **single global floor** `--cov-fail-under=90` over `polarrecorder/`. The per-area figures above (validation ≥ 95%, histogram ≥ 95%, etc.) and the matching per-phase exit conditions are **verified by the implementer/reviewer from the `--cov-report=term-missing` per-file output at the end of each phase** — they are review gates, not automated thresholds (the same status as `plugin.py`'s 70%). If automated enforcement is later desired, it is a small addition (e.g. a `coverage report --include=...` invocation per module, or a `pytest --cov` run scoped to the module with its own `--cov-fail-under`); MVP relies on the per-phase review check.

### Testing Approach

- **Unit tests** for every module in `polarrecorder/`. Pure functions tested with deterministic inputs.
- **Clock injection** — Every module that calls `time.monotonic()` or `time.time()` receives a clock callable via constructor parameter instead of calling the stdlib directly. Type: `ClockFn = Callable[[], float]`, default `time.monotonic`. Type alias defined in `polarrecorder/sample.py` (shared type definitions module). Affected modules: `reader.py` (read-time monotonic stamp on `ReadResult`). (Flush-interval tracking lives in `plugin.py`'s loop — `last_flush_monotonic`, §6.B2 — not in `polarrecorder/`; `persistence.py` therefore receives no monotonic clock — see §6.E and Layer 6.) `validation/state.py` and `timeline.py` are **deliberately excluded** from the *monotonic* clock: `state.py` takes no clock at all and derives all time reasoning from the `timestamp_monotonic` field of the `Sample` passed in (see §7 Layer 4); `timeline.py` uses only the **wall** clock (its 1-minute bucket boundaries and query window are wall-clock based — see §7 Layer 9 and the wall-clock injection bullet below). This gives a single time source per iteration. `plugin.py` creates the clock and passes it to all modules that need one. Tests use `FakeClock`:
  ```python
  # tests/conftest.py
  class FakeClock:
      def __init__(self, start: float = 1000.0) -> None:
          self.time = start
      def __call__(self) -> float:
          return self.time
      def advance(self, seconds: float) -> None:
          self.time += seconds
  ```
  This eliminates all `time.sleep()` and real-clock dependencies from tests. No monkey-patching.
- **Wall clock injection** — Modules that use `time.time()` (`reader.py` for `ReadResult.timestamp_wall`, `timeline.py` for its 1-minute bucket boundaries and query window) receive a separate `WallClockFn = Callable[[], float]` parameter, default `time.time`. (`persistence.py` does **not** stamp `last_flush_wall`/`created_wall` itself — `plugin.py` supplies both via the `metadata` argument, §6.E — so it receives no wall clock either.) Type alias defined in `polarrecorder/sample.py` alongside `ClockFn`. `FakeClock` can serve both roles in tests.
- **Fake AvNav API** (`tests/conftest.py`) — a simple object implementing `getSingleValue`, `getExpiryPeriod`, `fetchFromQueue`, `shouldStopMainThread`, `getConfigValue`, `setStatus`, `log`, `error`, `debug`, `registerEditableParameters`, `registerRequestHandler`, `registerRestart`, `saveConfigValues`. It deliberately does **not** expose a `fileName` attribute — the real plugin never reads `api.fileName` (it is hidden by `PluginApiProxy`; §3.18), so the fake must not let a test accidentally depend on it. Persistence tests exercise `persistence.py`/`export.py` directly with a `tmp_path` (Layer 6 takes a file-system path, not an AvNav API). The integration test overrides the plugin's data directory by setting `plugin._data_dir` after construction — the same post-construction injection pattern used for `plugin._clock`/`plugin._wall_clock` (§6.B2) — so the loop writes `polar.json`/`presets.json` into a `tmp_path` rather than the real `<_plugin_dir>/data/`. Allows testing the reader and plugin loop without a real AvNav server.
  - `getSingleValue(key, includeInfo=False)`: when `includeInfo=True`, returns a fake `DataEntry` object (a simple class or `types.SimpleNamespace`) with `.value` (float) and `.timestamp` (float, set by test code using `FakeClock`). Returns `None` when simulating expired/missing values. The fake API stores a dict of `{key: (value, timestamp)}` that test code populates before each test.
  - `fetchFromQueue(seq, number, waitTime)`: returns `(seq + 1, [])` immediately (no blocking) to simulate NMEA queue wake-up without real NMEA data. **In `test_plugin_integration.py` the fake `fetchFromQueue` additionally advances the injected `FakeClock`(s) by `sample_interval` on each call**, so the sampling loop clears its monotonic gate once per iteration and produces exactly one sample per iteration (combined with `shouldStopMainThread` returning `True` after N iterations → N deterministic samples, no real sleeping; see §6.B2).
- **Scenario tests** (`test_poisoning_scenarios.py`) — feed specific sample sequences through the full pipeline + model and assert the learned polar is not poisoned.
- **Property-based tests** where useful (e.g., histogram percentile is monotonically non-decreasing with increasing percentile parameter).
- **Persistence round-trip tests** — serialize → deserialize → assert equality. Corrupt file tests. Migration tests.
- **Integration tests** — fake AvNav API → reader → pipeline → model → API response. End-to-end without real AvNav.

---

## 9. Hard Constraints

1. Do not implement a naïve average polar. Use histogram + configurable percentile.
2. Do not let undetected slow/bad samples quickly degrade the learned polar. The percentile approach inherently resists this.
3. Do not require RPM, depth, heel, SOG, COG, heading, or any enhanced signal for MVP. Use them when available to improve detection (post-MVP).
4. Do not pretend engine/wave/reefing/current/shallow-water/bad-trim detection is solved with TWA/TWS/STW alone. Document limitations honestly.
5. Do not put core logic in `plugin.py`. It is a thin integration shell only.
6. Do not use network or cloud services. All data stays local.
7. Do not require a build step for runtime AvNav files (`plugin.py`, `plugin.mjs`, `viewer.html`, `viewer.js`, `viewer.css`, `plugin.css`). Dev tooling (pytest, ruff, mypy) is dev-only.
8. Do not write to disk on every sample. In-memory model with configurable flush interval (default 5 minutes).
9. Do not log every rejected sample individually at info/error level. Aggregate rejection counters. Debug-level logging only when enabled.
10. Do not block the AvNav plugin thread for long operations. Persistence writes and API responses must be fast.
11. Do not crash AvNav on corrupt persistence files. Fall back to backup, then empty model, with logging.
12. Do not modify AvNav source code.
13. Do not copy dyninstruments infrastructure blindly. Adapt patterns for a Python-first server-side plugin with a lightweight JS viewer.
14. Do not hide uncertainty from users. Show confidence per bin. Show rejection reasons. Show when data is sparse.
15. Do not make the polar look more reliable than the data supports. Empty bins are empty, not interpolated.
16. Do not store the `data/` directory in the release zip.
17. Do not use `time.time()` for freshness comparisons. Use `time.monotonic()` to match AvNav store timestamps.
18. Do not import AvNav modules in any `polarrecorder/` file. The AvNav API is accessed only through the reader's injected interface.
19. Do not use any Python package outside the standard library in runtime code (`plugin.py`, `polarrecorder/`). Users install the plugin by dropping a zip into a directory — there is no `pip install` step on a Raspberry Pi. Dev-only tools (`pytest`, `ruff`, `mypy`) are acceptable as dev dependencies. The Python stdlib provides everything needed: `json`, `os`, `time`, `threading`, `math`, `dataclasses`, `typing`, `collections`, `io`, `tempfile`.

---

## 10. Implementation Order

**Per-phase completeness invariant (applies to every product/repo phase — Phase 1 onward).** Each phase must leave the repository in a fully green, self-consistent state — every documentation file and test that *exists* at the end of a phase is **structurally complete and current**, never broken or orphaned. "Structurally complete" means it passes the gate, **not** that its prose is final: a documentation file is structurally complete when it has the required sections (Status/Overview/Key Details/Related), is listed in `TABLEOFCONTENTS.md`, and has no dangling internal links. A file's *content* may legitimately be expanded across phases **when, and only when, §12 (Related Documents) records a stub→complete lifecycle for it** (e.g. `README.md` Phase 1 stub → Phase 10 complete; `QUALITY.md` Phase 1 → Phase 11; `api.md` Phase 2 shape → Phase 8; `configuration.md` Phase 2 → Phase 7). Such a stub is a valid, gate-green end-of-phase state; it is not a deferred-and-broken doc. Every other documentation file (and every test) is written in full in the phase that introduces it. Concretely, in addition to each phase's own listed exit conditions, **every phase must end with `tools/check-all.sh` exiting 0** (the full gate: `ruff check`/`ruff format --check`, `mypy --strict`, the **entire** `pytest` suite, the `--cov-fail-under=90` coverage run over `polarrecorder/`, `check-python-filesize.py`, `check-release.py --dry-run`, and `npm run check:all` including `check:docs`). This means: (a) every documentation file the phase creates or advances is structurally complete (the four sections present), added to `TABLEOFCONTENTS.md`, and free of dangling internal links — so `check:docs`/`check:doc-format` stay green — with full prose either written now or scheduled per the §12 lifecycle above; and (b) every module the phase introduces ships with its tests in the same phase, the full suite passes, and aggregate `polarrecorder/` coverage remains ≥ 90% (with the per-area floors in §8). The per-phase exit conditions listed below call out phase-specific checks; they do not relax this invariant. (The JS checks run from Phase 1 onward against zero or few `*.js` files and pass trivially until the viewer is built in Phase 9 — see §8 JS Tooling.) **Phase 0 and Phase 1 are the human-authored bootstrap exceptions to the *agent-driven* verification model.** Phase 0 runs before any gate exists, so it is verified by inspection only. Phase 1 *creates* `tools/check-all.sh` (and the `AGENTS.md`/`CLAUDE.md` rulebook the agents obey), so having the agents build and then self-verify it would be circular and unsafe; instead Phase 1 is **authored by a human and verified by (i) human inspection of the foundation — confirming the gate scripts actually enforce what they claim, the AI instructions are correct, and the fakes/stubs are sound — and (ii) the first green `tools/check-all.sh` run**, not by the two-Pro-verifier loop. The green/structural-completeness invariant above still applies to Phase 1 (it must hand off a fully green repo). The **agent-driven machinery — the `plan-controller`/worker loop, the two-Pro-verifier requirement, the iteration bound, and the evidence-grounded-PASS rule grounded in `check-all.sh` — begins at Phase 2**, which is the first phase the controller implements. After completing the foundation the human records Phase 0 and Phase 1 as `done` in `<PLAN>.progress.md` (note: "human bootstrap, inspection-verified"), so the controller's first incomplete phase is Phase 2.

### Phase 0 — Retired Local Agent Bootstrap

**Intent:** This bootstrap slot is intentionally empty in the current repository. It preserves the phase numbering already recorded in `exec-plans/active/PLAN1.progress.md` while making clear that no project-local agent runtime, command files, or model-provider configuration are required or kept.

**Dependencies:** None. (Phase 0 is the first phase; Phase 1 depends on it.)

**Deliverables:** None.

**Constraints:**

- Phase 0 must not implement polarrecorder product functionality, repository skeleton, source, tests, documentation, or quality tooling.
- Phase 0 must not add project-local agent runtime/configuration files.
- Phase 0 must not commit API keys, model-provider secrets, or generated dependency trees.

**Exit conditions:**

- No Phase 0 runtime/configuration artifacts are present.
- No product source code has been implemented in Phase 0; no secrets or API keys are present anywhere in the repository.

**Verification requirements:** Phase 0 is verified by inspection only: confirm the repository contains no Phase 0 runtime/configuration artifacts and no secrets.

---

### Phase 1 — Repository Bootstrap and AI Instructions

**Intent:** Create the project skeleton with strict infrastructure before any domain code. **This is a human-authored, inspection-verified foundation phase — not agent-driven** (see §1 and the §10 per-phase completeness invariant). Phase 1 produces the `AGENTS.md`/`CLAUDE.md` rulebook and the `tools/check-all.sh` gate that the agents and both Pro verifiers are bound by; the human authors and verifies it so the agents never build or self-verify their own constitution. The agent-driven loop begins at Phase 2.

**Dependencies:** Phase 0 (also human-authored).

**Deliverables:**

- Top-level files at the repository root (the `polarrecorder/` root already exists — it holds `exec-plans/active/PLAN1.md` and `misc/`; this phase **adds** the files, it does not create the root): `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md`, `pyproject.toml`, `package.json`, `.gitignore`.
- `.gitignore` entries: `data/`, `releases/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.mypy_cache/`, `node_modules/`, `.coverage`, `htmlcov/`, `*.egg-info/`, `.ruff_cache/`.
- `documentation/` skeleton: `TABLEOFCONTENTS.md`, `core-principles.md`, `QUALITY.md`, `TECH-DEBT.md`, all convention and guide files listed in Section 7. Any file that is a stub at end of Phase 1 (only those §12 marks with a stub→complete lifecycle — currently `README.md` and `QUALITY.md`) must still carry all four required sections (Status/Overview/Key Details/Related) so the now-blocking `check-doc-format` stays green; every other documentation file introduced in Phase 1 is written complete (see the §10 per-phase completeness invariant).
- `documentation/conventions/coding-standards.md` — complete (not a stub). Content specified in Section 8 AGENTS.md Section 3.
- `documentation/conventions/smell-prevention.md` — complete (not a stub). Smell catalog specified in Section 8.
- `exec-plans/` directory structure.
- `tools/check-all.sh` (runs all Python + JS checks — all should pass on empty/minimal repo).
- `tools/check-python-filesize.py` — Python file size limit + header enforcement.
- `tools/check-release.py` — **created in Phase 1** (not deferred to Phase 10), because `check-all.sh` invokes `python tools/check-release.py --dry-run` on every run and the script must therefore exist from the first phase. The Phase 1 version only needs the `--dry-run` path: exit 0 when no zip exists in `releases/`. Its full zip-content validation logic is completed in Phase 10. Without this, `check-all.sh` aborts under `set -e` on a missing-file error.
- `tests/test_smoke.py` — one trivial test that imports `polarrecorder` (and instantiates the `plugin.py` stub). This is **required**, not optional: `pytest` returns exit code 5 ("no tests collected") when zero tests exist, which aborts `check-all.sh` under `set -euo pipefail` even though coverage itself would report 100%. A single passing test makes both `pytest tests/` and the `--cov-fail-under=90` run exit 0.
- JS check scripts: copied/adapted from dyninstruments where noted (`check-docs.mjs`, `check-doc-format.mjs`, `check-doc-reachability.mjs`, `check-ai-instructions.mjs`, `sync-ai-instructions.mjs`, `check-file-size.mjs`, `check-headers.mjs`, `check-namespace.mjs`, `install-hooks.mjs`) and **purpose-built with no dyninstruments dependency** (`check-patterns.mjs`, `check-naming.mjs`, `check-dependencies.mjs`) — see Section 8 JS Tooling for the classification.
- `.githooks/pre-push` hook (installed via `npm run hooks:install`).
- `tests/conftest.py` with `FakeAvNavAPI`, `FakeClock`, and `FakeLogger` fixtures.
- `polarrecorder/__init__.py`.
- `plugin.py` stub (empty `Plugin` class that passes `pluginInfo`, `__init__`, `run` returning immediately).
- `plugin.json` — static plugin metadata: `version` (`1.0.0`, the single runtime source of truth read by `pluginInfo()`) and the `userApps` entry per §6.G (`{"url": "viewer.html", "iconFile": "icon.svg", "title": "Polar Recorder"}`). Created here (not in Phase 9) because `plugin.py`'s `pluginInfo()` reads it at runtime from Phase 7 onward. The `userApps` entry forward-references `viewer.html`/`icon.svg`, which do not exist until Phase 9; this is harmless because AvNav reads `userApps` only when it actually loads the plugin (never during Phase 1–8 dev/CI). `tools/check-release.py` (created this phase) asserts `plugin.json`'s version equals `pyproject.toml`'s, but only when validating a real zip (Phase 10) — the Phase 1 `--dry-run` path skips it.

**Exit conditions:**
- `python -m ruff check .` passes.
- `python -m ruff format --check .` passes.
- `python -m mypy polarrecorder tests plugin.py --strict` passes.
- `python -m pytest tests/` passes. (At least the `test_smoke.py` test must exist — `pytest` exits with code 5 on zero collected tests, which fails the gate under `set -e`. "Zero tests" is therefore **not** acceptable; the smoke test is the minimum.)
- `python tools/check-python-filesize.py` passes.
- `npm run check:all` passes.
- `tools/check-all.sh` exits 0.
- `npm run hooks:install` succeeds and `.githooks/pre-push` exists.
- **Verified by human inspection** (not the two-Pro-verifier loop, which does not yet apply): confirm each `tools/*` gate script actually *enforces* what it claims (not merely that it exits 0 on a near-empty repo), that `AGENTS.md`/`CLAUDE.md` and their shared block state the rules correctly, and that the `conftest.py` fakes/stubs match the real AvNav surfaces (e.g. `StoreAPI`, and that `FakeAvNavAPI` exposes no `fileName` since `PluginApiProxy` hides it — §3.18). The first green `tools/check-all.sh` run is part of this verification, not a substitute for it.
- **Human records Phase 0 and Phase 1 as `done`** in `<PLAN>.progress.md` ("human bootstrap, inspection-verified"). Only then does implementation have a complete, trusted foundation; later work starts from Phase 2 once this is recorded and the gate is green (§10 Phase 0).

---

### Phase 2 — Source-Verified AvNav Integration Documentation

**Intent:** Document verified plugin lifecycle, keys, units, and API shapes as permanent reference documentation. **This is the first agent-driven phase** — once the human foundation (Phase 0 + Phase 1) is complete, green, and recorded `done`, the `plan-controller` picks Phase 2 up as the first phase not marked `done`, and the full agent machinery (worker delegation, both Pro verifiers, the iteration bound, evidence-grounded PASS) applies from here on.

**Dependencies:** Phase 1.

**Deliverables:**

- `documentation/architecture/plugin-lifecycle.md` — complete lifecycle documentation citing AvNav source files.
- `documentation/avnav/keys-and-units.md` — all relevant store keys, units, sign conventions, citing source.
- `documentation/architecture/api.md` — request handler shape, URL routing, response format, citing source.
- `documentation/user/configuration.md` — editable parameter system, types, constraints.
- Update `TABLEOFCONTENTS.md` with all new entries.

**Exit conditions:**
- Every documented fact cites a specific AvNav source file and line number.
- `npm run check:docs` passes (all referenced docs exist).

---

### Phase 3 — Pure Domain Model

**Intent:** Build the core data model (sample, bins, histogram, polar model) with tests before any AvNav integration.

**Dependencies:** Phase 1.

**Deliverables:**

- `polarrecorder/units.py` — m/s↔knots conversion, constants. Tests: `test_units.py`.
- `polarrecorder/sample.py` — `ReadResult` and `Sample` dataclasses, the `RuleResult` dataclass (per-rule decision/reason-codes type, homed here to avoid a `pipeline`↔`rules_*` cycle — §6.C), `build_sample()`, `ClockFn` and `WallClockFn` type aliases, TWA normalization (0–360 → abs 0–180, signed -180..+180), unit conversion. Tests: `test_sample.py`.
- `polarrecorder/bins.py` — bin address computation with rounding, bin data structure, and the fixed-grid named constants `TWA_BIN_SIZE = 1`, `TWS_BIN_SIZE = 1`, and `TWS_BIN_MAX = 60` (reused by `export.py` for the projection ceiling and by `plugin.py` for the persisted `config` metadata block, §6.E). Tests: `test_bins.py`.
- `polarrecorder/histogram.py` — speed histogram (add sample, merge, percentile extraction). Tests: `test_histogram.py` (including property test: percentile monotonicity).
- `polarrecorder/polar_model.py` — polar model holding bin grid, update API, per-bin query API, reset (clear all bins/histograms, increment `generation`), a sparse-bin read accessor (`iter_bins()`/`bins`) for in-process single-threaded consumers, and `snapshot_bins()` — the detached read accessor (fresh per-bin dicts with `dict(...)`-copied histograms and `rejection_histogram`, sharing no mutable state with the live model) used by the API read path so formatters run outside the lock (§6.B, §7 Thread Safety). The coarse export-grid projection is NOT built here — it lives in `export.py` (Phase 8). Tests: `test_polar_model.py` (including a test that mutating the model after `snapshot_bins()` does not alter a previously-returned snapshot — proving detachment).
- `polarrecorder/logger.py` — the `Logger` `Protocol` only (pure: `info`/`warn`/`debug`/`error`, no AvNav import). Created here because it is annotated by consumers in Phases 3–6 (`config.py` if it takes a logger, `pipeline.py` in Phase 4, `persistence.py` in Phase 6); the `AvNavLogger` concrete adapter is added to this file in Phase 7. No dedicated test in Phase 3 (a `Protocol` has no runtime behaviour); `test_logger.py` arrives with the adapter in Phase 7. **However**, because consumers reference `Logger` only in `from __future__ import annotations`-stringized annotations (so they import it under `TYPE_CHECKING`), `logger.py` is otherwise never imported at runtime in Phases 3–6 and would report 0% under `coverage --source=polarrecorder` (which measures even un-imported package files). To execute its class/`def` lines, add a one-line smoke `import polarrecorder.logger` to a Phase 3 test (e.g. `test_config.py`) — the same technique used for `rules_enhanced.py` in Phase 4. (The `...` stub bodies remain `exclude_lines`-excluded; the smoke import covers the surviving class/`def`/import lines.)
- `polarrecorder/config.py` — configuration dataclass with defaults, string parsing. Tests: `test_config.py`.
- `polarrecorder/params.py` — `EDITABLE_PARAMETERS` spec (pure data; AvNav param dicts with string defaults). Covered by a consistency test in `test_config.py` (every spec `name` maps to a `Config` field; every `default` string parses to that field's type).
- `documentation/architecture/polar-model.md` — algorithm documentation.
- Update `TABLEOFCONTENTS.md` with the new `polar-model.md` entry.

**Exit conditions:**
- `python -m pytest tests/test_units.py tests/test_sample.py tests/test_bins.py tests/test_histogram.py tests/test_polar_model.py tests/test_config.py` all pass.
- Coverage for `polarrecorder/histogram.py` ≥ 95%.
- Coverage for `polarrecorder/polar_model.py` ≥ 90%.
- `ruff` and `mypy` pass.

---

### Phase 4 — Validation and Bad-Data Threat Handling

**Intent:** Implement the full validation pipeline with every rule, the validation state, and comprehensive scenario tests.

**Dependencies:** Phase 3.

**Deliverables:**

- `polarrecorder/validation/__init__.py` — package marker for the `validation` subpackage (no docstring required; covered by the `D104` ignore on `__init__.py` files, §8 ruff config). Created here because Phase 4 is the first phase to populate `polarrecorder/validation/`.
- `polarrecorder/validation/pipeline.py` — pipeline runner. Signature `run(read_result, state, config, logger=None) -> tuple[PipelineResult, Sample | None]`; owns R1/R2 + `Sample` construction and returns the built `Sample` (or `None` on R1/R2 rejection) for `plugin.py` to reuse (§6.C). Tests: `test_validation_pipeline.py`.
- `polarrecorder/validation/angle_math.py` — circular distance and circular range functions. Tests: `test_angle_math.py` (including wrap-around edge cases at 0°/360° boundary).
- `polarrecorder/validation/state.py` — `ValidationState` with time-based rolling window (`collections.deque`), cooldown timer (monotonic timestamp), previous sample tracking, the `observe(sample)` maintenance method, and `is_warming_up(now_monotonic)` (the complement of R15's "filled" predicate, §7 Layer 4). Tests: part of pipeline tests, including a case asserting `is_warming_up(now)` returns the complement of R15's `reject_warming_up` decision for the same buffer state and `now` (so the status flag and the rule cannot drift).
- `polarrecorder/validation/rules_core.py` — rules R1–R10. Tests: `test_validation_core.py`.
- `polarrecorder/validation/rules_stability.py` — rules R11–R15. Tests: `test_validation_stability.py`.
- `polarrecorder/validation/rules_heuristic.py` — rule R16. Tests: `test_validation_heuristic.py`.
- `polarrecorder/validation/rules_enhanced.py` — empty module documenting (in its module docstring and comments) the interface for future optional signal rules (RPM, depth, SOG/STW mismatch, AWA/AWS true-wind cross-check, heading turn, user pause). To avoid uncovered lines under the coverage gate, it ships with **no executable function/method bodies** in MVP (description-only — no `...`-bodied stubs or `raise NotImplementedError` placeholders). Note it is not *zero* statements: like every `polarrecorder/` file it carries the header docstring and `from __future__ import annotations` (two counted lines, not matched by `exclude_lines`). So `test_validation_heuristic.py` includes a one-line `import polarrecorder.validation.rules_enhanced` (an explicit smoke import) to execute those module-level lines — that, with no bodies to exercise, gives the file full line coverage.
- `documentation/filters/rejection-rules.md` — every rule documented with reason code, thresholds, detectability classification.
- `documentation/architecture/data-pipeline.md` — the ReadResult → Sample → pipeline → model data flow, the candidacy/quality gate split, and the `ValidationState.observe()` ordering (§6.C, §6.C2), **plus the optional-signal rule extension point**: how to add a future enhanced rule via `rules_enhanced.py` (where it slots into the rule order, how it returns a `RuleResult`, and how it would consume an optional signal from the `Sample.enhanced` dict), with worked sketches for an RPM-reject rule, a depth-reject rule, a SOG/STW-mismatch rule, and an AWA/AWS true-wind cross-check rule — satisfying the §11 "Optional Signal Usage" acceptance items.
- Update `TABLEOFCONTENTS.md` with the new `rejection-rules.md` and `data-pipeline.md` entries.

**Exit conditions:**
- `python -m pytest tests/test_validation_*.py` all pass.
- Coverage for `polarrecorder/validation/` ≥ 95%.
- Scenario tests cover every threat from the threat model (T1–T26):
  - For threats classified D-TWA/TWS/STW or P-TWA/TWS/STW: at least one test verifies the correct rejection/quarantine with the expected reason code.
  - For threats classified D-Enhanced or N (not detectable in MVP): at least one test verifies the sample passes through the pipeline unrejected, documenting that the threat is accepted by design. These are verified as non-poisoning in Phase 5's scenario tests.
- Each rule returns the correct reason code.
- The pipeline runner sets `PipelineResult.is_sailing_candidate` correctly: `True` for accepted samples and for samples rejected/quarantined by R11–R14, R15 `reject_unstable`, or R16; `False` for samples rejected by any of R1–R10 **and** `False` for an R15 `reject_warming_up` rejection (verified by at least one test per group, including a dedicated warm-up case).

---

### Phase 5 — Poisoning-Resistance Scenario Tests

**Intent:** Prove that the histogram + percentile + validation pipeline resists data poisoning.

**Dependencies:** Phase 3, Phase 4.

**Deliverables:**

- `polarrecorder/commit.py` — the pure `commit_sample(pipeline_result, sample, model)` model-dispatch function (Layer 12; the single tested implementation of the §6.B update contract). Created here so the poisoning suite can drive the *exact* production dispatch path rather than a hand-rolled copy. Its dependencies (`PolarModel` Phase 3, `PipelineResult` Phase 4, `Sample` Phase 3) all exist by now. Tests: a focused `tests/test_commit.py` asserting each decision routes to the correct `model.*` method (and that R1–R10 / `reject_warming_up` / `sample is None` touch no bin). Reused under the lock by `plugin.py` in Phase 7.
- A shared per-sample driver in `tests/conftest.py` (e.g. `drive_read_results(read_results, state, config, model)`) that mirrors `plugin.py`'s normal-path orchestration **using the real callables** — for each read: `(pr, s) = pipeline.run(read_result, state, config)`, then `if s is not None: state.observe(s)`, then `commit.commit_sample(pr, s, model)`. The poisoning scenarios feed sample sequences through this driver so the test sequence cannot drift from production wiring.
- `tests/test_poisoning_scenarios.py` — scenario tests (each built on the shared driver above):
  - Feed 1000 valid sailing samples → verify learned polar matches expected P65.
  - Feed 1000 valid + 200 slow (engine) samples → verify P65 is not significantly dragged down.
  - Feed valid sailing + burst of zero-STW (anchored) → verify anchored samples rejected, polar unchanged.
  - Feed valid sailing + scattered sensor spikes → verify spikes rejected, polar unchanged.
  - Feed valid sailing + gradual instrument drift → verify P65 absorbs moderate drift gracefully.
  - Feed only low-wind samples → verify all rejected by low-wind rule, no bins populated.
  - Feed maneuver-rich sequence (frequent tacks) → verify cooldown rejects transient samples, stable segments learned.
- `documentation/filters/poisoning-resistance.md` — poisoning-resistance strategy documentation (histogram + percentile + validation pipeline); references `test_poisoning_scenarios.py`.
- Update `TABLEOFCONTENTS.md` with the new `poisoning-resistance.md` entry.

**Exit conditions:**
- All poisoning scenario tests pass.
- `test_poisoning_scenarios.py` includes at least 7 distinct scenarios.
- `commit.py` exists and `test_commit.py` verifies each decision routes to the correct `model.*` method (accepted → `update_accepted`; quality-gate reject → `record_rejection`; R16 → `record_quarantine`; R1–R10 / `reject_warming_up` / `sample is None` → no model touch). Aggregate `polarrecorder/` coverage remains ≥ 90%.
- The poisoning scenarios drive samples through the shared `conftest.py` driver (`pipeline.run → observe → commit_sample`), not a bespoke per-test orchestration.
- Documentation in `poisoning-resistance.md` references the test file.

---

### Phase 6 — Persistence

**Intent:** Implement JSON persistence with atomic writes, backup, corruption recovery, and schema migration.

**Dependencies:** Phase 3 (needs PolarModel serialization).

**Deliverables:**

- `polarrecorder/persistence.py` — load, save, atomic write, backup, corruption recovery, schema migration, plus the pure `serialize_to_dict(model, counters, metadata)` reused by `save()` and (in Phase 8) by `plugin.py`'s `export/json` dispatch under the lock (its result is handed to `api_handlers.export_json` for wrapping; see §7 Layer 6/7). Tests: `test_persistence.py`.
- `polarrecorder/counters.py` — aggregated rejection counter container, increment, reset (clear all counters), serializable. Tests: `test_counters.py`.
- `documentation/architecture/persistence.md` — JSON schema, atomic-write procedure, backup/corruption recovery, schema migration, and the single-writer flush rule (§6.E).
- Update `TABLEOFCONTENTS.md` with the new `persistence.md` entry.

**Exit conditions:**
- Round-trip test: create model → save → load → assert equality.
- Corrupt file test: corrupt `polar.json` → load falls back to `polar.backup.json`.
- Both corrupt test: both files corrupt → load returns empty model with error logged.
- Atomic write test: verify temp file → rename sequence.
- Schema migration test: create a synthetic schema_version 0 fixture (e.g., missing a required field added in version 1) → load → verify migration to version 1 succeeds and fills defaults. This tests the migration mechanism itself; schema_version 0 is a test-only format that never shipped.
- Coverage for `polarrecorder/persistence.py` ≥ 90%.
- `ruff` and `mypy` pass.

---

### Phase 7 — AvNav Plugin Integration

**Intent:** Wire the domain model to AvNav through a thin `plugin.py`.

**Dependencies:** Phase 2, Phase 3, Phase 4, Phase 5 (`commit.py`), Phase 6.

**Deliverables:**

- `polarrecorder/reader.py` — AvNav store value reader with freshness metadata extraction. Takes an API-like interface (`StoreAPI`), injected `clock`/`wall_clock` callables, and optional logger. Tests: `test_reader.py` using fake API and `FakeClock`.
- `polarrecorder/timeline.py` — 1-minute decision buckets for the rejection timeline (240 buckets = 4 h; `record(decision, reason_codes)` aggregates into the current minute via the injected `wall_clock`; `query(minutes)` returns recent buckets oldest-first; buckets older than 4 h evicted). Tests: `test_timeline.py`.
- `plugin.py` — complete thin shell:
  - `pluginInfo()` returns description and version. The `description` value is the fixed string `"Polar Recorder: automatically learns your boat's sailing polar (TWA/TWS → boat speed) from live NMEA data with no user interaction."` (a module-level constant, not localized — AvNav plugin descriptions are plain strings). **The version is read at runtime from `plugin.json`** (parsed with the stdlib `json` module — Python 3.9 has no stdlib TOML reader, so `pyproject.toml` cannot be read at runtime). Because `pluginInfo()` is a **classmethod** (Verified Baseline #2/#3) it has no `api` instance; it locates `plugin.json` via the module's own path — `os.path.join(os.path.dirname(os.path.abspath(__file__)), "plugin.json")` (`__file__` is set correctly by AvNav's `spec_from_file_location` loader) — NOT via `api.getDataDir()` or `api.fileName`. `plugin.json` is the single runtime source of truth for the version; `tools/check-release.py` asserts `plugin.json`'s version equals `pyproject.toml`'s. Because the dev environment may also be Python 3.9 (no stdlib `tomllib`, which is 3.11+), `check-release.py` extracts the `pyproject.toml` version with a simple line/regex scan (`re.search(r'^version\s*=\s*"([^"]+)"', ...)` on the `[project]` block), not a TOML parser — this keeps the dev tooling free of third-party dependencies (consistent with HC #19's spirit). If `plugin.json` is missing or unparseable at load time, fall back to a hardcoded version string and log a warning (never crash). Note that `plugin.json` already exists from Phase 1, so the **normal** runtime path reads the real version; `test_plugin_integration.py` asserts `pluginInfo()` returns the version from `plugin.json`, and covers the missing/unparseable fallback as a separate branch (e.g. by pointing the lookup at a temp dir with no `plugin.json`). Intentionally omits the `config` key — editable parameters are registered dynamically in `__init__` via `registerEditableParameters()` to support a custom change callback (`_on_config_change`). Do not duplicate parameters in `pluginInfo()` — AvNav's `registerEditableParameters()` overwrites any earlier registration.
  - `__init__(api)` registers all editable parameters by passing `params.EDITABLE_PARAMETERS` (Layer 11) to `api.registerEditableParameters()`, then iterates that same list to read initial config values from AvNav's persisted storage via `api.getConfigValue(name, default)` for each parameter (recovering any values saved from a previous run; `default` taken from the spec, always a string), parses them via `config.py` to build the initial runtime `Config` object. Sets `self._data_dir = os.path.join(_plugin_dir, "data")` from the module-level `_plugin_dir` (the `__file__`-derived path computed by the import guard, §7) — **never** from `api.fileName`, which the `PluginApiProxy` does not expose (§3.18). Then registers request handler, registers restart handler, loads the persisted model from `self._data_dir` (so `_data_dir` must be set first), creates `threading.Lock`, creates `AvNavLogger` adapter, initializes `self._clock`/`self._wall_clock` (§6.B2). `test_plugin_integration.py` constructs the plugin pointing `_plugin_dir`/`_data_dir` at a `tmp_path` (or overrides `self._data_dir` and re-runs the load) so the loop reads/writes `polar.json`/`presets.json` under the temp dir. Does NOT call `api.registerUserApp()` — user app registration is handled declaratively by `plugin.json` (see Section 6.G).
  - `run()` **first resets `self._stop_requested = False`** (the same instance is re-entered on AvNav re-enable — §7 Layer 1, §6.B2), then captures `run_start_monotonic` and uses `fetchFromQueue` + monotonic clock gate for ~1 Hz sampling. Reads store values via reader to a `ReadResult`, then runs the validation pipeline, which returns `(pipeline_result, sample)` (§6.C); `plugin.py` reuses the returned `sample` (when non-`None`) for `ValidationState.observe()` and the model update — it does not rebuild it. Acquires lock → `commit.commit_sample(pipeline_result, sample, model)` (the §6.B model dispatch, Layer 12) + global counters (§6.C2) + `timeline.record(...)` + status scalars → releases lock. Flushes to disk when the periodic interval has elapsed or `_flush_requested` is set (serialize under lock, write outside lock; clear the flag after a requested flush). On loop exit (`shouldStopMainThread()` returns `True` or `_stop_requested` is set), performs a final flush before returning. On the pause/disabled path the pipeline does not run, so `plugin.py` calls `build_sample(read_result)` itself to warm `ValidationState` (§6.B3, §6.B4). On iterations that run the pipeline, when `config.debug_logging` is `true`, emit one per-sample `logger.debug()` line with the decision and reason codes (the only effect of that parameter; §7 Layer 1). **The loop body (read → validate → update) is wrapped in a try/except that catches `Exception`, logs the error via `api.error()`, and continues to the next iteration. This prevents unexpected exceptions from killing the plugin thread. The outer `while not shouldStopMainThread() and not self._stop_requested` loop continues regardless.**
  - Restart callback (registered via `api.registerRestart()`): lightweight — sets `_stop_requested = True`, no I/O, no lock acquisition. This callback is called from AvNav's HTTP thread; it must not flush or access shared state.
  - `_on_config_change(changed)` — config hot-swap callback: acquires lock, parses new values via `config.py`, replaces config object. No validation state reset.
  - `_handle_request(url, handler, args)` — the **single request dispatcher** (§7 Layer 7). Normalizes the AvNav `args` dict (list-valued, from `parse_qs`) to a flat `dict[str, str]` (first element per key; see §6.F "list normalization"), then routes by endpoint: **mutation endpoints** (`reset`, `pause`, `resume`) are handled inline under the lock (mutate live state; `reset` also sets `_flush_requested`); **preset mutations** (`presets/save`, `presets/delete`) call `export.py` with the data-dir path **while `plugin.py` holds the lock** (serializing concurrent HTTP worker threads against `presets.json`, §7 Thread Safety); **read endpoints** acquire the lock, snapshot the needed shared state (model, counters, timeline, validation status, config, recording state, `now_monotonic`, and the most recent `last_current_values`/`last_decision`), release the lock, then call the matching pure `api_handlers.format_*` function outside the lock. **In Phase 7 only the normalization, the lock/snapshot scaffolding, and the outer try/except safety net exist; the method routes to a minimal placeholder that returns `{"status": "ERROR", "error": "not implemented"}` for unknown endpoints (a single inline `status` response is acceptable for the integration test). The full read-formatter dispatch to `polarrecorder/api_handlers.py` and the mutation handling for `reset`/`pause`/`resume`/preset save/delete are wired in Phase 8, when `api_handlers.py` and `export.py` are created.** This keeps Phase 7 importable and `mypy`-clean without a forward dependency on a not-yet-existing module. `api_handlers` (once it exists) never sees the lock, never sees list-valued args, and never mutates live state.
- `polarrecorder/logger.py` — adds the `AvNavLogger` adapter (delegates to `api.log/debug/error`) to the file created in Phase 3 (which already holds the `Logger` protocol). `FakeLogger` for tests lives in `conftest.py` (Phase 1). Tests: `test_logger.py` — a fake `api` captures calls and asserts `info`/`debug`/`error` delegate to the right AvNav method and that `warn` maps to `api.log()` with the `[WARN]` prefix (covers all four levels).
- `tests/test_reader.py` — tests with fake API providing `getSingleValue` with `includeInfo=True`.
- `tests/test_timeline.py` — bucket aggregation (multiple decisions/reasons within one minute roll into one bucket), minute-boundary rollover (samples in different minutes land in different buckets), `query(minutes)` time-window filtering, and 4-hour eviction. Uses `FakeClock` as the wall clock.
- `tests/test_plugin_integration.py` — integration tests with fake AvNav API demonstrating full sampling loop, concurrent model update + API read (thread safety), config hot-swap.
- `documentation/user/configuration.md` — completed (started in Phase 2): documents every editable parameter, its type/range/default, the config hot-swap behavior, and the `cooldown_seconds` < `stability_window_seconds` known limitation (§6.C). Already in `TABLEOFCONTENTS.md` from Phase 2 — no new entry needed.

**Exit conditions:**
- `test_reader.py` passes, verifying freshness extraction and stale value detection.
- `test_plugin_integration.py` demonstrates: fake API → reader → pipeline → model update → model query, all without real AvNav.
- `plugin.py` is under the 400-line limit.
- `ruff` and `mypy` pass on all files.
- `tools/check-all.sh` passes.

---

### Phase 8 — API Endpoints

**Intent:** Implement all MVP API endpoints.

**Dependencies:** Phase 7.

**Deliverables:**

- `polarrecorder/api_handlers.py` — pure formatter functions for the **read endpoints** (`status`, `polar`, `rejections`, `timeline`, `export`, `config`, `presets`, `export/json`); one `format_*` per endpoint, operating on snapshots passed by `plugin.py` (§7 Layer 7). Defines the `StatusSnapshot` dataclass consumed by `format_status` (the formatter input-shape rule in §7 Layer 7 — `format_status` takes the single `StatusSnapshot`; the other formatters take bundled live/snapshot objects plus scalar query args, all ≤ 6 params). The **mutating** endpoints are handled outside `api_handlers`: `reset`/`pause`/`resume` inline in `plugin.py`'s dispatcher under the lock, and `presets/save`/`presets/delete` via `export.py` — `api_handlers` contains no live-state mutation. Tests: `test_api_handlers.py` (read formatters; constructs a `StatusSnapshot` directly for `format_status`); mutation behavior is covered by `test_plugin_integration.py`.
- `polarrecorder/export.py` — Windy built-in preset, user preset load/save/delete (`presets.json`), export grid projection, CSV generation, and the `MIN_SAMPLES_DISPLAY` constant. Tests: `test_export.py` (covers: Windy preset values, grid projection, CSV format, preset mode export, inline mode export, preset save/load/delete round-trip, reserved name rejection, corrupt `presets.json` recovery, preset name validation, error on `format`+`twa`/`tws` supplied together, error on `twa` without `tws`, **floor selection — a cell with 3–9 samples is populated at the default `MIN_SAMPLES_DISPLAY` floor but `null`/blank at the `min_samples_for_export` high-confidence floor, and the projection is deterministic: called twice with identical `(twa_grid, tws_grid, percentile, min_samples)` arguments it returns identical output (this is what `/api/polar` and the default export rely on — the same shared function, so passing one the other's grid reproduces the other's cells exactly)**).
- Wiring in `plugin.py` request handler → `api_handlers`.
- `documentation/architecture/api.md` — completed (shape written in Phase 2): every MVP endpoint's URL, query params, request/response schema, error format, and the GET-only-mutation rationale (§6.F). Already in `TABLEOFCONTENTS.md` from Phase 2 — no new entry needed.
- `documentation/user/export-import.md` — the export presets (Windy built-in + user presets), the CSV grid format, inline vs preset export modes, the JSON backup (`export/json`), and a note that import/restore is Post-MVP (§6.B, §6.F).
- Update `TABLEOFCONTENTS.md` with the new `export-import.md` entry.

**Exit conditions:**
- Each endpoint tested with fake handler args.
- `status` returns counters and current state.
- `polar` returns bin data with percentile-extracted speeds.
- `rejections` returns aggregated rejection counters.
- `timeline` returns 1-minute decision buckets for the requested window.
- `export` returns CSV with correct grid projection.
- `export` with Windy Passage Planner preset produces the expected column/row format.
- `export` with a user-saved preset name loads TWA/TWS from `presets.json` and produces correct CSV.
- `presets` returns Windy built-in + user-saved presets.
- `presets/save` creates/overwrites a user preset in `presets.json` (atomic write). Rejects reserved name "windy".
- `presets/delete?confirm=yes` removes a user preset. Rejects deletion of "windy".
- `reset?confirm=yes` clears the model, global counters, and per-bin rejection histograms, and sets the `_flush_requested` flag so the plugin thread persists the cleared state on its next iteration (verified in integration tests by advancing the loop one iteration and asserting the file was rewritten).
- `reset` without confirm returns error.
- `pause`/`resume` toggles recording state.
- `export/json` returns full model JSON.
- Polar export is **deterministic** (same model produces same CSV byte-for-byte).
- `ruff` and `mypy` pass.

---

### Phase 9 — UI

**Intent:** Build the user-facing viewer app with responsive layout, tab navigation, polar diagram, status panel, rejection timeline, and export configurator.

**Dependencies:** Phase 8.

**Deliverables:**

- `viewer.html` — HTML shell: tab bar, tab containers, `<link rel="stylesheet" href="viewer.css">`, `<script>` tags loading all JS files in order (§6.G.9), inline critical CSS for first-paint.
- `viewer.js` — App shell: tab switching, polling manager (start/stop per tab visibility), state management, API fetch calls, day/night toggle. Also renders the Status tab's **recent-decisions strip** (§6.G.4 Section 2): maintains the bounded `window.Polarrecorder.recentDecisions` array (maxlen 60), appends one derived cell per successful `GET /api/status` poll (no extra fetch), and draws the color-coded cell row with per-cell tooltips.
- `polar-chart.js` — SVG polar diagram rendering: concentric STW circles, radial TWA lines, curve drawing per TWS band, TWS chip selector, tooltip on tap/hover.
- `timeline-chart.js` — SVG bucket chart: one rect per 1-minute bucket positioned by `t`, color-coded by dominant decision (stacked sub-rects when mixed), time-range buttons (30 min / 1 h / 4 h) that re-request and redraw, tap-a-bucket tooltip (minute time range + counts + top reason codes). No per-sample marks, no client-side bucketing or zoom-re-fetch.
- `export-ui.js` — Export configurator: preset selector, editable TWA/TWS grid (individual number inputs with add/remove, auto-sort, inline validation), percentile override, save-as-preset with overwrite confirmation, CSV preview, download trigger, JSON backup download, reset with typed confirmation.
- `viewer.css` — All viewer styles: CSS custom properties for day/night mode, responsive breakpoints (< 600px, 600–1024px, > 1024px), tab bar, touch target sizing, card layouts.
- `plugin.css` — Empty file with a comment: `/* Reserved for post-MVP AvNav dashboard widget styles. Viewer styles are in viewer.css. */`. Required because AvNav auto-loads plugin.css into the SPA; keeping it empty prevents style leakage into the chart plotter UI.
- `plugin.mjs` — Minimal no-op stub: `export default function(_api) {}`. Accepts and ignores the AvNav JS API parameter. Must NOT register user app (handled by `plugin.json`). Post-MVP, becomes the entry point for a dashboard widget via `registerWidget()`.
- `plugin.json` — already created in Phase 1 (version + `userApp` registration). Phase 9 only confirms/finalizes it now that `viewer.html` and `icon.svg` (the files its `userApps` entry references) exist; no new file is created here.
- `icon.svg` — Plugin icon for AvNav user apps list. Simple polar diagram silhouette: a quarter-circle arc (representing a polar curve) on a radial grid. Stroke uses a **literal color** `#546E7A` (the value of `--polarrecorder-main-color`), NOT a CSS custom property — AvNav renders this icon in its user-apps list outside the viewer's CSS scope, so `var(--polarrecorder-main-color)` would not resolve. `#546E7A` is a mid-tone blue-grey legible on both AvNav day (light) and night (dark) backgrounds. Square viewBox (e.g., `0 0 64 64`), monochrome, no text. Must be legible at 32×32px.
- `documentation/architecture/ui.md` — UI architecture and component documentation.
- `tools/mock-server.py` — Minimal stdlib-only Python HTTP server for UI testing. Serves at `http://localhost:8080`. No external dependencies. **URL routing:** requests matching `/api/<endpoint>` return the corresponding `tests/mock-data/<endpoint>.json` file with `Content-Type: application/json` (e.g., `/api/status` → `tests/mock-data/status.json`, `/api/polar` → `tests/mock-data/polar.json`). **Query parameters are ignored for all endpoints** — the mock server routes on path only, so `GET /api/polar?format=my-preset` and `GET /api/polar?format=windy` both return the same `polar.json`. This is intentional: manual UI testing with the mock server verifies rendering and layout; preset-switching behaviour is tested by verifying the correct URL is fetched (inspectable in browser devtools), not by verifying the response changes. All other requests serve static files from the project root directory (e.g., `/viewer.html` → `./viewer.html`, `/polar-chart.js` → `./polar-chart.js`). This mirrors the production URL structure where `viewer.html` and API endpoints are siblings under `/plugins/polarrecorder/`. CORS headers are not needed because both static files and API responses are served from the same origin.
- `tests/mock-data/status.json`, `polar.json`, `rejections.json`, `timeline.json`, `config.json`, `presets.json`, `export-windy.csv`, `export-json.json` — Representative canned responses for all API endpoints. Must include: multiple TWS bands with data, a `timeline.json` with a mix of accepted-dominant, rejected-dominant (e.g. an anchored band with `reject_anchored`), and mixed 1-minute buckets plus at least one gap minute, non-zero counters, realistic current_values and a `current_decision` (so the recent-decisions strip renders during manual testing), a valid Windy-format CSV export, a valid full-model JSON export, and a presets response with Windy built-in plus at least one user-saved preset. The mock server returns `export-windy.csv` (wrapped in `{"status": "OK", "data": {"csv": "..."}}`) for **any** `GET /api/export` request — preset mode (`?format=windy`/`?format=my-preset`) **and** inline mode (`?twa=...&tws=...`), since query params are ignored and the Export tab's "Download CSV"/"Preview" use inline mode (§6.G.6) — and `export-json.json` for `GET /api/export/json`. Mutation endpoints (`pause`, `resume`, `reset`, `presets/save`, `presets/delete`) return a canned `{"status": "OK"}` response without modifying state.

**Exit conditions:**
- `viewer.html` loads in a browser without errors (testable via `python tools/mock-server.py` and opening `http://localhost:8080/viewer.html`).
- No ES module `import`/`export` in any JS file loaded by `viewer.html`.
- No build step required.
- Tab navigation works: 4 tabs (Polar, Status, Timeline, Export), switching shows/hides content.
- Polar diagram renders SVG for a sample polar model with at least 2 TWS band curves.
- TWS chip selector toggles curve visibility.
- Status panel displays all fields from the `GET status` response schema.
- Recent-decisions strip accumulates one color-coded cell per status poll (capped at 60, newest on the right), colors track accepted/rejected/quarantined/paused, and tapping a cell shows its reason code(s).
- Warming-up state displays correctly when `warming_up` is true.
- Day/night toggle switches all colors via `.nightMode` CSS class. Night mode persists across page reloads via `localStorage`.
- Rejection timeline displays a color-coded 1-minute-bucket chart for a 4-hour sample dataset (anchored/rejected stretches read as solid bands).
- Export configurator: Windy preset produces correct semicolon-delimited CSV. TWA/TWS grid editors are editable for all presets. User presets can be saved (with overwrite confirmation when name exists), selected from dropdown, and deleted. Dropdown lists Windy + user presets.
- Reset button requires typing "RESET" before confirming.
- All tap targets ≥ 44×44px.
- Layout is usable at 360px width (smartphone) and 800×480 (Raspberry Pi screen).
- Polling starts/stops correctly on tab switch (no background polling for inactive tabs).
- `plugin.py` under the 400-line limit.
- All JS files use `window.Polarrecorder` namespace, no global pollution.
- `npm run check:all` passes (file size, headers, patterns, namespace, naming, dependencies).
- All JS files under 400 non-empty lines.
- All JS files have `/** Module: ... */` headers.
- `tools/check-all.sh` exits 0.

---

### Phase 10 — Documentation and Release Packaging

**Intent:** Complete all documentation and create a repeatable release process.

**Dependencies:** Phase 9.

**Deliverables:**

- `documentation/user/troubleshooting.md` — known limitations and recovery guidance, including: undetectable threats (motor-sailing, waves, reefing, current, shallow water, bad trim — §5), corrupt-file recovery behavior, that setting `cooldown_seconds` < `stability_window_seconds` breaks the post-maneuver stability guarantee (§6.C), and that wall-clock-based displays (the rejection timeline buckets and the Status "last flush, N min ago") can briefly look wrong right after a system clock correction — e.g. an NTP step on a Raspberry Pi with no RTC at boot. These self-heal (out-of-range timeline buckets age out within 4 h; `last_flush_wall` is re-stamped on the next flush); the only lasting effect is that `created_wall` (debug/future-restore metadata only, never shown on the Status tab) keeps whatever wall time was current when the dataset was first written. Also note that lowering `max_tws` below a preset's largest TWS column disables **inline** download/save of that column in the Export tab (the editor flags any TWS field above `max_tws` as out-of-range), while **preset-mode** export (`GET /api/export?format=<name>`) is unaffected because the projection sweeps the fixed 0–60 bin grid, not `max_tws` (§6.B). Add to `TABLEOFCONTENTS.md`.
- Final documentation sweep: confirm every documentation file is complete (not a stub) and current — by the per-phase completeness invariant most are already done in their own phases, so this is a verification pass plus the Phase 10 docs (`troubleshooting.md`, complete `README.md`, `CHANGELOG.md`).
- `README.md` complete with: overview, installation, configuration, usage, screenshots placeholder, known limitations, development setup.
- `tools/release-zip.py` — builds a release zip containing only runtime files: `plugin.py`, `plugin.mjs`, `plugin.css`, `plugin.json`, `icon.svg`, `viewer.html`, `viewer.css`, all `*.js` files in the project root (i.e. `viewer.js`, `polar-chart.js`, `timeline-chart.js`, `export-ui.js`, and any split files such as `grid-editor.js`), `polarrecorder/` (Python package), `README.md`. Excludes: `tests/`, `tools/`, `documentation/`, `exec-plans/`, `data/`, `releases/`, `*.pyc`, `__pycache__`, dev config files. **Zip internal structure:** all files at the zip root (no wrapping `polarrecorder/` directory). This matches AvNav's upload flow (`zip.extractall()` into the existing plugin directory). For manual install, the user creates `<DATADIR>/plugins/polarrecorder/` and extracts the zip into it.
- `tools/check-release.py` — validates release zip contents (expected files present, no dev files).
- First release zip in `releases/polarrecorder-1.0.0.zip` with companion `polarrecorder-1.0.0.md`.
- `CHANGELOG.md` entry for 1.0.0.

**Exit conditions:**
- `npm run check:docs` passes — all referenced docs exist, TABLEOFCONTENTS is complete.
- `tools/check-release.py` passes on the generated zip.
- Release zip does not contain `tests/`, `tools/`, `documentation/`, `exec-plans/`, `data/`, `__pycache__`.
- Release zip does contain `plugin.py`, `plugin.mjs`, `plugin.css`, `plugin.json`, `icon.svg`, `viewer.html`, `viewer.css`, all root `*.js` files, `polarrecorder/`, `README.md`.

---

### Phase 11 — Final Quality Gate

**Intent:** Run all checks, enforce all thresholds, verify everything works together.

**Dependencies:** All previous phases.

**Deliverables:**

- `tools/check-all.sh` passes with zero failures.
- Coverage meets thresholds: `polarrecorder/` overall ≥ 90%, `polarrecorder/validation/` ≥ 95%, `polarrecorder/histogram.py` ≥ 95%.
- All documentation up to date.
- **Delete the `misc/` reference folder** (`misc/avnav-master/` and `misc/dyninstruments/`). These were development-time references for the Verified Baseline (§3) and the dyninstruments quality-infra adaptation; once the project is complete they are no longer needed and only bloat the repository. Removing `misc/` has no effect on `tools/check-all.sh` (the Python checks scan only project Python sources, and the doc checks scan `documentation/`), and it is already absent from every release zip (the release allowlist in §10 Phase 10 ships only the named runtime files + `polarrecorder/`). Do this as a final cleanup step; the gate below is re-run afterward to confirm green.
- Manual test checklist (documented in `documentation/QUALITY.md`):
  - [ ] Install plugin by copying directory to AvNav plugins.
  - [ ] AvNav loads plugin without errors.
  - [ ] Plugin status shows RUNNING on AvNav status page.
  - [ ] Viewer app accessible from AvNav user apps.
  - [ ] With wind instruments active, samples are accepted and bins populate.
  - [ ] With instruments off, no samples are accepted (missing values).
  - [ ] Pause/resume works from viewer.
  - [ ] Export produces valid CSV.
  - [ ] User preset can be saved, selected for export, and deleted from viewer.
  - [ ] Reset clears polar, counters, and per-bin rejection histograms, and the cleared state persists across an AvNav restart (reset is flushed by the plugin thread within one sample interval).
  - [ ] Plugin survives AvNav restart (data persisted and reloaded).
  - [ ] Corrupt `polar.json` is recovered from backup.
  - [ ] Plugin does not crash AvNav under any condition tested.

**Exit conditions:**
- `tools/check-all.sh` exits 0.
- The `misc/` folder no longer exists in the repository.
- Manual test checklist documented (actual execution requires a running AvNav instance).
- PLAN1 moved from `exec-plans/active/` to `exec-plans/completed/`.

---

## 11. Acceptance Criteria

### Phase 0 — Retired Local Agent Bootstrap

- [ ] Phase 0 has no runtime/configuration deliverables.
- [ ] No Phase 0 runtime/configuration artifacts are present in the repository.
- [ ] Phase 0 does not implement product functionality, and no secrets/API keys are committed.

### Correctness

- [ ] TWA 0–360 from store is correctly normalized to abs 0–180 and signed -180..+180.
- [ ] m/s to knots conversion is accurate (1 m/s = 1.94384 kt, verified by test).
- [ ] Bin address `round(352.335)` = 352 (verified by test).
- [ ] Bin address `round(12.7 kt TWS)` = 13 (verified by test).
- [ ] Histogram percentile P65 of `{58: 12, 59: 47, 60: 31, 61: 18}` is exactly `6.0` kt (nearest-rank lower; verified by test).
- [ ] Exact-boundary case: P50 of `{58: 50, 60: 50}` is exactly `5.8` kt (lower key, no midpoint averaging; verified by test, locking the nearest-rank-lower rule).
- [ ] Export grid projection correctly folds 360° bins to 0–180° and merges neighbors.
- [ ] Export CSV matches the Windy Passage Planner format for the preset.
- [ ] Polar export is deterministic (same input → same output byte-for-byte).

### Data Quality

- [ ] TWA = NaN → rejected with `reject_non_finite_twa`.
- [ ] Stale TWA (timestamp too old) → rejected with `reject_stale_twa`.
- [ ] Stale TWS → rejected with `reject_stale_tws`.
- [ ] Stale STW → rejected with `reject_stale_stw`.
- [ ] Key age skew (TWA fresh, STW stale) → rejected with `reject_age_skew`.
- [ ] Missing TWA (None from store) → rejected with `reject_missing_twa`.
- [ ] Missing TWS → rejected with `reject_missing_tws`.
- [ ] Missing STW → rejected with `reject_missing_stw`.
- [ ] TWA = 400° → rejected with `reject_twa_range`.
- [ ] TWS = -5 kt → rejected with `reject_tws_range`.
- [ ] STW = 45 kt → rejected with `reject_stw_range`.
- [ ] TWS = 2 kt → rejected with `reject_low_wind`.
- [ ] TWA abs = 5° → rejected with `reject_head_to_wind`.
- [ ] Tack detected (TWA crosses through 0°) → `reject_twa_roc` → cooldown → subsequent samples rejected with `reject_maneuver_cooldown`.
- [ ] Gybe detected (TWA crosses through 180°) → `reject_twa_roc` → cooldown → rejected.
- [ ] STW acceleration spike (0 → 8 kt in 1s) → rejected with `reject_stw_roc`.
- [ ] Unstable sample window (TWA oscillating) → rejected with `reject_unstable`.
- [ ] First samples after startup (stability buffer not yet filled) → rejected with `reject_warming_up`, and these are NOT sailing candidates (do not increment `total_seen`/`total_rejected`; appear only in the global `rejection_histogram` and timeline).
- [ ] Low TWS + moderate STW → quarantined with `quarantine_engine_suspected`.
- [ ] STW < 0.3 kt + TWS > 0 → rejected with `reject_anchored`.
- [ ] Candidacy-gate rejections (R1–R10), R15 `reject_warming_up` rejections, and pause/disabled iterations do NOT increment `total_seen`; they appear only in the global `rejection_histogram` and timeline.
- [ ] Quality-gate outcomes (accepted, R11–R14 / R15 `reject_unstable` rejected, R16 quarantined) each increment `total_seen` plus exactly one of `total_accepted`/`total_rejected`/`total_quarantined`; invariant `total_seen == total_accepted + total_rejected + total_quarantined` holds.
- [ ] A long paused/anchored/becalmed run, and the post-restart warm-up period, do not lower `acceptance_rate` (verified by feeding such samples and asserting the rate is unchanged).

### Poisoning Resistance

- [ ] 1000 valid samples + 200 slow (engine) samples → P65 not significantly different from 1000-valid-only P65.
- [ ] Anchored samples (STW ≈ 0) are rejected before reaching histogram.
- [ ] Sensor spikes are rejected before reaching histogram.
- [ ] Gradual drift does not catastrophically shift P65.
- [ ] Low-wind motoring-like samples do not populate bins.
- [ ] Frequent tacks → only stable segments between tacks are learned.

### Optional Signal Usage (Post-MVP, architecture in place)

- [ ] `rules_enhanced.py` module exists with documented interface for adding optional signal rules.
- [ ] Architecture doc describes how to add RPM rejection rule.
- [ ] Architecture doc describes how to add depth rejection rule.
- [ ] Architecture doc describes how to add SOG/STW mismatch rule.
- [ ] Architecture doc describes how to add AWA/AWS true-wind cross-check rule (wind triangle consistency).

### AvNav Integration

- [ ] `plugin.py` under the 400-line limit.
- [ ] `Plugin.pluginInfo()` returns valid description.
- [ ] `Plugin.__init__(api)` registers editable parameters, request handler, restart handler.
- [ ] `Plugin.run()` loops on `fetchFromQueue` and exits on `shouldStopMainThread()` or `_stop_requested`.
- [ ] `Plugin.run()` performs a final flush on loop exit (clean shutdown) before returning.
- [ ] `Plugin.run()` resets `_stop_requested` to `False` on entry, so a second `run()` on the same instance (AvNav disable→re-enable) resumes sampling instead of exiting immediately (verified in `test_plugin_integration.py`: trigger the restart callback, let the loop exit, then call `run()` again and assert it samples).
- [ ] Plugin status updates via `api.setStatus()`.
- [ ] Editable parameters changeable at runtime via AvNav UI.

### Persistence

- [ ] Model saved to `<plugin_dir>/data/polar.json`.
- [ ] Backup at `<plugin_dir>/data/polar.backup.json`.
- [ ] Atomic write: temp file → fsync → rename backup → rename primary.
- [ ] Corrupt primary → loads backup with warning.
- [ ] Both corrupt → starts empty with error.
- [ ] Schema version in JSON.
- [ ] Migration from version N to N+1 tested.
- [ ] 5-minute flush interval (configurable).
- [ ] Flush on clean shutdown.

### API/UI

- [ ] `GET /api/status` returns counters, state, `warming_up`, `data_status`, and `generation`.
- [ ] `GET /api/polar` returns bin data with `generation` counter.
- [ ] `GET /api/rejections` returns rejection counters.
- [ ] `GET /api/timeline` returns 1-minute decision buckets (accepted/rejected/quarantined counts + per-minute `reasons`).
- [ ] `GET /api/export?format=windy` returns semicolon-delimited CSV matching Windy spec.
- [ ] `GET /api/export?format=my-preset` uses TWA/TWS from saved user preset and returns correct CSV.
- [ ] `GET /api/export?twa=0,30,60,90,120,150,180&tws=4,8,12,16,20` returns correct inline-mode CSV.
- [ ] `GET /api/export` with both `format` and `twa`/`tws` returns error.
- [ ] `GET /api/export` with `twa` but no `tws` returns error.
- [ ] `GET /api/export` defaults to the `MIN_SAMPLES_DISPLAY` (3) floor; `GET /api/export?high_confidence=yes` applies the `min_samples_for_export` floor and omits cells with fewer samples. With a fixed model and grid, the default and high-confidence outputs differ **only** in which low-sample cells are populated (every cell present in the high-confidence output is also present, with the same value, in the default output).
- [ ] `GET /api/presets` returns Windy built-in + user-saved presets.
- [ ] `GET /api/presets/save?name=my-preset&twa=...&tws=...` saves a user preset to `presets.json`.
- [ ] `GET /api/presets/save` rejects reserved name "windy".
- [ ] `GET /api/presets/delete?name=my-preset&confirm=yes` deletes a user preset.
- [ ] `GET /api/export?format=my-preset` uses TWA/TWS from saved user preset.
- [ ] Export configurator dropdown lists Windy + user presets.
- [ ] `GET /api/reset?confirm=yes` clears model, global counters, and per-bin rejection histograms, and sets `_flush_requested` so the plugin thread persists the reset on its next iteration (no disk write on the HTTP thread).
- [ ] `GET /api/reset` without confirm returns error.
- [ ] `GET /api/pause` pauses recording.
- [ ] `GET /api/resume` resumes recording.
- [ ] Viewer app loads and renders polar diagram.
- [ ] Tab navigation works across all 4 tabs (Polar, Status, Timeline, Export).
- [ ] Day/night toggle switches all colors and persists via `localStorage`.
- [ ] Layout is usable at 360px viewport width (smartphone).
- [ ] Layout is usable at 800×480 (Raspberry Pi screen).
- [ ] All tap targets ≥ 44×44px.
- [ ] TWS chip selector toggles curve visibility on polar diagram.
- [ ] Status tab shows "Warming up..." during warm-up period.
- [ ] Connection-lost banner appears on fetch failure, dismisses on recovery.
- [ ] Export configurator works with all presets and editable grids.
- [ ] Reset confirmation requires typing "RESET".
- [ ] Rejection timeline shows 4-hour history as color-coded 1-minute buckets.
- [ ] Status tab's recent-decisions strip shows the live trend (last ~60 polls, color-coded, tap-for-reason) using only the existing status poll.
- [ ] Polling stops for inactive tabs, resumes on switch.

### Threading/Concurrency

- [ ] Single `threading.Lock` in `plugin.py`, no nested locks.
- [ ] Model writes (sampling loop) and reads (API handlers) both acquire the lock.
- [ ] Persistence writes happen outside the lock (serialize under lock, write outside).
- [ ] Config hot-swap callback acquires lock and replaces config atomically.
- [ ] No `polarrecorder/` module acquires any lock.

### Tests

- [ ] `polarrecorder/` overall coverage ≥ 90%.
- [ ] `polarrecorder/validation/` coverage ≥ 95%.
- [ ] `polarrecorder/histogram.py` coverage ≥ 95%.
- [ ] `polarrecorder/persistence.py` coverage ≥ 90%.
- [ ] All tests deterministic (no time-dependent flakiness — use monotonic clock injection).
- [ ] Poisoning scenario tests exist and pass.
- [ ] No AvNav server required to run any test.

### Documentation

- [ ] `README.md` complete.
- [ ] `TABLEOFCONTENTS.md` references all documentation files.
- [ ] All documentation files have Status, Overview, Key Details sections.
- [ ] `documentation/avnav/keys-and-units.md` cites AvNav source files.
- [ ] `documentation/filters/rejection-rules.md` documents every rule with reason codes.
- [ ] `documentation/filters/poisoning-resistance.md` documents the histogram + percentile approach.
- [ ] `documentation/user/configuration.md` documents all configurable parameters.
- [ ] `documentation/user/troubleshooting.md` documents known limitations, including: setting `cooldown_seconds` < `stability_window_seconds` breaks the post-maneuver stability guarantee, that wall-clock displays (timeline buckets, "last flush N min ago") can briefly misread after a system clock/NTP correction and self-heal, and that lowering `max_tws` below a preset's largest TWS column disables inline download/save of that column while preset-mode export is unaffected.

### Release Packaging

- [ ] Release zip exists in `releases/`.
- [ ] Release zip contains only runtime files.
- [ ] Release zip does not contain `tests/`, `tools/`, `documentation/`, `exec-plans/`, `data/`, `__pycache__`.
- [ ] Release zip includes all root `*.js` files (`viewer.js`, `polar-chart.js`, `timeline-chart.js`, `export-ui.js`, and any split files) alongside `viewer.css`.
- [ ] Release zip includes an empty `plugin.css` (AvNav expects it).
- [ ] `tools/check-release.py` passes on the zip.
- [ ] Version metadata in `plugin.json` matches `pyproject.toml`.

## 12. Related Documents

Documents that PLAN1 requires to be created (all paths relative to repository root):

| Document | Created In |
|---|---|
| `AGENTS.md` | Phase 1 |
| `CLAUDE.md` | Phase 1 |
| `README.md` | Phase 1 (stub), Phase 10 (complete) |
| `CONTRIBUTING.md` | Phase 1 |
| `ARCHITECTURE.md` | Phase 1 |
| `ROADMAP.md` | Phase 1 |
| `CHANGELOG.md` | Phase 10 |
| `documentation/TABLEOFCONTENTS.md` | Phase 1, updated every phase |
| `documentation/core-principles.md` | Phase 1 |
| `documentation/QUALITY.md` | Phase 1 (stub), Phase 11 (complete with checklist) |
| `documentation/TECH-DEBT.md` | Phase 1 |
| `documentation/conventions/coding-standards.md` | Phase 1 |
| `documentation/conventions/smell-prevention.md` | Phase 1 |
| `documentation/conventions/testing-infrastructure.md` | Phase 1 |
| `documentation/architecture/plugin-lifecycle.md` | Phase 2 |
| `documentation/architecture/data-pipeline.md` | Phase 4 |
| `documentation/architecture/polar-model.md` | Phase 3 |
| `documentation/architecture/persistence.md` | Phase 6 |
| `documentation/architecture/api.md` | Phase 2 (shape), Phase 8 (complete) |
| `documentation/architecture/ui.md` | Phase 9 |
| `documentation/avnav/keys-and-units.md` | Phase 2 |
| `documentation/filters/rejection-rules.md` | Phase 4 |
| `documentation/filters/poisoning-resistance.md` | Phase 5 |
| `documentation/user/configuration.md` | Phase 2 (editable params), Phase 7 (complete) |
| `documentation/user/export-import.md` | Phase 8 |
| `documentation/user/troubleshooting.md` | Phase 10 |
| `documentation/guides/exec-plan-authoring.md` | Phase 1 |
| `pyproject.toml` | Phase 1 |
| `package.json` | Phase 1 |
| `plugin.json` | Phase 1 (confirmed/finalized Phase 9) |
