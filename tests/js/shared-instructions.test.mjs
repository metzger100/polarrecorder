/**
 * Contract test for AGENTS.md's `SHARED_INSTRUCTIONS` block: the markers exist, are
 * balanced, appear exactly once each, and the text they enclose is free of this
 * repository's own project-specific tokens (the AvNav/Polar-Recorder-specific vocabulary
 * that would make the block un-liftable to a different AvNav plugin's AGENTS.md). This is
 * the mechanism that makes "the block is generic" a checked claim rather than an assertion:
 * marking a section "shared" is worthless if nothing checks it.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const ROOT = process.cwd();
const AGENTS_PATH = path.join(ROOT, "AGENTS.md");

const BEGIN_MARKER = "<!-- BEGIN SHARED_INSTRUCTIONS -->";
const END_MARKER = "<!-- END SHARED_INSTRUCTIONS -->";

const PROJECT_SPECIFIC_TOKENS = [
  "polarrecorder",
  "polar recorder",
  "avnav",
  "plugin.py",
  "plugin.js",
  "plugin.mjs",
  "server/polarrecorder",
  "polar.json",
  "windy"
];

/**
 * @param {string} content
 * @returns {{begin: number, end: number}}
 */
function findMarkers(content) {
  return { begin: content.indexOf(BEGIN_MARKER), end: content.indexOf(END_MARKER) };
}

/**
 * @param {string} content
 * @returns {string}
 */
function extractSharedBlock(content) {
  const { begin, end } = findMarkers(content);
  return content.slice(begin + BEGIN_MARKER.length, end);
}

test("the real AGENTS.md has both markers, exactly once each, in order", () => {
  const content = fs.readFileSync(AGENTS_PATH, "utf8");
  const beginCount = content.split(BEGIN_MARKER).length - 1;
  const endCount = content.split(END_MARKER).length - 1;
  assert.equal(beginCount, 1, "BEGIN marker must appear exactly once");
  assert.equal(endCount, 1, "END marker must appear exactly once");
  const { begin, end } = findMarkers(content);
  assert.ok(begin >= 0 && end > begin, "BEGIN must precede END");
});

test("the enclosed block is non-empty and contains the mandatory preflight", () => {
  const content = fs.readFileSync(AGENTS_PATH, "utf8");
  const block = extractSharedBlock(content);
  assert.ok(block.trim().length > 0);
  assert.ok(block.includes("Mandatory Session Preflight"));
  assert.ok(block.includes("documentation/conventions/smell-prevention.md"));
});

test("the enclosed block is free of this repository's project-specific tokens", () => {
  const content = fs.readFileSync(AGENTS_PATH, "utf8");
  const block = extractSharedBlock(content).toLowerCase();
  for (const token of PROJECT_SPECIFIC_TOKENS) {
    assert.ok(!block.includes(token.toLowerCase()), `shared block contains project-specific token '${token}'`);
  }
});

test("a project-specific token placed inside the block is caught", () => {
  const seeded = `${BEGIN_MARKER}\nThis mentions plugin.py and AvNav directly, which is project-specific.\n${END_MARKER}`;
  const block = extractSharedBlock(seeded).toLowerCase();
  assert.ok(PROJECT_SPECIFIC_TOKENS.some((token) => block.includes(token.toLowerCase())));
});

test("a missing END marker is caught as unbalanced", () => {
  const seeded = `${BEGIN_MARKER}\nsome text\n`;
  const beginCount = seeded.split(BEGIN_MARKER).length - 1;
  const endCount = seeded.split(END_MARKER).length - 1;
  assert.equal(beginCount, 1);
  assert.equal(endCount, 0);
});

test("AGENTS.md stays at or below the 400 non-empty-line limit", () => {
  const content = fs.readFileSync(AGENTS_PATH, "utf8");
  const nonEmptyLines = content.split("\n").filter((line) => line.trim().length > 0);
  assert.ok(nonEmptyLines.length <= 400, `AGENTS.md has ${nonEmptyLines.length} non-empty lines`);
});
