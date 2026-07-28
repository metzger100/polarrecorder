/**
 * Contract tests for vitest.config.mjs's project coverage.
 *
 * The runner's whole reason for replacing hand-enumerated npm file lists is that a new
 * test file must never be silently excluded from every gate. These assert that every
 * tracked tests/js test file is matched by at least one configured project, and that
 * the include/exclude patterns stay inside the glob subset the matcher below supports,
 * so a future pattern using unsupported syntax fails loudly instead of mis-matching.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

import vitestConfig from "../../vitest.config.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

/** @typedef {{name: string, include: string[], exclude: string[]}} ProjectPatterns */

/**
 * Only `*` (a run of non-separator characters) is supported. Anything else -- `**`,
 * `{a,b}`, `?`, `[...]`, `!` -- is rejected by the guard test below rather than
 * silently mishandled here.
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

/**
 * @param {string} file
 * @param {string[]} patterns
 * @returns {boolean}
 */
function matchesAny(file, patterns) {
  return patterns.some(function (pattern) {
    return globToRegExp(pattern).test(file);
  });
}

/** @returns {ProjectPatterns[]} */
function projectPatterns() {
  const projects = vitestConfig.test?.projects || [];
  return projects.map(function (project) {
    const config = /** @type {{test: {name: string, include?: string[], exclude?: string[]}}} */ (project).test;
    return { name: config.name, include: config.include || [], exclude: config.exclude || [] };
  });
}

/**
 * @param {string} file
 * @returns {string[]}
 */
function owningProjects(file) {
  return projectPatterns()
    .filter(function (project) {
      return matchesAny(file, project.include) && !matchesAny(file, project.exclude);
    })
    .map(function (project) {
      return project.name;
    });
}

/** @returns {string[]} */
function trackedTestFiles() {
  return fs
    .readdirSync(path.join(ROOT, "tests", "js"), { encoding: "utf8" })
    .filter(function (name) {
      return name.endsWith(".test.mjs");
    })
    .map(function (name) {
      return `tests/js/${name}`;
    })
    .sort();
}

test("at least one project is configured", () => {
  const projects = projectPatterns();
  assert.ok(projects.length > 0, "vitest.config.mjs must configure projects");
  for (const project of projects) {
    assert.ok(project.name, "every project needs a name");
    assert.ok(project.include.length > 0, `project ${project.name} needs include patterns`);
  }
});

test("every project pattern stays inside the supported glob subset", () => {
  for (const project of projectPatterns()) {
    for (const pattern of [...project.include, ...project.exclude]) {
      assert.ok(
        !/\*\*|[{}?[\]!]/.test(pattern),
        `project ${project.name} pattern "${pattern}" uses glob syntax this contract cannot verify`
      );
    }
  }
});

test("every tracked tests/js test file is claimed by exactly one project", () => {
  const files = trackedTestFiles();
  assert.ok(files.length > 0, "expected to discover test files");
  for (const file of files) {
    const owners = owningProjects(file);
    assert.equal(owners.length, 1, `${file} is claimed by ${owners.length} projects (${owners.join(", ") || "none"})`);
  }
});

test("the viewer and plugin families land in their own projects", () => {
  assert.deepEqual(owningProjects("tests/js/viewer-grid-editor.test.mjs"), ["viewer"]);
  assert.deepEqual(owningProjects("tests/js/plugin-entrypoints.test.mjs"), ["plugin"]);
  assert.deepEqual(owningProjects("tests/js/format-scope.test.mjs"), ["tools"]);
});

test("a test file matching no project would be detected", () => {
  assert.deepEqual(owningProjects("tests/other/stray.test.mjs"), [], "a file outside tests/js matches nothing");
});
