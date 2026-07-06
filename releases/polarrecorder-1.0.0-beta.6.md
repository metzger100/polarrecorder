# Polar Recorder 1.0.0-beta.6

This beta reworks AddOn registration so Polar Recorder reliably shows a single User Apps/AddOn entry across every AvNav variant.

## Highlights

- Polar Recorder now registers its viewer as a User App from the Python backend (`api.registerUserApp`), the registration path every AvNav core honors — including cores that neither read `plugin.json` nor load the module entrypoint.
- Removed the duplicate AddOn entry that could appear on modern cores. The module entrypoint no longer registers the app itself; the static `plugin.json` user-app declaration was removed as well, leaving the backend as the single source of registration.
- Older AvNav cores without the registration API are handled gracefully: registration is skipped instead of failing.

## Upgrade notes

After updating, restart AvNav or reload plugins from the AvNav plugin page. If Polar Recorder is still missing from, or duplicated in, the AvNav User Apps/AddOn selection, hard-refresh the AvNav client so it reloads the updated plugin metadata.
