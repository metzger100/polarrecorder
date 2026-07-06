# Polar Recorder 1.0.0-beta.5

This beta fixes AddOn registration so Polar Recorder appears in the User Apps/AddOn selection on every AvNav variant.

## Highlights

- Fixed Polar Recorder missing from the User Apps/AddOn selection on modern AvNav cores that ignore `plugin.json`. The module entrypoint now registers the user app itself on those clients.
- Kept a single AddOn entry on cores that honor both the static `plugin.json` declaration and the module registration: the module checks the AvNav addon list first and skips its own registration when the app is already published.

## Upgrade notes

After updating, restart AvNav or reload plugins from the AvNav plugin page. If the direct viewer URL works but Polar Recorder is still missing from the AvNav User Apps/AddOn selection, hard-refresh the AvNav client so it reloads the updated plugin metadata.
