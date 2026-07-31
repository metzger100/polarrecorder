/**
 * Self-test for `tools/check-doc-links-proof.mjs`: it is itself the fixture proof that
 * `check-doc-links.mjs` fails closed (a clean fixture passes, a broken one is caught), so this
 * test just asserts that proof currently holds.
 */

import assert from "node:assert/strict";
import { test } from "vitest";

import { runDocLinksProof } from "../../tools/check-doc-links-proof.mjs";

test("the clean-vs-broken doc-links fixture proof passes", async () => {
  const result = await runDocLinksProof({ print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
});
