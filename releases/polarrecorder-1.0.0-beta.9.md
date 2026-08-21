# Polar Recorder 1.0.0-beta.9

This beta adds configurable core data sources and improves startup reliability while preserving existing learned data,
presets, and default configuration.

## Highlights

- The Settings tab now includes a Data Sources card for selecting the AvNav store keys used for true wind angle, true
  wind speed, and speed through water. The standard keys remain selected by default.
- Saved data-source changes take effect on the next sampling cycle. Custom TWA sources must provide degrees; custom TWS
  and STW sources must provide meters per second.
- Polar Recorder now remains active while waiting for initial instrument data during AvNav's short plugin-thread
  registration window instead of being marked inactive prematurely.

## Upgrade notes

After updating, restart AvNav or reload plugins from the AvNav plugin page. No polar data, preset, or configuration
migration is required; existing installations continue to use the standard AvNav source keys until changed in Settings.
