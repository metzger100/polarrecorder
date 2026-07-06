/**
 * Module: plugin.mjs - Modern AvNav user-app registration adapter.
 * Documentation: documentation/avnav/plugin-lifecycle.md
 * Depends: none
 */
const ADDON_PAGE = "addonpage";

function userAppButton() {
  return {
    name: "polarrecorder",
    shortText: "Polar",
    longText: "Polar Recorder",
    icon: "viewer/icon.svg"
  };
}

function userApp() {
  return {
    url: "viewer/viewer.html",
    title: "Polar Recorder"
  };
}

export default function initPolarRecorderPlugin(api) {
  if (!api || typeof api.registerUserApp !== "function") {
    return undefined;
  }
  api.registerUserApp(userAppButton(), userApp(), ADDON_PAGE);
  return undefined;
}
