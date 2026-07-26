/**
 * Entry-contract test for `plugin.js` (legacy stub) and `plugin.mjs` (modern AvNav
 * module entrypoint). Proves the modern entrypoint never registers a user app itself
 * and resolves to `undefined` regardless of the AvNav API it is handed.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

test("plugin.js loads inertly and plugin.mjs never registers a user app", async () => {
  const legacyPath = path.join(process.cwd(), "plugin.js");
  const legacySource = fs.readFileSync(legacyPath, "utf8");
  assert.doesNotThrow(function () {
    vm.runInNewContext(legacySource, {}, { filename: legacyPath });
  });

  const moduleUrl = pathToFileURL(path.join(process.cwd(), "plugin.mjs")).href;
  const pluginModule = await import(moduleUrl + "?test=" + Date.now());

  assert.equal(typeof pluginModule.default, "function");

  // The module is a no-op: user-app registration is owned by the Python backend
  // (plugin.py calls api.registerUserApp), and the modern frontend appends
  // module-registered apps to the server addon list without de-duplication. The
  // module must therefore never register a user app itself, regardless of the api
  // it is handed, and must resolve to undefined.
  function registrationTrap() {
    throw new Error("plugin.mjs must not register a user app");
  }

  const strictApi = {
    registerUserApp: registrationTrap,
    getPluginName() {
      return "polarrecorder";
    }
  };

  const strictResult = await pluginModule.default(strictApi);
  assert.equal(strictResult, undefined);

  const inertResult = await pluginModule.default(undefined);
  assert.equal(inertResult, undefined);
});
