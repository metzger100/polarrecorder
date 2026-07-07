# Polar Recorder 1.0.0-beta.7

This beta hardens the User Apps/AddOn registration path for AvNav installations with a partial Python plugin API.

## Highlights

- Polar Recorder now skips the optional backend User App registration cleanly when an AvNav core exposes only part of the Python registration API.
- The backend registration still publishes a single Polar Recorder entry on cores with the complete `registerUserApp` and `getBaseUrl` API.
- Documentation now matches the backend-only registration contract: `plugin.json`, `plugin.js`, and `plugin.mjs` do not register duplicate AddOn entries.

## Upgrade notes

After updating, restart AvNav or reload plugins from the AvNav plugin page. No polar data, presets, or configuration migration is required.
