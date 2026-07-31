# Finalize the Standalone Portable Quality Core

## Status

Active. This plan finalizes the repository's quality system as a standalone adopter of a canonical portable core.

This plan is intentionally repository-neutral and self-contained. It applies only to the checkout containing it. No
committed tool, test, configuration, documentation page, comment, plan evidence, or generated artifact may name, locate,
read, or depend on another checkout. Coordination occurs only through anonymous content digests emitted by a local
attestation command; repository files never store another adopter's identity or filesystem location.

The following decisions are prescriptive:

1. The mandatory portable-core inventory and artifact roles in this plan.
2. The separation between canonical Tier 1 implementation and project-owned Tier 2 data/adapters.
3. The 21 canonical generic rule identifiers.
4. Fail-closed manifest, genericness, suppression, and standalone-boundary behavior.
5. The prohibition on downgrading a mandatory Tier 1 candidate merely because its current bytes differ from the approved
   core.
6. Independent local gates and anonymous digest attestation as the only coordination mechanism.

Internal helper names and file splits may change when necessary to satisfy the 400-line and complexity limits, but the
observable contracts and exit conditions may not be weakened. Repository rules and core principles outrank this plan.

---

## Goal

Finish the repository as an independently runnable product repository with a complete, reusable, byte-locked quality
core and a clearly separated local profile.

Expected outcomes:

- `tools/quality-policy/portable-core-contract.json` is the authoritative, versioned inventory of mandatory Tier 1 roles
  and paths.
- `tools/quality-policy/shared-core-manifest.json` contains every Tier 1 artifact and no Tier 2 artifact.
- `tools/quality-policy/shared-core-manifest.sha256` anchors the exact manifest bytes without a circular self-hash.
- `npm run check:shared-core` verifies the contract, manifest signature, every entry digest, inventory completeness,
  path containment, and checker/self-test preconditions.
- `npm run portable-core:attest` emits only the contract version, manifest digest, and sorted entry digests. It emits no
  product name, repository name, branch, remote, user path, or checkout location.
- The pattern engine, its generic rules, suppression parser, filesystem helpers, and generic fixture corpus are Tier 1
  and contain no product concepts.
- The 21 generic rule identifiers and classifications are canonical and locked by shared tests.
- File-size, focused-test, schema, documentation-link, hook, formatting, complexity, coverage-inventory, test-inventory,
  and release-orchestration mechanisms use canonical Tier 1 implementations with Tier 2 profiles or adapters for local
  paths and formats.
- Every canonical checker exports a `run*()` entry point and has clean and failing self-tests.
- Required gates are fail-closed: no required command uses warning mode, an empty discovery root, caller-optional
  inventory input, a dynamically computed expected digest, or whitespace-normalized byte comparison.
- Inline lint, type, format, coverage, and checker suppression comments are exactly zero across maintained source.
- Product runtime behavior, public APIs, packaging contents, coverage floors, complexity limits, and release semantics
  remain unchanged.
- All repository documentation and comments are self-contained and contain no external-checkout identity, path, or
  coordination narrative.
- `npm run check:all` passes from an isolated copy containing only this repository.

---

## Verified Baseline

Verified against the current worktree on 2026-07-31.

1. `npm run check:all` exits 0 in the current checkout.
2. `tools/quality-policy/shared-core-manifest.json` contains exactly five entries.
3. The manifest contains zero `.mjs` checker entries and zero `.agents/skills/**/SKILL.md` entries.
4. `npm run check:shared-core` reports success over those five entries, so its current success does not prove a complete
   portable quality implementation.
5. `tools/check-patterns/rules.mjs` currently exposes exactly 21 generic rule identifiers.
6. Five generic agent skills exist locally: `preflight`, `create-plan`, `doc-sync`, `scan-smells`, and `grill-me-repo`.
7. `tools/quality-policy/shared-instructions.md` exists and is locally checked against the marked instructions block,
   but neither artifact is represented by the current manifest.
8. `tools/check-shared-core.mjs` and `tools/check-generic-surface.mjs` exist and have local tests, but neither checker
   is itself byte-locked by the manifest.
9. The current manifest has no canonical contract file defining mandatory Tier 1 paths, so unlisted-candidate detection
   can be vacuous while the local gate remains green.
10. The current quality documentation calls the manifest authoritative even though it inventories no quality checker.
11. The current repository has no anonymous portable-core attestation command.
12. The current repository has no complete fail-closed check proving that tools, documentation, comments, and package
    scripts are independent of every external checkout.
13. The current generic rule scopes, remedies, runtime paths, coverage formats, and captured debt already have natural
    project-owned boundaries, but those boundaries are not yet expressed through one canonical adapter interface.
14. Active execution plans are formatter-owned and archival completed plans are not; this plan must remain active until
    every completion criterion is evidenced.

Phase A must append exact local counts for suppression comments, portable-core candidate paths, baseline entries,
coverage classifications, test classifications, checker exports, and self-tests before implementation begins. Those
counts become regression inputs; they may shrink where this plan requires cleanup and may not be hidden by exclusions.

---

## Canonical Portable-Core Contract

### Tier definitions

- **Tier 1 — canonical implementation.** Product-neutral implementation, tests, fixture corpus, instructions, skills,
  schemas, and policy constants. Every Tier 1 file is listed with SHA-256 in the manifest.
- **Tier 2 — local profile or adapter.** Product paths, source globs, namespace tokens, schema composition, coverage
  report readers, baseline data, release staging lists, workflow environment, and local remedy text. Tier 2 files are
  schema-validated by Tier 1 code but are not byte-locked by the portable manifest.
- **Tier 3 — product implementation.** Runtime, UI, domain, integration, product tests, product documentation, and
  release payloads. Tier 3 behavior is outside the portable-core identity surface and must remain behaviorally stable.

### No-downgrade rule

A mandatory Tier 1 path may move only to another Tier 1 path declared by an atomic contract migration. Current byte
difference, local path usage, or a failing portability scan is never evidence that an artifact belongs in Tier 2.
Instead, split product data or behavior into a Tier 2 profile/adapter and keep the mechanism in Tier 1.

A Tier 1-to-Tier 2 reclassification is allowed only when all of the following are recorded before the change:

1. The artifact's behavior is inherently product behavior rather than a quality mechanism.
2. A canonical Tier 1 consumer interface remains sufficient for a clean-room adopter.
3. Positive and negative tests prove the interface without importing the local implementation.
4. The contract version changes and the removal is visible in the anonymous attestation.

### Mandatory Tier 1 roles

The contract must resolve each role to one or more concrete paths:

1. Manifest verifier, manifest contract, manifest signature verifier, and anonymous attestation emitter.
2. Genericness scanner and generic-surface policy schema.
3. Shared instructions and the five generic agent skills.
4. Pattern runner, filesystem/path-containment layer, suppression parser, lexical/AST helpers, rule-policy composer,
   generic rule definitions, generic rule implementations, and generic fixture corpus.
5. File-size/oneliner checker and fixture corpus.
6. Focused-test checker and fixture corpus.
7. Schema-checking framework and profile schema.
8. Documentation-link checker and proof fixtures.
9. Hook installer/doctor framework and hook contract tests.
10. Formatting runner, format-scope generator, and profile schema.
11. Complexity scanner/policy engine and profile schema.
12. Coverage-inventory engine, coverage adapter interface, summary normalizer, and profile schema.
13. Test-inventory engine and profile schema.
14. Release version/path/archive orchestration interfaces and shared semantic-version corpus.
15. Shared strict lint rules and reusable configuration builders.
16. Portable-core self-tests and negative fixtures for every canonical checker.

The contract may add roles but may not omit these roles without a versioned contract change satisfying the no-downgrade
rule.

### Canonical generic rule identifiers

The Tier 1 rule registry contains exactly these names, with product-specific scopes and remedies supplied by Tier 2:

1. `absolute-home-path`
2. `exec-plan-reference`
3. `no-nul-byte`
4. `unsafe-html-dom-sink`
5. `dead-code`
6. `console-in-runtime`
7. `default-truthy-fallback`
8. `redundant-null-type-guard`
9. `empty-catch`
10. `premature-legacy-support`
11. `unused-fallback`
12. `responsive-layout-hard-floor`
13. `canvas-api-typeof-guard`
14. `try-finally-canvas-drawing`
15. `todo-without-owner`
16. `duplicate-functions`
17. `duplicate-block-clones`
18. `catch-fallback-without-suppression`
19. `internal-contract-fallback`
20. `framework-method-typeof-guard`
21. `invalid-lint-suppression`

Product rules remain Tier 2 and compose after this exact Tier 1 list.

### Manifest and attestation format

`portable-core-contract.json` owns:

- `schemaVersion`
- `coreVersion`
- `mandatoryRoles`
- `mandatoryPaths`
- `metadataPaths`
- `profileSchemas`
- `canonicalRuleIds`
- `requiredCheckerExports`
- `requiredSelfTestRoles`

`shared-core-manifest.json` owns sorted `{ path: sha256 }` entries for all Tier 1 paths except its two metadata files.
`shared-core-manifest.sha256` contains the literal SHA-256 of the manifest bytes. The verifier checks the signature
first, then parses the manifest and contract, then checks completeness and entry bytes.

`portable-core:attest` prints deterministic JSON containing only:

```json
{
  "coreVersion": "<version>",
  "manifestSha256": "<sha256>",
  "entries": { "<path>": "<sha256>" }
}
```

The command must be deterministic, offline, and independent of Git metadata.

---

## Hard Constraints

### Standalone repository boundary

- No gate, test, script, configuration, documentation page, comment, plan evidence, or generated artifact may read a
  path outside the current repository root.
- Resolve and realpath every policy-supplied path; reject absolute paths, `..` escapes, symlink escapes, and missing
  roots before reading.
- No committed text may name or locate an external checkout or describe cross-checkout coordination.
- No package script may depend on an environment variable containing another checkout's path.
- Anonymous attestation comparison happens outside repository execution and leaves no identity/path record in the
  repository.
- A clean isolated copy with no neighboring directories must pass all required gates.

### Quality integrity

- Do not lower thresholds, remove coverage classifications, weaken strict typing, skip tests, widen ignore globs, add
  warning-only required gates, or add suppressions to reach green.
- Required commands must fail on malformed/missing profiles and empty mandatory inventories.
- Byte assertions compare exact bytes. `.trim()`, newline normalization, case folding, and runtime-derived expected
  values are forbidden for identity assertions.
- Every expected digest in a test or signature is a committed literal, never computed from the file under test.
- Negative fixtures must prove each fail-closed path.
- Every phase ends with `npm run check:all` green.

### Product preservation

- No intentional change to runtime behavior, public APIs, user configuration, UI behavior, data formats, persistence,
  packaging contents, release filenames, platform support, or host integration.
- Release parity is established locally against a pre-change artifact or normalized payload capture.
- Project-owned baselines may shrink only when real debt is removed; they may never grow or loosen.
- Tier 2 profiles may describe local behavior but may not reimplement Tier 1 algorithms.

### File organization

- All maintained code and documentation obey the repository's 400-line rule.
- Split generic mechanisms from local adapters before either file approaches the limit.
- Tier 1 modules may import only Tier 1 modules or a declared adapter interface; they may not import a Tier 2
  implementation directly.
- Tier 2 adapters are loaded through a fixed canonical interface and validated before use.
- No duplicate fallback implementation is permitted when a canonical helper exists.

---

## Affected Areas

Expected Tier 1 work includes, but is not limited to:

- `.agents/skills/{preflight,create-plan,doc-sync,scan-smells,grill-me-repo}/SKILL.md`
- `tools/check-shared-core.mjs`
- `tools/check-generic-surface.mjs`
- `tools/check-patterns.mjs`
- `tools/check-patterns/generic/`
- a product-neutral pattern-core helper directory
- `tools/check-file-size.mjs` and oneliner helpers
- `tools/check-test-focus.mjs`
- `tools/check-schema.mjs`
- `tools/check-doc-links.mjs`
- `tools/check-doc-links-proof.mjs`
- `tools/hooks-install.mjs`
- `tools/hooks-doctor.mjs`
- `tools/quality-policy/run-format.mjs`
- `tools/quality-policy/generate-format-scope.mjs`
- `tools/quality-policy/complexity-scan.mjs`
- `tools/quality-policy/check-coverage-inventory.mjs`
- `tools/quality-policy/test-inventory.mjs`
- shared release orchestration modules and semantic-version corpus
- shared strict lint/configuration helpers
- `tests/portable-core/`
- `tools/quality-policy/portable-core-contract.json`
- `tools/quality-policy/shared-core-manifest.json`
- `tools/quality-policy/shared-core-manifest.sha256`
- `tools/quality-policy/shared-instructions.md`

Expected Tier 2 work includes project pattern profiles, path scopes, coverage adapters, baseline data, release staging
profiles, schema profiles, hook environment profiles, format scopes, test inventories, and local configuration entry
points.

Documentation touchpoints include `AGENTS.md`, `README.md`, `CONTRIBUTING.md` when present,
`documentation/conventions/quality-gates.md`, `coding-standards.md`, `smell-prevention.md`, `testing-infrastructure.md`,
`documentation/guides/documentation-maintenance.md`, and the documentation index only when files are added or moved.

---

## Implementation Order

### Phase A — Freeze the local contract and evidence

Intent: replace narrative assumptions with a complete, measured inventory before changing mechanisms.

Dependencies: none.

Deliverables:

1. Record the local counts requested at the end of Verified Baseline.
2. Enumerate every mandatory Tier 1 candidate by role and concrete path.
3. Record current checker exports, self-test owners, rule names, scopes, coverage/test/complexity baseline counts, and
   suppression counts.
4. Capture local release/package parity evidence without modifying runtime artifacts.
5. Add a temporary review ledger inside this plan for each candidate's target Tier and adapter boundary.
6. Record every current external-checkout reference in tracked text as cleanup input without copying those identities
   into new shipped files.

Exit conditions:

- `npm run check:all` exits 0.
- Every mandatory role has a concrete current or planned path.
- Every count is generated by a command, not estimated.
- No candidate is classified Tier 2 merely because it is currently noncanonical.

### Phase B — Establish the contract, standalone boundary, and manifest root

Intent: make inventory completeness and repository independence fail-closed before migrating implementations.

Dependencies: Phase A.

Deliverables:

1. Add `portable-core-contract.json`, its schema, and clean/malformed/missing-role tests.
2. Replace optional known-path and empty-root discovery with contract-derived mandatory paths.
3. Add `shared-core-manifest.sha256` and exact-byte signature verification.
4. Make `check-shared-core` reject missing, extra, duplicate, malformed, escaping, symlinked, or digest-drifted entries.
5. Add `portable-core:attest` with deterministic anonymous output and a golden fixture.
6. Add an isolated-copy contract proving required commands do not read outside the checkout.
7. Add a standalone-reference audit covering tracked documentation, comments, configuration notes, package scripts, and
   generated policy text.

Exit conditions:

- Targeted contract tests pass with negative fixtures for every failure mode.
- `npm run check:shared-core` fails until every currently declared Tier 1 path is correctly listed, then passes.
- The attestation contains no identity, path, Git, host, or timestamp fields.
- `npm run check:all` exits 0.

### Phase C — Canonicalize genericness, instructions, and skills

Intent: make the genericness boundary complete, local-profile-driven, and exact-byte checked.

Dependencies: Phase B.

Deliverables:

1. Replace product-name blocklists in Tier 1 with a product-neutral policy schema and a Tier 2 local-token profile.
2. Scan every manifest-listed text file automatically; do not maintain a second hard-coded Tier 1 module list.
3. Scan generic rule content, rendered semantics, shared instructions, and generic skills.
4. Make genericness blocking in required gates; warning mode remains available only as an explicitly exploratory command
   not used by `check:core` or `check:all`.
5. Make the marked instruction block and extracted artifact exact-byte equal without trimming or newline normalization.
6. Add the five skills, extracted instructions, genericness checker, policies, and their shared tests to the manifest.
7. Verify local skill-lock hashes from literal committed digests and reject nonlocal provenance fields.

Exit conditions:

- Required genericness command reports zero findings and exits nonzero on a seeded finding.
- Exact-byte instruction and skill checks pass.
- Every deliverable is manifest-listed with a valid digest.
- `npm run check:all` exits 0.

### Phase D — Canonicalize the pattern engine and 21 generic rules

Intent: extract one product-neutral pattern mechanism while preserving all local project rules through profiles.

Dependencies: Phase C.

Deliverables:

1. Split filesystem discovery, masking/parsing, suppression parsing, clone detection, rule composition, and output
   formatting into Tier 1 modules.
2. Split any product path, namespace, domain allowlist, scope, or remedy into Tier 2 profiles/adapters.
3. Implement the exact 21-name generic registry from the contract in canonical order and classification.
4. Keep product rules after the generic registry and prove their pre-migration finding sets unchanged.
5. Add a Tier 1 fixture corpus with clean and failing cases for every generic rule.
6. Ensure the runner exports `runPatternCheck`, supports blocking/warn severities for exploratory use, filters only
   structurally valid exceptions, and defaults declarative regex rules through one canonical runner.
7. Remove inline suppression debt rather than grandfathering it into the new engine.

Exit conditions:

- Canonical generic rule tests pass for all 21 identifiers.
- Local project-rule equivalence tests pass.
- `npm run check:smells` reports zero blocking findings.
- Every Tier 1 engine/rule/test file is manifest-listed and genericness-clean.
- `npm run check:all` exits 0.

### Phase E — Canonicalize standalone checkers and developer workflow mechanisms

Intent: converge the remaining general-purpose checkers behind validated local profiles.

Dependencies: Phase D.

Deliverables:

1. Canonicalize file-size/oneliner, focused-test, schema, documentation-link/proof, hook install/doctor, formatting, and
   format-scope mechanisms.
2. Move source globs, schema compositions, documentation roots, hook environment, formatter assignments, and local
   remediation text into Tier 2 profiles.
3. Require every checker entry point to export a `run*()` function.
4. Add Tier 1 clean/failing tests and fixture data for every checker.
5. Add checker/profile-schema compatibility versions and reject unknown versions or fields.
6. Make root configurations thin local entry points over Tier 1 base rules where the underlying tool supports it; use a
   canonical generator plus drift test otherwise.

Exit conditions:

- Each checker passes its shared clean fixture and fails its shared negative fixture.
- Local profiles validate and reproduce the pre-migration checked file sets.
- Hooks and formatting behavior remain locally identical.
- All Tier 1 implementations/tests are manifest-listed.
- `npm run check:all` exits 0.

### Phase F — Canonicalize complexity, coverage, and test inventory mechanisms

Intent: share policy algorithms without sharing captured debt or product report formats.

Dependencies: Phase E.

Deliverables:

1. Implement one complexity engine supporting strict empty-baseline mode and immutable captured-baseline mode through a
   Tier 2 profile.
2. Keep canonical strict limits in Tier 1 and assert all local linter/scanner settings equal them.
3. Implement one coverage-inventory engine over a canonical normalized summary model.
4. Define a versioned coverage-adapter interface; keep report readers and product families Tier 2.
5. Implement one test-inventory engine and schema; keep concrete file classifications and exception capture Tier 2.
6. Prove every baseline entry resolves to a live path and every exception is immutable, shrinking, and locally owned.
7. Prove empty baselines are strict defaults, never disabled checks.
8. Add mechanism, schema, adapter-contract, malformed-data, stale-entry, duplicate-entry, and regression fixtures.

Exit conditions:

- Complexity, coverage, and test-inventory targeted suites pass.
- Existing local limits, floors, classifications, and aggregate coverage are preserved or improved.
- No baseline grows and no threshold falls.
- Tier 1 mechanisms/tests are manifest-listed; Tier 2 data is absent from the manifest.
- `npm run check:all` exits 0.

### Phase G — Eliminate suppression comments across maintained source

Intent: make the intended zero-suppression state real across every maintained language and tool surface.

Dependencies: Phases D through F.

Deliverables:

1. Count and remove `eslint-disable`, TypeScript ignore/nocheck/expect-error, formatter-ignore, coverage-ignore,
   language-linter ignore, type-checker ignore, generic checker disable, and boundary-disable comments.
2. Fix typing, naming, import-order, security-fixture, and external-API boundary causes rather than weakening rules.
3. Use explicit boundary adapters when an external API spelling conflicts with local naming rules.
4. Move negative suppression fixtures to runtime-generated temporary files so maintained source contains no literal
   suppression comment.
5. Add two independent zero-suppression owners: a Tier 1 source scanner and the relevant standard linter configuration.
6. Scan production, tests, tools, configuration comments, documentation code examples, and active plans according to a
   documented maintained-surface policy.

Exit conditions:

- Whole-tree suppression count is exactly zero outside encoded fixture data.
- Both independent negative fixtures fail when a suppression is generated into a temporary maintained path.
- Strict source, test, tool, and local-language type/lint gates pass.
- No ignore list or threshold was widened.
- `npm run check:all` exits 0.

### Phase H — Converge release orchestration and preserve package semantics

Intent: make reusable release mechanics canonical while keeping the local payload profile standalone.

Dependencies: Phases E and F.

Deliverables:

1. Separate semantic-version handling, path safety, staging orchestration, archive validation, and Git command planning
   from the Tier 2 runtime payload list and environment profile.
2. Canonicalize the reusable release modules and corpus under the portable contract.
3. Preserve local release preparation and creation command behavior.
4. Compare normalized pre/post release payload paths, modes, and content digests locally.
5. Keep publisher workflows transport-only and repository-local.
6. Prove release tools reject path escapes and cannot discover or include files outside the checkout.

Exit conditions:

- Release-focused clean/failing tests pass.
- Normalized local release payload parity is exact.
- No runtime payload, filename, version classification, or publish behavior changes.
- Tier 1 release mechanisms/tests are manifest-listed.
- `npm run check:all` exits 0.

### Phase I — Synchronize standalone documentation and close out

Intent: make documentation describe only the final local architecture and finish with independent, reproducible proof.

Dependencies: all previous phases.

Deliverables:

1. Update quality-gate, coding-standard, smell, testing, maintenance, contributor, and README development guidance.
2. Document the Tier 1/Tier 2 boundary, contract versioning, manifest signature, adapter rules, anonymous attestation,
   zero-suppression policy, and isolated-copy gate.
3. Remove external-checkout identities, paths, comparison instructions, and coordination narratives from maintained
   documentation, comments, configuration notes, test descriptions, and generated policy text.
4. Replace historical authority language with standalone descriptions of current behavior.
5. Run the complete local gate from the normal checkout and a fresh isolated copy.
6. Emit the anonymous attestation and retain only the command output in the execution record.
7. Record exact final counts and gate results in this plan.
8. Move this plan to `exec-plans/completed/` only after every acceptance criterion passes.

Exit conditions:

- Documentation and standalone-reference checks pass.
- `npm run check:all` exits 0 in both the normal and isolated local copies.
- `npm run check:shared-core` and the blocking genericness check exit 0.
- Anonymous attestation is deterministic across two consecutive invocations.
- Every manifest entry has been exact-byte verified against its digest.
- No completion claim relies on a warning, partial gate, historical run, or external checkout.

---

## User-Facing Documentation Impact

No product behavior, configuration, installation, layout, data format, or platform-support documentation changes are
expected.

`README.md` must still be updated because the repository's contributor-visible development workflow changes. Its
development section must document `check:shared-core`, the blocking genericness command, anonymous attestation, and the
standalone isolated-copy expectation without discussing any external repository.

Required documentation updates:

- `documentation/conventions/quality-gates.md`
- `documentation/conventions/coding-standards.md`
- `documentation/conventions/smell-prevention.md`
- `documentation/conventions/smell-fix-playbooks.md` when suppression remedies change
- `documentation/conventions/testing-infrastructure.md`
- `documentation/guides/documentation-maintenance.md`
- `documentation/guides/exec-plan-authoring.md` only if the general plan contract changes
- `AGENTS.md`
- `CONTRIBUTING.md` when present
- `README.md` development workflow
- `documentation/TABLEOFCONTENTS.md` only when a maintained documentation file is added, moved, or removed

Documentation must explain the resulting interfaces as current standalone behavior. It must not cite this plan or any
phase as permanent authority.

---

## Acceptance Criteria

### Portable-core identity

- The contract and manifest contain every mandatory Tier 1 role and path.
- The manifest has at least one checker, one checker test, all five skills, shared instructions, generic rules, and all
  three policy mechanisms; a five-seed-only manifest is explicitly rejected.
- Manifest signature, entry digests, contract completeness, and path containment are fail-closed.
- No required inventory input is caller-optional or configured as an empty discovery root.
- Every Tier 1 file is genericness-clean and imports only permitted Tier 1 interfaces.
- Mandatory candidates were split behind adapters, not downgraded because of implementation drift.

### Generic rules and checkers

- Exactly 21 canonical generic rule identifiers exist in canonical order and classification.
- Product rules compose afterward and retain their local finding behavior.
- Every canonical checker exports `run*()` and has clean/failing Tier 1 tests.
- Required gates never invoke warning mode.
- Exact-byte assertions use literal expected bytes/digests without `.trim()` or runtime self-derivation.

### Policy mechanisms

- Complexity supports strict-empty and captured-baseline profiles without changing canonical limits.
- Coverage inventory consumes normalized adapter output and preserves every local floor/classification.
- Test inventory uses one canonical schema and preserves strict local ownership.
- Baselines are Tier 2, live-path checked, duplicate-free, immutable, and shrinking.

### Suppressions and standalone behavior

- Maintained source contains zero inline suppression comments of every supported language/tool family.
- Two independent owners reject a generated suppression fixture.
- No tracked documentation/comment/configuration note names or locates an external checkout.
- No required command reads or resolves outside the repository root.
- The isolated-copy full gate passes without neighboring directories or network access.

### Product and release preservation

- Runtime behavior and public contracts are unchanged.
- Coverage floors, complexity limits, typing strictness, and test scope are not weakened.
- Normalized local package/release payload parity is exact.
- No release or publish command gains an external repository dependency.

### Documentation and completion

- Documentation describes the local contract, adapters, gates, and workflow without cross-checkout narrative.
- README development guidance is synchronized.
- `npm run check:all`, `npm run check:shared-core`, blocking genericness, documentation, and standalone-boundary gates
  all pass.
- Anonymous attestation contains only the approved digest fields and is deterministic.
- The plan remains active until all evidence is recorded and no unexplained reclassification remains.

---

## Completion Evidence Template

Record the following before archiving the plan:

1. Contract version and manifest SHA-256.
2. Tier 1 entry count by role.
3. Canonical checker count and `run*()` export/self-test count.
4. Generic and product rule counts.
5. Suppression count by language/tool family, all zero.
6. Complexity baseline and active finding counts.
7. Coverage classification/floor counts and final coverage percentages.
8. Test inventory classification/exception counts.
9. Documentation/reference scan counts.
10. Normal and isolated `check:all` results.
11. Two consecutive anonymous attestation outputs with identical bytes.
12. Local release payload parity result.

Do not record repository names, remotes, branches, user paths, external checkout paths, or comparison commands in the
completion evidence.

---

## Related

- [Execution plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)
- [Repository instructions](../../AGENTS.md)
