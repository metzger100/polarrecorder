/**
 * Contract test pinning .prettierrc.json to the shared, paired-repository shape so a future
 * local edit that breaks shared-file identity fails a gate instead of drifting silently.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

const SHARED_PRETTIER_CONFIG = {
  arrowParens: "always",
  bracketSpacing: true,
  printWidth: 120,
  proseWrap: "always",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "none",
  useTabs: false
};

test("committed .prettierrc.json matches the shared converged shape", () => {
  const raw = fs.readFileSync(path.join(ROOT, ".prettierrc.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, SHARED_PRETTIER_CONFIG, ".prettierrc.json drifted from the shared converged shape");
});

test("the shared shape rejects a config missing a key", () => {
  const { proseWrap, ...incomplete } = SHARED_PRETTIER_CONFIG;
  assert.ok(proseWrap, "proseWrap must be present in the shared shape");
  assert.notDeepEqual(incomplete, SHARED_PRETTIER_CONFIG);
});

test("the shared shape rejects a config with a drifted value", () => {
  const drifted = { ...SHARED_PRETTIER_CONFIG, printWidth: 100 };
  assert.notDeepEqual(drifted, SHARED_PRETTIER_CONFIG);
});
