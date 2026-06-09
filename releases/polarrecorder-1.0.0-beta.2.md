# Polar Recorder 1.0.0 Beta 2

Second beta release of Polar Recorder as an installable AvNav plugin.

## Highlights

- Adds separate starboard, port, and full 360 degree polar views and exports. Port data is no longer folded into starboard cells, so side-specific performance differences remain visible.
- Adds built-in export presets for `DefaultStarboard180`, `DefaultPort180`, `Default360`, and `windy`, plus import/export of user presets.
- Adds restore for learned-data JSON backups and preset backups from the Settings tab. Restores are replace-only, require typing `RESTORE`, and reject invalid files without changing current data.
- Adds optional enhanced validation rules for engine RPM/state, shallow water, SOG/STW mismatch, apparent-wind cross-checks, heel limits, and heading/COG turn confirmation.
- Improves the polar viewer with corrected point connections, thicker polar lines, better TWA 0 degree anchoring, and fixes for mobile top-bar coloring and export-tab name display.
- Adds the legacy `plugin.js` entrypoint alongside `plugin.mjs` for older AvNav plugin hosts.
- Tightens project quality gates, documentation, release checks, and runtime/viewer contract checks for safer beta builds.

## Upgrade Notes

- Extract the release zip into `<DATADIR>/plugins/` or upload it through AvNav's plugin page; the zip contains the `polarrecorder/` plugin directory.
- Enhanced rules for depth, SOG/current drift, apparent wind, heading, and COG use standard AvNav store keys by default and may become active automatically on boats that publish those keys. Toggle a rule off or clear its key in Settings if that signal is not trustworthy on your boat.
- Single-side 180 degree views and exports now count only the selected side. Confidence can build more slowly than in beta.1 because port and starboard samples are intentionally kept separate.
- `Default360` is useful for inspecting full-circle data, but it is not intended for Windy.com import. Use the `windy` preset for Windy-compatible CSV export.
- Restore replaces the selected target completely: learned-data restore replaces the learned polar and counters, and preset restore replaces user presets while leaving built-ins intact.
