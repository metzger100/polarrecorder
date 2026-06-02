# Smell Prevention

**Status:** Current.

## Overview

The smell catalog defines blocking anti-patterns and the required replacement patterns.

## Key Details

| Smell Class | Anti-Pattern | Required Pattern | Enforcement | Severity |
|---|---|---|---|---|
| AvNav import leak | `server/polarrecorder/` imports `avnav_api`, `pluginhandler`, or AvNav internals | Inject AvNav dependencies through protocols/fakes | ruff banned imports and `check-patterns.mjs` | block |
| Reverse dependency | `server/polarrecorder/` imports `plugin.py` | Dependency flows from `plugin.py` inward only | `check-patterns.mjs` and review | block |
| Lock acquisition in domain code | `threading.Lock`, `RLock`, or `Condition` in `server/polarrecorder/` | Locks belong only in `plugin.py` | `check-patterns.mjs` | block |
| Real sleep in domain code | `time.sleep()` in `server/polarrecorder/` | Use injected clocks and deterministic tests | `check-patterns.mjs` | block |
| Broad domain exception | Bare or broad `except` in `server/polarrecorder/` | Catch specific exceptions; boundary handles crash safety | ruff and review | block |
| Print statement | `print()` | Use logger protocol or AvNav logging boundary | ruff `T20` | block |
| Magic threshold | Hardcoded model or validation threshold | Use named config/constants | review | block |
| File size bypass | One-line compression to evade limits in Python or JS | Split modules and keep readable formatting | Python and JS filesize/oneliner checks | block |
| Commented-out code | Dead code left in comments | Delete it; version control keeps history | ruff and `check-patterns.mjs` | block |
| JS global pollution | Globals outside `window.Polarrecorder` | Namespace all browser exports | `check-namespace.mjs` | block |
| JS ES module syntax | `import`/`export` in `viewer/*.js` | Plain scripts; `plugin.mjs` only for AvNav module entry | `check-patterns.mjs` | block |
| JS debug leftover | `console.log()` | Remove or use `console.warn`/`console.error` intentionally | `check-patterns.mjs` | block |
| JS unsafe DOM mutation | `innerHTML` assignment or `eval()` | DOM APIs and safe text assignment | `check-patterns.mjs` | block |

## Related

- [Coding standards](coding-standards.md)
- [Quality](../QUALITY.md)
