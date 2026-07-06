/**
 * Module: plugin.mjs - Modern AvNav user-app registration adapter.
 * Documentation: documentation/avnav/plugin-lifecycle.md
 * Depends: none
 */
const ADDON_LIST_URL = "/api/addon/list";
const USER_APP = {
  name: "polarrecorder",
  url: "viewer/viewer.html",
  icon: "viewer/icon.svg",
  title: "Polar Recorder"
};

/**
 * Detect whether AvNav already published this plugin's user app from the
 * static plugin.json declaration.
 *
 * Hosts that process plugin.json (legacy-only and mixed cores) expose the app
 * under this plugin's base URL through the core addon list, so the module path
 * must stay silent to avoid a duplicate AddOn entry. Modern-only cores that
 * ignore plugin.json do not list it, so the module path registers it instead.
 *
 * @param {object} api the AvNav plugin API
 * @returns {Promise<boolean>} true when a server-side AddOn already exists
 */
async function serverAppAlreadyPublished(api) {
  const pluginName = api.getPluginName();
  if (!pluginName) {
    return false;
  }
  const marker = "/plugins/" + pluginName + "/";
  const response = await fetch(ADDON_LIST_URL + "?_=" + Date.now());
  if (!response.ok) {
    return false;
  }
  const payload = await response.json();
  const items = (payload && payload.items) || [];
  return items.some(function (item) {
    return item
      && typeof item.url === "string"
      && item.url.indexOf(marker) >= 0;
  });
}

/**
 * Register the Polar Recorder user app on modern AvNav clients.
 *
 * @param {object} api the AvNav plugin API passed by the module loader
 * @returns {Promise<undefined>} resolves once registration is decided
 */
export default async function initPolarRecorderPlugin(api) {
  if (!api
    || typeof api.registerUserApp !== "function"
    || typeof api.getPluginName !== "function") {
    return undefined;
  }
  let alreadyPublished = false;
  try {
    alreadyPublished = await serverAppAlreadyPublished(api);
  } catch (requestError) {
    // polarrecorder-boundary-fallback(plugin.mjs): a missing or failing core
    // addon list means this host does not surface static plugin.json apps, so
    // register through the module path rather than showing a viewer error.
    alreadyPublished = false;
  }
  if (!alreadyPublished) {
    api.registerUserApp(USER_APP.name, USER_APP.url, USER_APP.icon, USER_APP.title);
  }
  return undefined;
}
