/**
 * Ambient declarations for the browser-global `window.Polarrecorder` namespace shared by
 * `viewer/*.js`, `plugin.js`, and `plugin.mjs`.
 *
 * This starts intentionally loose (`Polarrecorder: any`) to unblock PLAN5 Phase 2A's
 * temporary `typecheck:migration-source` owner for newly split/added viewer files without
 * requiring the complete Phase 4 typing pass first. Phase 4A replaces this file's content
 * with a precise per-module shape (module APIs, viewer state, API response payloads,
 * presets/config, chart inputs, DOM harness boundaries) as its ambient-declaration
 * deliverable; it does not delete or rename this file.
 */

export {};

declare global {
  interface Window {
    Polarrecorder: any;
  }
}
