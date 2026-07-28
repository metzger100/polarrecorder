/**
 * Contract test for the agent skill layer: `skills-lock.json` entry shape (a source, a
 * source type, and a 64-character hex hash per skill), the lock's hash matching the live
 * `.agents/skills/<name>/SKILL.md` content (so an edited skill file is caught as drift), and
 * every generic skill file being free of the paired repository's project-specific
 * vocabulary (widget/gauge/renderer/mapper/cluster/Dyninstruments/DyniComponents) -- the
 * concrete tokens that would make a skill un-liftable to a future greenfield generator.
 * Polar Recorder's own real paths and commands (server/polarrecorder/, npm run check:all,
 * etc.) are expected and are not project-specific tokens in this sense: these skills live
 * inside this repository's own `.agents/skills/`, adapted for use on this repository, not a
 * repository-agnostic package.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const ROOT = process.cwd();
const SKILLS_DIR = path.join(ROOT, ".agents", "skills");
const LOCK_PATH = path.join(ROOT, "skills-lock.json");
const HASH_PATTERN = /^[0-9a-f]{64}$/;

const FORBIDDEN_TOKENS = [
  "dyninstruments",
  "dynicomponents",
  "widget",
  "gauge",
  "mapper",
  "cluster",
  "renderer",
  "ratioDefaults",
  "rangeDefaults",
  "createRenderer"
];

/**
 * @param {string} name
 * @returns {string}
 */
function readSkillFile(name) {
  return fs.readFileSync(path.join(SKILLS_DIR, name, "SKILL.md"), "utf8");
}

/**
 * @param {string} content
 * @returns {string}
 */
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

test("skills-lock.json parses as the pinned shape", () => {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  assert.equal(lock.version, 1);
  assert.ok(lock.skills && typeof lock.skills === "object");
  assert.ok(Object.keys(lock.skills).length >= 5);
});

test("every lock entry has a source, a source type, and a 64-character hash", () => {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  for (const [name, entry] of Object.entries(lock.skills)) {
    assert.ok(typeof entry.source === "string" && entry.source.length > 0, `${name}: missing source`);
    assert.ok(typeof entry.sourceType === "string" && entry.sourceType.length > 0, `${name}: missing sourceType`);
    assert.ok(HASH_PATTERN.test(entry.computedHash), `${name}: computedHash is not a 64-character hex hash`);
  }
});

test("every locked skill's hash matches the live SKILL.md content", () => {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  for (const [name, entry] of Object.entries(lock.skills)) {
    const live = sha256(readSkillFile(name));
    assert.equal(live, entry.computedHash, `${name}: skills-lock.json is stale; recompute its hash`);
  }
});

test("a tampered skill file is detected as drift", () => {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  const tampered = readSkillFile("preflight") + "\nextra line\n";
  assert.notEqual(sha256(tampered), lock.skills.preflight.computedHash);
});

test("every generic skill file is free of the paired repository's specific vocabulary", () => {
  for (const name of ["preflight", "create-plan", "doc-sync", "scan-smells", "grill-me-repo"]) {
    const content = readSkillFile(name).toLowerCase();
    for (const token of FORBIDDEN_TOKENS) {
      assert.ok(!content.includes(token.toLowerCase()), `${name}: contains forbidden token '${token}'`);
    }
  }
});

test("a seeded forbidden token would be caught", () => {
  const seeded = "some skill text mentioning a DyniComponents widget renderer";
  const lowered = seeded.toLowerCase();
  assert.ok(FORBIDDEN_TOKENS.some((token) => lowered.includes(token.toLowerCase())));
});
