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
assert.doesNotThrow(function () {
  pluginModule.default({ marker: "fake-avnav-api" });
});

const registrations = [];
const result = pluginModule.default({
  registerUserApp(button, app, page) {
    registrations.push({ button, app, page });
    return "ignored-registration-id";
  }
});

assert.equal(result, undefined);
assert.deepEqual(registrations, []);

console.log("plugin entrypoint contract test passed.");
