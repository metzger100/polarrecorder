# PLAN12 - Portable quality-core interoperability and starter foundation

## Status

Completed on 2026-07-31. The coordinated contract, attestation, generic-surface, starter, documentation, and validation work is complete.

## Goal

- Give both repositories one compatible portable-core contract and verifier semantics.
- Make the generic-surface scan cover the generic rule implementation tree fail-closed.
- Include contract interpreters in the attested inventory with negative proofs.
- Provide a small product-neutral starter path for new AvNav plugin repositories.
- Keep contributor-facing quality documentation synchronized with executable behavior.

## Verified Baseline

1. Both repositories attest the same 20 portable files at core version `2.0.0`.
2. Their contract JSON shapes and verifier implementations are incompatible despite that shared version.
3. Their contract-derived generic-surface scans omit unmanifested files below `tools/check-patterns/generic/`.
4. The verifier, generic-surface checker, and attestation entrypoint are outside the signed manifest.
5. Neither repository currently exposes a product-neutral starter-generation command.

## Hard Constraints

- Keep Python/server behavior, viewer behavior, release payload, coverage floors, and zero-debt complexity policy
  unchanged.
- Keep Tier 1 mechanisms product-neutral; repository tokens and scopes remain local profiles.
- Do not weaken, suppress, skip, or convert any blocking check to warning mode.
- Every new JavaScript or Markdown file stays below the 400-line limit.
- Each repository must remain independently verifiable without reading its sibling directory.

## Implementation Order

### 1. Canonical contract and attestation boundary

Intent: remove the versioned schema split and make the complete interpreter boundary attestable.

Dependencies: none.

Deliverables: compatible contract/schema semantics, manifest ownership of checker entrypoints, deterministic
attestation, and clean/failing self-tests.

Exit conditions: both shared-core checks pass; either verifier accepts the common contract shape; tampered interpreters
fail.

### 2. Fail-closed generic surface

Intent: scan generic rule implementations even when the contract inventory is present.

Dependencies: section 1.

Deliverables: recursive generic-rule scope and a negative injected-token test.

Exit conditions: clean scans pass and the negative probe fails with the injected file named.

### 3. Generic starter path

Intent: expose a minimal reusable starting point without copying either product implementation.

Dependencies: sections 1 and 2.

Deliverables: product-neutral starter command/template, validation tests, and contributor documentation.

Exit conditions: generated output is deterministic, contains no source-product token, and its documented quality command
passes.

### 4. Documentation and completion

Intent: synchronize the workflow contract and prove the migration end to end.

Dependencies: sections 1 through 3.

Deliverables: README and quality-gate updates, cross-repository probes, isolated-copy checks, full gates, and archived
completed plans.

Exit conditions: documentation checks and `npm run check:all` pass in both repositories; worktree diff is reviewed for
smells.

## User-Facing Documentation Impact

`README.md` changes are required because this adds a contributor-visible starter workflow. The quality-gate convention
must describe expanded attestation and generic-surface ownership.

## Acceptance Criteria

- The same contract version means the same accepted JSON shape in both repositories.
- Attestation changes when any contract interpreter or generic semantic owner changes.
- Generic rule files cannot evade the product-token scan.
- A novice-facing starter command creates a small plugin skeleton with a blocking quality check.
- Both complete local gates pass without policy reductions.

## Related

- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)

## Completion Evidence

- Both manifests contain the same 28 exact-byte entries at core version `3.0.0`.
- Each repository verifier accepts the other repository root with 28/28 entries and zero findings.
- Contract-derived genericness scans include every file below `tools/check-patterns/generic/` and fail on injected local tokens.
- Generated starter projects pass their dependency-free quality check and host-boundary test.
- `npm run check:all` passes in both repositories without suppressions or threshold changes.
