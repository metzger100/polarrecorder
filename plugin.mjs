/**
 * Module: plugin.mjs - Modern AvNav loader entry point (no-op).
 * Documentation: documentation/avnav/plugin-lifecycle.md
 * Depends: none
 */

/**
 * Modern AvNav module entry point for Polar Recorder.
 *
 * User-app registration is owned by the Python backend: `plugin.py` calls
 * `api.registerUserApp`, and every AvNav core surfaces that AddOn in its addon
 * list. The modern frontend appends module-registered apps to that same list
 * without de-duplicating against server AddOns, so registering here as well
 * would show a second, identical entry. This module therefore intentionally
 * does nothing and exists only to satisfy the module loader contract.
 *
 * @returns {Promise<undefined>} resolves immediately
 */
export default async function initPolarRecorderPlugin() {
  return undefined;
}
