# Correct the Canonical Portable Quality Core

**Status:** Completed.

## Goal

Restore a single, versioned, standalone portable quality core whose implementation, manifest, corpus, and anonymous
attestation are internally coherent. Local profiles and adapters must express only repository-specific scope and policy.

## Constraints

- Keep this checkout self-contained; maintained text must not name, locate, or depend on another checkout.
- Preserve the project runtime and its existing quality thresholds.
- Every policy engine that is declared portable must be exercised by the live quality gate through a local adapter.
- Every generic rule and checker needs an executable clean case and an executable failing case.
- The standalone policy applies to maintained plans as well as source, tools, configuration, and documentation.

## Phase 1: Establish the Canonical Core Boundary

1. Replace the divergent Tier 1 inventory with a concise, versioned canonical module layout.
2. Keep project-specific paths, threshold values, command composition, and integration details in validated local
   profiles or adapters outside that inventory.
3. Regenerate the manifest and anonymous attestation fixture from the exact canonical inventory.

**Exit conditions:** the manifest verifies; generic-surface validation is blocking; each live check reaches the
canonical implementation through its local adapter.

## Phase 2: Make Policy Engines Executable

1. Route file-size, focused-test, schema, documentation-link, hook, formatting, complexity, coverage, test-inventory,
   release, suppression, and standalone checks through canonical engines.
2. Retain local wrappers only for profile loading, native-tool invocation, and repository-specific reporting.
3. Add direct engine tests with one clean and one failing input for every engine and generic rule.

**Exit conditions:** tests invoke the real engine entry points, not text-presence facades; a broken corpus case fails
for the named rule or checker.

## Phase 3: Enforce the Standalone Boundary

1. Scan all maintained tracked text, including completed execution plans, while excluding generated and runtime-created
   fixtures only.
2. Remove historical checkout-identifying references from maintained plan prose without altering product behavior.
3. Prove root containment with isolated-copy tests for the commands that implement the portable quality core.

**Exit conditions:** the standalone checker detects both a textual boundary violation and an outside-root attempt in its
tests, and reports no findings for tracked maintained files.

## Phase 4: Align Documentation and Complete

1. Reconcile precedence documents with the zero-inline-suppression policy and describe the portable core as a local
   contributor workflow.
2. Update the contributor-facing README when quality workflow commands or guarantees change.
3. Run the complete quality gate, the standalone isolated-copy proof, manifest verification, and attestation.

**Exit conditions:** all checks pass without relaxed thresholds or suppressions; this plan records command output and is
moved to the completed plan archive with an accurate status.

## Validation

Run:

```sh
npm run check:shared-core
npm run check:generic-surface
npm run check:standalone-boundary
npm run check:suppressions
npm run portable-core:attest
npm run check:all
```

## Completion Evidence

- The signed version `2.0.0` manifest contains 20 exact canonical entries and verifies with zero findings.
- Every declared policy engine is called by a live local checker; direct corpus tests cover clean and failing behavior.
- The standalone and suppression scans cover maintained historical plans and report zero findings.
- `npm run check:all` completed successfully without threshold, suppression, or scope relaxation: 359 Python tests, 389
  tool tests, 48 viewer/plugin tests, and both coverage ratchets passed.
