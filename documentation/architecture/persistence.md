# Persistence

**Status:** Complete for Phase 6 persistence.

## Overview

Polar Recorder keeps the learned polar in memory and writes it rarely to JSON. The
persistence boundary owns only `polar.json`, `polar.backup.json`, and `polar.tmp.json`
under the plugin data directory; export presets are a later `export.py` concern.

## Key Details

The on-disk schema is a single JSON object with `schema_version`, `plugin_version`,
`created_wall`, `last_flush_wall`, a metadata-only `config` block, global `counters`, and
sparse `bins`. The config block records `percentile`, `max_tws`, and the fixed bin sizes
from `polarrecorder.bins`; startup configuration still comes from AvNav settings, not from
this file.

`created_wall` is carried over from the loaded dataset and remains stable across flushes and
resets. `last_flush_wall` is supplied by `plugin.py` on every flush. The persistence module
does not read clocks.

Bin keys are serialized as `"{twa}_{tws}"`. JSON turns all object keys into strings, so
`load()` converts bin addresses back to `(int, int)` tuples and converts speed histogram
keys back to `int` deciknot keys before rebuilding the `PolarModel`.

Atomic write order is fixed:

1. Serialize to a JSON string.
2. Create the data directory with `os.makedirs(data_dir, exist_ok=True)`.
3. Write `polar.tmp.json`.
4. Flush and `fsync()` the file descriptor.
5. If `polar.json` exists, replace `polar.backup.json` with it.
6. Replace `polar.json` with `polar.tmp.json`.

The directory creation and write steps share one `OSError` handler. On failure the module
logs the specific error, removes `polar.tmp.json` if it exists, and returns normally. If the
final rename fails after the primary was already promoted, the previous primary remains
recoverable as `polar.backup.json`.

Startup recovery tries `polar.json` first. If it is missing or corrupt, `load()` tries
`polar.backup.json` and reports `recovered_backup` when that succeeds. If neither file
exists, status is `fresh`. If files exist but none can be loaded, status is `corrupt_empty`
with an empty model and counters. A schema version newer than this code supports returns
`schema_too_new` with an empty model so `plugin.py` can surface an AvNav ERROR status.

Older schemas migrate through ordered version steps. The Phase 6 migration path supports a
test-only schema version 0 and fills the version 1 metadata defaults before deserializing.

Only the plugin thread writes the polar files. It serializes the live model under
`plugin.py`'s lock via `serialize_to_dict()`, releases the lock, then performs disk I/O.
The serializer is pure and also supplies the future `export/json` response shape.

## Related

- [Polar model](polar-model.md)
- [Data pipeline](data-pipeline.md)
- [Coding standards](../conventions/coding-standards.md)
