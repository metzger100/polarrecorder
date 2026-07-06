#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { pathToFileURL } from "node:url";

const legacyPath = path.join(process.cwd(), "plugin.js");
const legacySource = fs.readFileSync(legacyPath, "utf8");
assert.doesNotThrow(function () {
  vm.runInNewContext(legacySource, {}, { filename: legacyPath });
});

const moduleUrl = pathToFileURL(path.join(process.cwd(), "plugin.mjs")).href;
const pluginModule = await import(moduleUrl + "?test=" + Date.now());

assert.equal(typeof pluginModule.default, "function");

const PLUGIN_NAME = "user-polarrecorder";
const OWN_APP_URL = "/plugins/" + PLUGIN_NAME + "/viewer/viewer.html";

function makeApi() {
  const registrations = [];
  return {
    registrations,
    getPluginName() {
      return PLUGIN_NAME;
    },
    registerUserApp(name, url, icon, title) {
      registrations.push({ name, url, icon, title });
      return "ignored-registration-id";
    }
  };
}

function withFetch(impl, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(function () {
    globalThis.fetch = previous;
  });
}

function jsonResponse(payload) {
  return Promise.resolve({
    ok: true,
    json() {
      return Promise.resolve(payload);
    }
  });
}

// An api without the modern registration surface stays a no-op.
const inertResult = await pluginModule.default({ marker: "fake-avnav-api" });
assert.equal(inertResult, undefined);

// Mixed/legacy host: the app is already published from plugin.json, so the
// module path must not register a second AddOn entry.
const mixedApi = makeApi();
await withFetch(
  function () {
    return jsonResponse({
      items: [{ url: OWN_APP_URL, source: "plugin-" + PLUGIN_NAME }]
    });
  },
  function () {
    return pluginModule.default(mixedApi);
  }
);
assert.deepEqual(mixedApi.registrations, []);

// Modern-only host: plugin.json is ignored, so the app is absent from the
// server list and the module path must register it.
const modernApi = makeApi();
await withFetch(
  function () {
    return jsonResponse({
      items: [{ url: "/plugins/other-plugin/viewer/index.html", source: "plugin-other" }]
    });
  },
  function () {
    return pluginModule.default(modernApi);
  }
);
assert.deepEqual(modernApi.registrations, [
  {
    name: "polarrecorder",
    url: "viewer/viewer.html",
    icon: "viewer/icon.svg",
    title: "Polar Recorder"
  }
]);

// Host without the core addon list endpoint: the request fails, and the module
// path falls back to registering the app.
const noEndpointApi = makeApi();
await withFetch(
  function () {
    return Promise.reject(new Error("no addon endpoint"));
  },
  function () {
    return pluginModule.default(noEndpointApi);
  }
);
assert.equal(noEndpointApi.registrations.length, 1);

console.log("plugin entrypoint contract test passed.");
