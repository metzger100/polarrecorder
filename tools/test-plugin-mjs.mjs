#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(path.join(process.cwd(), "plugin.mjs")).href;
const pluginModule = await import(moduleUrl + "?test=" + Date.now());

assert.equal(typeof pluginModule.default, "function");
assert.doesNotThrow(function () {
  pluginModule.default({ marker: "fake-avnav-api" });
});

console.log("plugin.mjs contract test passed.");
