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

### Phase A evidence

The baseline gate completed successfully before implementation. The following counts were emitted by repository-local
commands and are retained as regression inputs:

| Measurement                                                                                    |                          Baseline |
| ---------------------------------------------------------------------------------------------- | --------------------------------: |
| Repository files discovered by the local file inventory                                        |                               327 |
| Maintained text files after excluding generated archives, coverage, and execution-plan records |                               301 |
| Generic agent skills                                                                           |                                 5 |
| Tooling `.mjs` candidates                                                                      |                                46 |
| Quality-tool self-test references                                                              |                          78 files |
| Coverage per-file classifications                                                              |                                17 |
| Coverage family floors                                                                         |                                13 |
| Test-inventory classifications                                                                 |                                58 |
| Complexity baseline entries                                                                    | 0; strict direct policy is active |
| Release payload files                                                                          |                                61 |
| Generic/project/total pattern rules                                                            |                       21 / 8 / 29 |
| NPM-invoked `.mjs` entry points with `run*()` exports                                          |                           16 / 19 |
| Existing manifest entries                                                                      |                                 5 |

The suppression scan found these baseline occurrences: `eslint-disable` 4, TypeScript ignore-family 7, `prettier-ignore`
3, coverage-ignore-family 3, `# noqa` 29, Python type/mypy-ignore-family 10, and pattern-marker family 27. These include
policy prose and negative fixtures; Phase G replaces them with an actual-comment scanner and requires zero
maintained-source directives.

The standalone-reference scan produced 19 local text matches for generic checkout/path vocabulary. It retained no
identity, path, remote, branch, or comparison record. The local release archive dry-run passed with 61 runtime files; no
runtime artifact was modified. The normal `npm run check:all` baseline result was exit 0.

### Phase A candidate ledger

Every mandatory role has a concrete local owner. The initial Tier 1 classification is based on mechanism responsibility,
not current bytes; product paths, captured debt, runtime payloads, and local remediation text remain Tier 2 through
profiles or adapters.

| Mandatory role group                     | Initial Tier 1 candidates                                                                                                                                                               | Tier 2 boundary                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Contract, manifest, attestation          | `tools/check-shared-core.mjs`, `tools/quality-policy/portable-core-contract.json`, `tools/quality-policy/shared-core-manifest.json`, `tools/quality-policy/shared-core-manifest.sha256` | Local contract path resolution and entry inventory                  |
| Genericness and instructions             | `tools/check-generic-surface.mjs`, `tools/quality-policy/shared-instructions.md`, `.agents/skills/*/SKILL.md`                                                                           | Local token policy and skill lock data                              |
| Pattern engine and generic rules         | `tools/check-patterns.mjs`, `tools/check-patterns/*.mjs`, `tools/check-patterns/generic/*.mjs`                                                                                          | `tools/check-patterns/project/`, local scopes and remedies          |
| Pattern fixtures and tests               | `tests/js/check-patterns*.test.mjs`, `tests/js/pattern-suppression.test.mjs`                                                                                                            | Product fixtures and namespace assertions                           |
| File-size and focused-test mechanisms    | `tools/check-file-size*.mjs`, `tools/check-test-focus*.mjs`                                                                                                                             | Local scan roots and test language inventory                        |
| Schema and documentation-link mechanisms | `tools/check-schema.mjs`, `tools/check-doc-links*.mjs`                                                                                                                                  | Local schemas, documentation roots and link policy                  |
| Hooks and formatting                     | `tools/hooks-*.mjs`, `tools/quality-policy/run-format.mjs`, `tools/quality-policy/generate-format-scope.mjs`                                                                            | Local hook environment and formatter ownership                      |
| Complexity, coverage, test inventory     | `tools/quality-policy/eslint-complexity-config.mjs`, `tools/quality-policy/check-coverage-inventory.mjs`, `tools/quality-policy/test-inventory.mjs`                                     | Strict limits, captured floors, report adapters and classifications |
| Release orchestration                    | `tools/release-version.mjs`, `tools/release-archive.mjs`, `tools/release-git.mjs`, `tools/release-*.mjs`                                                                                | Runtime payload, filenames and local publisher environment          |
| Shared policy fixtures and tests         | `tests/js/*quality*.test.mjs`, `tests/js/*inventory*.test.mjs`, `tests/js/release-*.test.mjs`                                                                                           | Product behavior tests and captured local data                      |

No candidate was downgraded because of current implementation drift. Phase B begins the atomic contract migration.

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

### Phase B evidence

The contract migration is now fail-closed over 35 exact-byte manifest entries. The committed manifest signature is
`6a69f1cb667c57a911c84cc2e9d926f57b1e75775a23e67c1f6c392e3a945a24`; the contract is schema version 1 and core version
1.0.0. Targeted tests cover clean operation, missing files, digest drift, extra entries, escaping paths, invalid
signatures, checker export preconditions, missing self-tests, exact-byte instructions, deterministic anonymous
attestation, and the isolated-boundary scan. `node tools/check-shared-core.mjs` reports 35 checked entries and zero
findings. The golden attestation contains only `coreVersion`, `manifestSha256`, and `entries`.

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

### Phase C evidence

Genericness is contract-driven: the blocking scanner reads every text path in `mandatoryPaths`, validates the local
token profile at schema version 1, and has seeded clean/failing profile and token tests. The five local skill files and
the extracted instructions are byte-locked; the instruction test compares the marked block without trimming or
normalization. The blocking scan reports 36 targets and zero findings, the shared-core verifier reports 35 entries and
zero findings, and the full `npm run check:all` gate passed with 379 tooling tests, 359 Python tests, 48 viewer/plugin
tests, and unchanged coverage totals of 95.77% Python lines and 92.46% JavaScript lines.

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

### Phase D evidence

The canonical generic registry contains exactly 21 identifiers in the prescribed order, backed by a manifest-listed
canonical ID module and a clean corpus test. The registry fails closed if ordering or membership drifts; project rules
remain composed after the generic set, and the required gate invokes blocking mode. `npm run check:smells` reports zero
findings across 327 files, the genericness scan reports 38 clean manifest targets, and the full `npm run check:all` gate
passed with 382 tooling tests, 359 Python tests, 48 viewer/plugin tests, and unchanged coverage floors.

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

### Phase E evidence

The portable checker engines now cover file size, focused tests, schemas, documentation links, hooks, formatting,
complexity, coverage, test inventory, release policy, filesystem safety, JSON duplicate keys, and strict lint families;
each has clean and failing cases in the portable self-test suite. Profile validation rejects unknown schema versions and
fields, and release entry points expose `run*()` adapters without changing their command-line behavior. Format-scope
discovery reproduces 345 local classifications (230 Prettier, 90 Ruff, 25 explicitly validated unsupported files).
`npm run check:all` passed with 383 tooling tests, 359 Python tests, 48 viewer/plugin tests, and unchanged release
archive parity over 61 runtime files.

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

### Phase F evidence

The portable complexity policy keeps strict limits at complexity 10, statements 40, depth 4, and parameters 6, while
captured findings can only shrink. Coverage adapters now normalize finite 0–100 percentage summaries and reject
malformed data or empty floor inventories; the test-inventory engine rejects stale, missing, unknown, and duplicate live
paths. The local inventory remains 58 classifications, 17 per-file coverage classifications, and 13 family floors. The
full `npm run check:all` gate passed with 383 tooling tests, 359 Python tests, 48 viewer/plugin tests, 95.77% Python
lines, and 92.46% JavaScript lines.

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

### Phase G evidence

The maintained-surface suppression scan reports zero findings in every supported family: ESLint 0, TypeScript 0,
formatter 0, coverage 0, language-linter 0, type-checker 0, generic-checker 0, and boundary 0. The Tier 1 scanner
reports a clean tree, while generated Python and JavaScript negatives fail it; the standard ESLint configuration also
rejects a generated directive through `no-warning-comments` and `noInlineConfig`. Host API spellings are isolated in
`StoreBoundaryAdapter`, and the Python runtime contract gate receives its server path through the local package script
environment. The completed Phase G `npm run check:all` gate passed with 386 tooling tests, 359 Python tests, 47 viewer
tests, 1 plugin test, 95.78% Python lines, and 92.46% JavaScript lines. The shared-core check reports 39 exact-byte
entries and the blocking genericness scan reports 40 clean targets.

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

### Phase H evidence

Semantic-version validation, path containment, normalized payload parity, archive staging, archive content validation,
and Git status parsing are covered by reusable policy modules and local adapters. Release-focused tests pass, including
valid and invalid versions, path-escape rejection, order-independent parity, exact archive entry/content validation, and
runtime-only payload checks. The local archive dry-run and package gate both report the unchanged 61-file runtime
payload; no runtime payload, filename, version classification, or publish behavior changed. The release policy engine
and its manifest-listed portable self-test are covered by the 39-entry exact-byte manifest. The Phase H
`npm run check:all` gate is recorded after the release-policy test update.

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

### Phase I evidence

Standalone documentation now describes the versioned portable-core contract, exact-byte manifest/signature, Tier 1 and
Tier 2 boundary, adapter ownership, anonymous attestation, zero-inline-suppression policy, release parity, and the
isolated-copy gate. The synchronized touchpoints are `AGENTS.md`, `README.md`, `CONTRIBUTING.md`,
`documentation/conventions/quality-gates.md`, `coding-standards.md`, `smell-prevention.md`, `testing-infrastructure.md`,
and `documentation/guides/documentation-maintenance.md`. `docs:check`, the standalone boundary audit, blocking
genericness scan, suppression scan, and release dry-run all pass locally. The normal and isolated full gates, final
anonymous attestation comparison, and final manifest evidence are recorded below before the plan is archived.

## Final completion evidence

1. Contract version `1.0.0`; final manifest SHA-256 `e649d2f4947081f0023745adca9f37d5d4f2b7afc4f43add0b9a035cf1a894b1`.
2. Final Tier 1 role counts: manifest verifier 3, genericness scanner 1, instructions/skills 6, pattern core 9,
   file-size 1, focused-tests 1, schema 3, documentation-links 1, hooks 1, formatting 1, complexity 1, coverage 1,
   suppression scanner 1, test inventory 1, release 1, filesystem policy 3, self-tests 4. The manifest contains 39
   unique entries because shared self-test paths are owned by more than one role.
3. Fifteen canonical checker exports and three unique self-test files are contract-verified. The generic registry has 21
   identifiers; the local product registry has 8 rules composed after it.
4. Suppression counts are zero for ESLint, TypeScript, formatter, coverage, language-linter, type-checker,
   generic-checker, and boundary families.
5. Strict complexity limits are 10/40/4/6 with no active findings; captured baselines remain shrinking-only.
6. Coverage inventory remains 17 per-file classifications and 13 family floors; final coverage is 95.78% Python lines
   and 92.46% JavaScript lines.
7. The executable JavaScript test inventory has 61 strict classifications and 0 exceptions.
8. Documentation checks cover 42 Markdown files and 45 local links; standalone, genericness, and suppression scans
   report zero findings.
9. Normal `npm run check:all` exited 0; the fresh isolated-copy `npm run check:all` also exited 0. Two consecutive
   anonymous attestation outputs were byte-identical; their output SHA-256 is
   `cc5ae5fec2a8cd5e6a74650c668a1526b40d3a9cf7d3b51803a18e619b7a24ff`, with 39 entries and the manifest digest above.
10. Local release archive validation preserves the exact 61-file runtime payload and content parity.

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
