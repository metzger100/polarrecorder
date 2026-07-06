# Polar Recorder 1.0.0-beta.4

This beta focuses on AvNav compatibility, easier installation, and smoother operation on older client WebViews.

## Highlights

- Added a one-line Linux installer for AvNav servers.
- Fixed duplicate Polar Recorder AddOn entries on AvNav versions that load both static and modern plugin declarations.
- Improved compatibility with older Android WebViews by removing usage of `Element.replaceChildren()`.
- Strengthened release validation around the AvNav `plugin.json` user-app metadata.

## Upgrade notes

After updating, restart AvNav or reload plugins from the AvNav plugin page. If the direct viewer URL works but Polar Recorder is missing from the AvNav User Apps/AddOn selection, hard-refresh the AvNav client so it reloads the updated plugin metadata.