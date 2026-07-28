/**
 * Vitest configuration for the polarrecorder-dev-tooling JavaScript test surface.
 * Projects are defined by include patterns, not file lists, so a new test file under
 * tests/js/ is picked up automatically instead of silently excluded from every gate.
 *
 * Coverage uses the native V8 provider. Its AST-aware remapping counts only genuinely
 * executable statements, so viewer/*.js percentages are lower than the line-based
 * approximation that preceded it even though the covered code is identical; the
 * per-file floors in tools/quality-policy/coverage-floors.json are unchanged and are
 * enforced by check-coverage-inventory.mjs off the json-summary report written here.
 */
import { defineConfig } from "vitest/config";

const VIEWER_TESTS = ["tests/js/viewer-*.test.mjs"];
const PLUGIN_TESTS = ["tests/js/plugin-*.test.mjs"];
const TOOLS_TESTS = ["tests/js/*.test.mjs"];
const TOOLS_EXCLUDE = [...VIEWER_TESTS, ...PLUGIN_TESTS];

// Project configs do not inherit the root `test` options, so every project repeats this.
// Some tool self-tests spawn a whole `check:core` run against a fixture workspace, which
// takes several seconds; the default 5s timeout fails them on a loaded machine.
const TEST_TIMEOUT_MS = 60000;

export default defineConfig({
  test: {
    allowOnly: false,
    testTimeout: TEST_TIMEOUT_MS,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/viewer",
      reporter: ["text", "json-summary"],
      include: ["viewer/*.js", "plugin.js", "plugin.mjs"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 65
      }
    },
    projects: [
      {
        test: {
          name: "tools",
          allowOnly: false,
          testTimeout: TEST_TIMEOUT_MS,
          environment: "node",
          include: TOOLS_TESTS,
          exclude: TOOLS_EXCLUDE,
          fileParallelism: false
        }
      },
      {
        test: {
          name: "viewer",
          allowOnly: false,
          testTimeout: TEST_TIMEOUT_MS,
          environment: "node",
          include: VIEWER_TESTS,
          fileParallelism: false
        }
      },
      {
        test: {
          name: "plugin",
          allowOnly: false,
          testTimeout: TEST_TIMEOUT_MS,
          environment: "node",
          include: PLUGIN_TESTS
        }
      }
    ]
  }
});
