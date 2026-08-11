/**
 * Ambient declarations for the browser-global `window.Polarrecorder` namespace shared by
 * `viewer/*.js`, `plugin.js`, and `plugin.mjs`.
 *
 * The declaration remains intentionally loose while the static viewer modules share one
 * browser-global namespace. Shipped modules refine their own public contracts through
 * JSDoc and the strict source typecheck.
 */

export {};

declare global {
  interface Window {
    Polarrecorder: any;
  }
}
