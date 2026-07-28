/**
 * Self-tests for tools/check-test-focus.mjs, the JavaScript focused/
 * disabled-test blocker. Every negative case is exercised via an in-memory temp
 * workspace fixture rather than a committed one, per this project's fixture-provenance
 * convention (a committed fixture is unnecessary here).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import { runTestFocusCheck } from "../../tools/check-test-focus.mjs";

/**
 * @param {string} source
 * @returns {string}
 */
function makeFakeRoot(source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-test-focus-"));
  fs.mkdirSync(path.join(root, "tests", "js"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  fs.writeFileSync(path.join(root, "tests", "js", "fixture.test.mjs"), source);
  return root;
}

test("a clean file with real test() calls passes", () => {
  const root = makeFakeRoot(
    'import { test } from "vitest";\n' + 'test("does the thing", () => {\n' + "  // real assertions go here\n" + "});\n"
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a comment mentioning .only/.skip is not a false positive", () => {
  const root = makeFakeRoot(
    "// Do not use test.only(...) or test.skip(...) here -- see review notes.\n" +
      '/* test.todo("later") is also fine to mention in prose. */\n' +
      'import { test } from "vitest";\n' +
      'test("still runs", () => {});\n'
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a string literal mentioning .only/.skip is not a false positive", () => {
  const root = makeFakeRoot(
    'import assert from "node:assert/strict";\n' +
      'import { test } from "vitest";\n' +
      'test("checks failure text", () => {\n' +
      '  assert.ok("expected test.only(...) to be forbidden".includes("only"));\n' +
      "});\n"
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("test.only(...) fails", () => {
  const root = makeFakeRoot('import { test } from "vitest";\ntest.only("focused", () => {});\n');
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("'.only(...)'")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("describe.skip(...) fails", () => {
  const root = makeFakeRoot(
    'import { describe, test } from "vitest";\n' +
      'describe.skip("group", () => {\n' +
      '  test("inner", () => {});\n' +
      "});\n"
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("'.skip(...)'")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("it.todo(...) fails", () => {
  const root = makeFakeRoot('import { it } from "vitest";\nit.todo("later");\n');
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("'.todo(...)'")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("Vitest's test.skipIf(...) conditional skip fails", () => {
  const root = makeFakeRoot(
    'import { test } from "vitest";\ntest.skipIf(process.platform === "win32")("conditional", () => {});\n'
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("'.skipIf(...)'")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("Vitest's describe.runIf(...) conditional skip fails", () => {
  const root = makeFakeRoot(
    'import { describe, test } from "vitest";\ndescribe.runIf(false)("group", () => {\n  test("inner", () => {});\n});\n'
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("'.runIf(...)'")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a non-test skipIf helper is not a false positive", () => {
  const root = makeFakeRoot(
    'import { test } from "vitest";\n' +
      "const platform = { skipIf: (value) => value };\n" +
      'test("uses an unrelated skipIf helper", () => {\n' +
      "  platform.skipIf(true);\n" +
      "});\n"
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a bare Jasmine/Jest-style focus alias fails", () => {
  const root = makeFakeRoot('fdescribe("group", () => {\n  xit("inner", () => {});\n});\n');
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("'fdescribe(...)'")));
  assert.ok(result.failures.some((f) => f.includes("'xit(...)'")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("Node test()'s { skip: true } options object fails", () => {
  const root = makeFakeRoot('import { test } from "vitest";\ntest("name", { skip: true }, () => {});\n');
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("{ skip: true }")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("Node test()'s { only: true } options object fails", () => {
  const root = makeFakeRoot('import { test } from "vitest";\ntest("name", { only: true }, () => {});\n');
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("{ only: true }")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a shebang-prefixed file still parses and reports correct line numbers", () => {
  const root = makeFakeRoot(
    "#!/usr/bin/env node\n" + 'import { test } from "vitest";\n' + 'test.only("focused", () => {});\n'
  );
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes(":3:")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("an unparseable file fails closed instead of silently passing", () => {
  const root = makeFakeRoot("this is not { valid javascript (((\n");
  const result = runTestFocusCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("could not parse")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("the real repo has no focused or disabled tests", () => {
  const result = runTestFocusCheck({ print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.ok(result.checkedFiles >= 15);
});
