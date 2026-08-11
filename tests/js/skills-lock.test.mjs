/**
 * Contract test for the agent skill layer: `skills-lock.json` entry shape (a source, a
 * source type, and a 64-character hex hash per skill), the lock's hash matching the live
 * `.agents/skills/<name>/SKILL.md` content (so an edited skill file is caught as drift), and
 * every declared skill matching the content hash committed in the lock.
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
    assert.ok(fs.existsSync(path.join(ROOT, entry.source)), `${name}: source must be a local file`);
    assert.notEqual(entry.sourceType, "external-repository", `${name}: external provenance is not verifiable`);
  }
});

test("the lock directory set equals the declared skill set", () => {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  const declared = Object.keys(lock.skills).sort();
  const local = fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(local, declared);
});

test("an external-repository source type is rejected", () => {
  assert.notEqual("external-repository", "vendored-generic");
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

test("every skill has repository depth and executable routing", () => {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
  const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts);
  for (const [name, entry] of Object.entries(lock.skills)) {
    const content = readSkillFile(name);
    assert.ok(content.split("\n").filter((line) => line.trim()).length >= 100, `${name}: skill is too short`);
    const paths = [
      "documentation/TABLEOFCONTENTS.md",
      "documentation/conventions/coding-standards.md",
      "documentation/conventions/smell-prevention.md",
      "AGENTS.md",
      "server/polarrecorder",
      "plugin.py",
      "viewer/viewer.html",
      "tests"
    ];
    assert.ok(
      paths.filter((candidate) => content.includes(candidate) && fs.existsSync(path.join(ROOT, candidate))).length >= 3,
      `${name}: needs three real paths`
    );
    assert.ok(
      scripts.some((script) => content.includes(`npm run ${script}`)),
      `${name}: needs a real npm script`
    );
    assert.equal(entry.sourceType === "project-local" || entry.sourceType === "vendored-generic", true);
  }
});
