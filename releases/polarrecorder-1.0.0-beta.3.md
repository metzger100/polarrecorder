# Polar Recorder 1.0.0 Beta 3

Third beta release of Polar Recorder as an installable AvNav plugin.

## Highlights

- Moves all advanced recording and runtime tuning out of AvNav editable plugin parameters and into a new **Advanced Settings** card in the viewer Settings tab. The card groups fields into Sampling and Persistence, Sensor Freshness, Core Filters, Stability and Maneuvers, and Engine Heuristic, each with a readable label, a short description, and range checks before saving.
- Settings now persist in AvNav plugin configuration and are edited directly in the viewer, so day-to-day tuning no longer requires opening AvNav's plugin parameter editor.
- Removes the separate `record_enabled` plugin parameter. Recording is now turned on or off with AvNav's standard plugin enable switch, alongside the in-viewer Pause/Resume button. The `reject_disabled` decision reason is gone as a result.
- Export percentile and the high-confidence export sample floor stay on the Export tab instead of being duplicated in Advanced Settings.

## Upgrade Notes

- Extract the release zip into `<DATADIR>/plugins/` or upload it through AvNav's plugin page; the zip contains the `polarrecorder/` plugin directory.
- Tuning values you previously set as AvNav editable parameters are no longer shown in AvNav's plugin parameter editor. Review and adjust them from the new **Advanced Settings** card in the Settings tab instead.
- To stop recording entirely, disable the plugin with AvNav's plugin enable switch. The previous `record_enabled` parameter and the `reject_disabled` rejection reason no longer exist.
- No learned-data or preset migration is required; existing `polar.json` data and presets are unaffected.
