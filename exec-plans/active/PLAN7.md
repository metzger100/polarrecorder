# PLAN7 — Close quality-contract gaps and establish the final hybrid-profile role model

## Status

Written after repository verification and the cross-repository quality-system audit on 2026-07-27.

This plan closes the remaining Polar Recorder migration gaps: the complexity self-grandfathering escape, duplicated
command-graph work, an unbounded fast gate, non-portable actionlint checksum behavior, missing portable Codex
configuration, synchronized contributor documentation, and final mechanical alignment evidence with Dyninstruments.

The coding agent may choose equivalent focused-test names and file splits. Direct maintained-ESLint complexity
enforcement with no baseline, the public command meanings, exact top-level `check:fast` composition, one logical owner
per core concern, portable actionlint/Codex behavior, independent repository operation, and paired acceptance matrix
are prescriptive.

No pre-plan interview was run. The completed audit already resolved the relevant design branches, so this plan makes
these assumptions explicit:

1. Plugin runtime behavior, Python APIs, persistence, exports, viewer behavior, AvNav integration, packaging, and
   release artifacts remain unchanged.
2. This repository remains a Python/JavaScript hybrid **role model**, not a greenfield template. Creating a generic
   scaffolder, shared quality package, default remote-CI profile, or generic `doctor` command is separate future work.
3. The current local-first governance remains deliberate for this repository. The transport-only tag publisher stays
   transport-only; no PR workflow, CODEOWNERS file, branch ruleset, or pre-commit framework is introduced here.
4. Required gates must remain independently runnable and must never read the sibling Dyninstruments checkout.
5. The paired implementation plan is Dyninstruments
   `exec-plans/active/PLAN40.md — Close quality-contract gaps and establish the final viewer-profile role model`.
6. Common alignment means the same guarantees and contributor vocabulary, not byte-identical product-specific tools.

Repository rules and core principles outrank this plan. If implementation reveals a conflict, amend the active plan
with repository evidence instead of weakening a gate or silently improvising.

---

## Goal

Finish the Polar Recorder migration as an honest, extraction-ready hybrid-profile role model whose shared quality
contracts align with Dyninstruments and whose zero-complexity-debt policy cannot be bypassed by editing policy data.

Expected outcomes after completion:

- Shipped JavaScript complexity 10/40/4/6 limits are enforced directly by maintained ESLint rules.
- The empty mutable complexity baseline and its custom scanner/budget machinery are removed; coordinated source and
  policy edits cannot self-grandfather new debt.
- `check:fast` has the same bounded meaning in both exemplars: standard static checks, all typechecking, and a bounded
  unit-test selection, without exhaustive tool/contract suites, packaging, documentation, scaling, or coverage.
- `check:core` remains the complete non-coverage gate but reaches each logical smell owner exactly once.
- `check:all` remains exactly `check:core && test:coverage:check`, and `check:strict` remains its exact alias.
- `tools/actionlint.sh` either works on every advertised Linux/Darwin architecture with a portable checksum command or
  fails before advertising an unsupported platform.
- `.codex/config.toml` is portable and byte-identical to the paired exemplar.
- Contributor and quality documentation accurately describes the direct complexity owner, command graph, supported
  development platform, and role-model boundary.
- The current full quality gate, hook diagnostics, package checks, and paired mechanical comparison pass from clean
  worktrees.

---

## Verified Baseline

The following facts were rechecked against Polar Recorder
`265289dfbd5f640c9ebf788cae047535221aa43a` before this plan was written:

1. The worktree is clean on `main`, tracking `origin/main`, and `exec-plans/active/` contains no active plan other than
   marker/config files.
2. The completed audit ran `npm run check:all` successfully: 378 Python tests, 250 quality-tool tests, 26 viewer tests,
   and one plugin-entrypoint test passed.
3. The same gate reported 95.7723% combined Python coverage, 91.7508% exact Python branch coverage, and 93.43% viewer
   lines/statements with 79.38% viewer branches.
4. Node 26, npm 12.0.1, `packageManager = npm@12.0.1`, and all direct development dependencies are exact. Twelve common
   maintained-tool versions currently match Dyninstruments exactly.
5. `check:all` is exactly `npm run check:core && npm run test:coverage:check`; `check:strict` is exactly
   `npm run check:all`.
6. `check:core` already reaches the complete Python and Node suite through `test:split`.
7. `check:core` also invokes `check:smells` directly, while
   `test:split -> test:node -> test:contract -> check:smells` reaches the same script again. Static graph expansion
   therefore runs `check:patterns` and `check-smell-contracts.mjs` twice.
8. `check:fast` currently runs `check:standard`, `typecheck`, the full `test:split`, and
   `check:python-contracts`. It consequently reaches the exhaustive serialized `test:tools` suite; the audit observed
   that tool suite taking roughly 49 seconds on the verification host.
9. `tests/js/command-graph.test.mjs` locks the exact core graph and proves reachability/cycles, but it does not reject
   repeated logical leaves or define a bounded `check:fast` graph.
10. `tools/quality-policy/complexity-baseline.json` is empty, and all shipped JavaScript currently satisfies strict
    complexity 10, statements 40, depth 4, and parameters 6 limits.
11. `check:complexity` runs custom `complexity-budget.mjs`, which reads the editable baseline and calls the custom
    `complexity-scan.mjs`. The scanner delegates metric calculation to ESLint's own four rules.
12. `tests/js/complexity-budget.test.mjs` explicitly proves that an over-limit finding passes when a matching active
    baseline entry is supplied.
13. The audit copied the real checker into `/tmp`, added a seven-parameter shipped function, and confirmed it failed
    with an empty baseline. Adding the matching baseline entry without changing the violating source made the checker
    exit successfully.
14. No digest, immutable capture, or historical identity allowlist constrains the editable Polar baseline. Therefore
    the documented claim that new debt can never be baselined is false.
15. `eslint.config.mjs` already applies `@eslint/js` recommended and product rules to all maintained JavaScript, but it
    does not configure `complexity`, `max-statements`, `max-depth`, or `max-params`.
16. `tools/actionlint.sh` contains reviewed checksums for Linux/Darwin on amd64/arm64, but installation always calls
    `sha256sum`. Stock macOS supplies `shasum`, so the advertised Darwin branches are not executable as written.
17. Dyninstruments' actionlint owner already falls back from `sha256sum` to `shasum -a 256` and uses
    `#!/usr/bin/env bash`.
18. Polar Recorder tracks a zero-byte regular file named `.codex`; Dyninstruments has a configuration directory, but
    its current MCP block is Windows-specific and unpinned.
19. `schemas/avnav-plugin-base.schema.json` is byte-identical in both repositories, and both schema corpora contain the
    same generic valid and invalid case payloads.
20. `.github/workflows/publish-release.yml` is the only workflow. It is intentionally tag-only and pins
    `actions/checkout` v6.0.2 and `softprops/action-gh-release` v2.6.2 by reviewed commit SHA.
21. `.githooks/pre-push` invokes exactly one `npm run check:all`; `tools/check-all.sh` is a compatibility wrapper around
    the same command.
22. The development environment contract currently advertises only Linux x86_64 and Python `>=3.14,<3.15`, while
    shipped runtime code remains Python 3.9-compatible and stdlib-only.
23. `README.md` has 356 non-empty lines, close enough to the 400-line limit that its planned contributor update needs
    an explicit before/after size check and a focused split if necessary.
24. The next sequential execution-plan number is 7.

---

## Target Alignment Contract

The paired plans use this vocabulary. Profile-specific extensions are allowed only where shown.

| Interface                        | Shared meaning                                                             | Polar Recorder implementation                      |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| `setup`                          | Locked dependency install and checksum-verified tool provisioning          | npm, hash-locked Python venv, actionlint           |
| `check:fast`                     | Static standards, full typing, bounded unit tests                          | Exactly `check:standard && typecheck && test:unit` |
| `check:core`                     | Complete deterministic non-coverage repository gate                        | Full Python/Node split plus Python contracts       |
| `check:all`                      | Complete non-coverage gate plus native coverage enforcement                | Exactly `check:core && test:coverage:check`        |
| `check:strict`                   | Compatibility alias for the required final gate                            | Exactly `check:all`                                |
| `docs:check`                     | Markdown, link, shape, and reachability enforcement                        | Existing Node owners                               |
| `schema:check`                   | Generic AvNav base plus product-profile validation                         | Ajv base + server-plugin profile                   |
| `check:complexity`               | No new complexity debt                                                     | Direct ESLint 10/40/4/6, no baseline               |
| `check:scaling`                  | Deterministic counted-operation contracts                                  | Existing pytest contracts                          |
| `hooks:install` / `hooks:doctor` | Explicit local hook activation and diagnosis                               | Existing hook owners                               |
| release commands                 | Local gated artifact creation; tag workflow transports committed artifacts | Existing release owners                            |

`check:fast` is defined by graph scope, not a wall-clock promise. It must exclude `test:split`, `test:tools`,
`test:contract`, `check:python-contracts`, `test:coverage:check`, package/release validation, documentation checks,
complexity/scaling gates, and exhaustive checker self-tests.

`test:unit` may contain the ordinary Python product suite plus viewer/plugin behavior tests if those remain materially
bounded; it must not reach quality-tool self-tests or structural contract aggregates. If the ordinary Python suite
contains a proven slow integration family, introduce an explicit pytest unit/smoke selection rather than a timing
threshold.

---

## Architecture Notes

### Strict-zero-debt complexity needs no mutable exception owner

Polar Recorder has no current shipped complexity violation. The smallest fail-closed design is therefore direct ESLint
enforcement. A mutable baseline provides no legitimate capability and creates the exact bypass the policy claims to
forbid. Dyninstruments' digest-anchored historical ratchet remains valid for its real legacy debt and must not be copied
back into Polar Recorder.

### One concern should have one core path

`test:contract` should own structural product contracts; `check:smells` should own static and semantic smell
enforcement. Both remain part of `check:core`, but neither should call the other. This keeps direct developer commands
meaningful and prevents the recursive aggregate from repeating work.

### Alignment is semantic, not a copied tool tree

Polar Recorder keeps Python, Node's test runner, c8, Ruff, mypy, pytest, hash-locked Python setup, and server-plugin
policy. Dyninstruments keeps Vitest/V8/jsdom and its historical ratchets. Only public meanings, common maintained-tool
pins, generic schema cases, AI configuration, hook and release intent, and evidence vocabulary align.

### Role model is not greenfield output

The future generator should reuse the strict direct-complexity pattern, but it must be a separate artifact with its own
profiles and remote-CI choices. This plan finishes the exemplar; it does not turn the product repository into a
template.

---

## Hard Constraints

### Runtime and product behavior

- Do not modify `plugin.py`, `server/polarrecorder/`, `plugin.js`, `plugin.mjs`, `viewer/`, `plugin.css`, API contracts,
  persistence formats, exports, installer behavior, or AvNav runtime behavior except for deliberate negative test
  fixtures outside shipped paths.
- Preserve Python 3.9-compatible, stdlib-only runtime code and keep `plugin.py` as the sole AvNav boundary/lock owner.
- Do not add a runtime pip/npm dependency, bundler, runtime build, browser driver, or Playwright dependency.
- Do not change release ZIP contents or user-facing viewer output.

### Quality integrity

- Do not lower or delete coverage floors, hotspot budgets, file-size limits, strict test classifications, type checks,
  smell rules, documentation checks, package checks, or Python scaling contracts.
- Do not add a suppression, skipped/focused test, coverage exception, formatter ignore, or replacement complexity debt
  baseline.
- Direct complexity rules must apply to every shipped `viewer/*.js`, `plugin.js`, and `plugin.mjs` function and must not
  accidentally impose product thresholds on dev-tool/test functions.
- Every changed custom checker or provisioning branch needs a focused passing and failing test.
- Required gates remain deterministic, external-browser-free, and offline after successful setup.

### Repository independence and paired work

- No required script, hook, test, release command, or documentation checker may resolve `../dyninstruments`.
- The paired checkout may be read only by the final one-off alignment comparison, never by a committed gate.
- Do not create the future scaffolder, shared npm package, remote-CI profile, CODEOWNERS file, or generic project
  manifest in this plan.
- Do not broaden the supported Python/platform declaration without actually running and recording the complete setup
  and gate on each newly claimed platform.

### File organization

- Keep all maintained Python/JS/MJS/Markdown files below 400 non-empty lines; exec-plans remain exempt.
- `tests/js/command-graph.test.mjs` is already 235 non-empty lines. Split graph fixtures/helpers before it approaches 400.
- `README.md` is already 356 non-empty lines. Check it before and after documentation edits and split a stable,
  focused contributor/development document if it would approach 400; do not compress prose.
- Regenerate maintained inventories/scope files through their canonical commands after file deletion/rename.
- Keep active-plan prose inside `exec-plans/`; no shipped source, test name, config note, or documentation paragraph may
  cite this plan or its phases as authority.

---

## Implementation Order

### Phase A — Reconfirm the paired baseline and freeze the common contract

**Intent:** Prevent either implementation from landing against stale versions or different command meanings.  
**Dependencies:** None.

#### A1. Record standalone evidence

- Record HEAD, clean status, Node/npm/Python versions, `npm run hooks:doctor`, and the current
  `npm run check:all` result in this plan's completion-evidence section.
- Record current test counts, coverage summary, zero complexity findings/baseline entries, and coverage-inventory
  counts.

#### A2. Preserve the failing policy probe

- Re-run an isolated test using the current real complexity checker: empty baseline fails, matching edited baseline
  passes.
- Record only the command/result summary in this plan; do not commit `/tmp` artifacts.
- Treat that result as the negative behavior the replacement must make impossible.

#### A3. Compare paired common inputs

- Mechanically compare exact common dependency versions, Node/npm declarations, actionlint version/checksums, GitHub
  Action SHAs, generic AvNav schema, generic schema cases, and SemVer case payloads.
- Confirm the paired plan still specifies the same `check:fast`, `check:core`, Codex, independence, and role-model
  boundaries.
- If the sibling changed after this plan's verified commit, amend both active baselines before implementation.

**Exit conditions:**

- Both repositories start clean and pass their current required gates.
- The complexity escape is reproduced before its owner is removed.
- Every common target is recorded with no unexplained disagreement.

### Phase B — Replace the mutable complexity ratchet with maintained ESLint rules

**Intent:** Make the zero-debt policy structurally incapable of accepting a baseline entry.  
**Dependencies:** Phase A.

#### B1. Configure the direct owner

- Add a focused ESLint flat configuration for shipped runtime complexity, or an equivalently clear maintained-ESLint
  invocation, with error limits:
  - `complexity`: 10;
  - `max-statements`: 40;
  - `max-depth`: 4;
  - `max-params`: 6.
- Scope it exactly to `viewer/*.js`, `plugin.js`, and `plugin.mjs`, with the correct classic-script/module language
  options and globals.
- Keep `check:complexity` as the public focused leaf and make it execute ESLint directly with zero warnings allowed.
- Keep the complexity leaf independently callable from `check:core`; do not hide failure behind warn-level reporting.

#### B2. Remove the obsolete exception machinery

- Delete:
  - `tools/quality-policy/complexity-baseline.json`;
  - `tools/quality-policy/complexity-budget.mjs`;
  - `tools/quality-policy/complexity-scan.mjs`.
- Remove all associated format-scope, test-inventory, typecheck, test-runner, and documentation references.
- Do not replace the baseline with another JSON allowlist, digest, generated capture, inline ESLint suppression, or
  ignored path.

#### B3. Replace custom-budget tests with direct rule proofs

- Replace `tests/js/complexity-budget.test.mjs` with focused maintained-ESLint configuration tests.
- Prove one clean function passes and each of the four independent over-limit fixtures fails.
- Exercise classic `viewer/*.js`, legacy `plugin.js`, and module `plugin.mjs` scope.
- Prove an over-limit dev-tool fixture is outside the shipped-product limit unless it violates a separately configured
  generic lint rule.
- Prove the retired baseline/scanner/budget paths are absent. A coordinated test fixture that adds a matching
  `complexity-baseline.json` must still fail because ESLint never reads it.
- Regenerate `tools/quality-policy/test-inventory.json` and `format-scope.json` through their canonical owners.

**Exit conditions:**

- `npm run check:complexity` invokes maintained ESLint directly and passes the real shipped tree.
- Each independent 10/40/4/6 violation fails its negative test.
- Recreating an arbitrary matching baseline cannot affect the result.
- `rg` finds no live baseline/scanner/budget claim outside archived execution plans.
- `npm run test:tools`, `npm run typecheck:tools`, and `npm run format:check` pass.

### Phase C — Normalize fast/core composition and remove duplicate work

**Intent:** Align contributor commands while preserving the complete hybrid non-coverage gate.  
**Dependencies:** Phase B.

#### C1. Separate smell and contract ownership

- Remove `npm run check:smells` from inside `test:contract`.
- Keep `test:contract` responsible for headers, namespace, naming, dependency, viewer, and hotspot contracts.
- Keep the top-level `check:smells` group in `check:core`, where it runs patterns plus semantic smell contracts once.
- Do not drop either `check-patterns.mjs` or `check-smell-contracts.mjs`.

#### C2. Add a bounded product-unit aggregate

- Add `test:unit` as the ordinary Python product tests plus viewer and plugin behavior tests, excluding
  `test:tools`, `test:contract`, quality checkers, release/package checks, scaling contracts, and coverage.
- Prefer existing test-runner commands and simple composition. Do not create a custom test orchestrator.
- If exact pytest selection is needed to exclude a slow integration family, use documented pytest markers or explicit
  stable paths and add collection-drift proof.

#### C3. Normalize the fast gate

- Change `check:fast` in `package.json` to exactly:
  `npm run check:standard && npm run typecheck && npm run test:unit`.
- Keep Python strict typing inside `typecheck`; do not duplicate `check:python-contracts` in the fast aggregate.

#### C4. Strengthen command-graph contracts

- Update `tests/js/command-graph.test.mjs`, splitting reusable graph-fixture helpers if needed, to prove:
  - exact `check:fast`, `check:all`, and `check:strict` strings;
  - `check:core` reaches `test:split`, `check:smells`, `check:python-contracts`, and `check:complexity`;
  - every required core group remains reachable;
  - no npm-script leaf is reachable more than once from `check:core`;
  - `check:fast` cannot reach the explicitly excluded exhaustive groups;
  - a fixture restoring `test:contract -> check:smells` fails duplicate-leaf validation;
  - `dependencies:audit` remains outside required offline gates.
- Keep `tools/check-all.sh` a pure wrapper and pre-push/release invocation counts unchanged.

**Exit conditions:**

- `npm run check:fast`, `npm run test:unit`, `npm run test:split`, and focused graph tests pass.
- Static graph expansion reaches each core npm-script leaf once.
- The former duplicate smell route and former exhaustive fast graph fail deliberate fixtures.

### Phase D — Make actionlint and Codex configuration portable

**Intent:** Remove platform-claimed-but-broken and host-specific tooling from the role model.  
**Dependencies:** Phase A.

#### D1. Repair actionlint checksum behavior

- Change `tools/actionlint.sh` to `#!/usr/bin/env bash`.
- Use `sha256sum` when available and fall back to `shasum -a 256`, matching the paired supported behavior.
- If neither checksum tool exists, fail with one explicit prerequisite message before extracting/installing anything.
- Preserve actionlint 1.7.12, all four reviewed archive checksums, external cache ownership, temporary-directory cleanup,
  install-only network access, and offline cached invocation.
- Do not claim Windows support.

#### D2. Test each advertised checksum branch

- Extend `tests/js/setup.test.mjs` or a focused provisioning test with fake executables so Linux-style `sha256sum`,
  Darwin-style `shasum`, checksum mismatch, and missing checksum utility paths are deterministic and network-free.
- Do not skip the fallback proof merely because the current host supplies `sha256sum`.

#### D3. Replace the empty `.codex` marker

- Remove the zero-byte `.codex` regular file and create `.codex/config.toml`.
- Retain only repository-portable project-document, approval, sandbox, and cached-search defaults supported by the
  currently installed Codex configuration schema.
- Add no MCP server. In particular, do not introduce `@latest`, OS-specific launchers, or user-specific environment
  paths.
- Use the exact same normalized file bytes as Dyninstruments.

#### D4. Add a local Codex drift proof

- Add a focused test that proves required portable keys and absence of `@latest`, OS launchers/environment paths,
  absolute user paths, and MCP server declarations.
- Keep the proof dependency-free; do not add a TOML parser solely for this small fixed configuration.

**Exit conditions:**

- `npm run actions:lint` passes with the existing checksum/action pins.
- All checksum-selection negative/positive tests pass without network.
- The two `.codex/config.toml` files are byte-identical and their local drift tests pass.

### Phase E — Synchronize contributor and quality documentation

**Intent:** Replace false baseline claims and make the final role-model contract discoverable.  
**Dependencies:** Phases B–D.

#### E1. Update complexity ownership

- Update `documentation/conventions/coding-standards.md`,
  `documentation/conventions/smell-prevention.md`,
  `documentation/conventions/testing-infrastructure.md`, and
  `documentation/conventions/quality-gates.md`.
- State that maintained ESLint directly enforces strict shipped-JavaScript limits and no baseline/exception path
  exists.
- Remove every instruction saying an active baseline may contain or shrink an entry.

#### E2. Update command-owner documentation

- Document the exact bounded `check:fast` graph, complete `check:core` graph, direct `check:complexity` leaf, and
  one-owner smell composition.
- Update `documentation/guides/documentation-maintenance.md` with the smallest relevant iteration gates and required
  final gate.

#### E3. Update contributor-facing documentation

- Update the development/checking sections of `README.md` and `CONTRIBUTING.md`:
  - `check:fast` is bounded feedback, not the final gate;
  - `check:core` is complete except for coverage;
  - `check:all` is required before handoff/push/release;
  - hooks remain explicit local activation;
  - the tag workflow remains transport-only;
  - the supported developer platform/Python contract is distinct from the Python 3.9 runtime target.
- Explain that the repository is a hybrid-profile role model, not a blank-plugin starter.
- Mention the portable repository Codex configuration only as optional contributor tooling.

#### E4. Check routing and file size

- Update `AGENTS.md` or `CLAUDE.md` only if their present command or complexity statements become inaccurate.
- Keep `README.md` below 400 non-empty lines. If the required update would approach the limit, move stable development
  details to one focused documentation file, link it from README and `documentation/TABLEOFCONTENTS.md`, and keep the
  routing concise.

**Exit conditions:**

- `npm run docs:check` passes.
- `rg` finds no current false claim about a mutable complexity baseline.
- README and contributor guidance use the same command meanings as `package.json`.
- Every edited maintained Markdown file remains below 400 non-empty lines.

### Phase F — Prove standalone quality and paired alignment

**Intent:** Close the migration with reproducible evidence, not prose-only parity claims.  
**Dependencies:** Phases B–E and completion of the paired Dyninstruments plan.

#### F1. Run focused and complete local gates

- Run `npm run check:fast`.
- Run `npm run check:core`.
- Run `npm run test:coverage:check`.
- Run `npm run check:all`.
- Run `npm run hooks:doctor`.
- Confirm the worktree contains only intended changes.

#### F2. Repeat the adversarial complexity proof

- Create an isolated shipped-JavaScript fixture for each 10/40/4/6 violation.
- Add any arbitrary matching `complexity-baseline.json` next to the fixture.
- Confirm direct ESLint rejects the source in every case because no policy input can authorize it.
- Record the commands/results in this plan and delete the temporary fixture.

#### F3. Run the one-off paired comparison

- From the common parent or a temporary read-only script, assert:
  - identical Node/npm declarations and common direct dependency versions;
  - exact shared `check:fast`, `check:all`, and `check:strict` strings;
  - complete-suite reachability from both `check:core` graphs;
  - no repeated Polar smell leaf and no incomplete Dyn core;
  - identical generic base schema and generic schema case payload;
  - identical actionlint version/checksum table and portable checksum behavior;
  - identical pinned publisher Action SHAs;
  - identical `.codex/config.toml`;
  - no required command in either repository references the sibling path.
- Record justified profile differences: Python/c8/Ruff/mypy and direct zero-debt complexity here; Vitest/V8/jsdom and
  historical legacy ratchets in Dyninstruments.
- Keep this comparison one-off unless a separately approved shared-package design gives it a stable owner.

#### F4. Close the active plan

- Add exact commands, outcomes, test/coverage counts, adversarial results, and justified deviations to the
  completion-evidence section.
- Move the plan to `exec-plans/completed/PLAN7.md` only after standalone and paired acceptance criteria pass.

**Exit conditions:**

- Both full gates pass from clean, independent checkouts.
- The complexity policy remains strict under coordinated source plus arbitrary-policy edits.
- The paired comparison has no unexplained common-contract drift.
- The active plan is archived only after all required evidence is recorded.

---

## User-Facing Documentation Impact

`README.md` changes are mandatory because this plan changes contributor-visible command semantics and documents the
repository's role-model boundary.

Required documentation deliverables:

- `README.md`: update development commands, fast/final gate guidance, supported developer/runtime distinction,
  hook/release authority, and hybrid-role-model scope.
- `CONTRIBUTING.md`: update iteration and completion workflow.
- `documentation/conventions/quality-gates.md`: own the exact command graph and direct complexity leaf.
- `documentation/conventions/testing-infrastructure.md`: own direct ESLint complexity testing.
- `documentation/conventions/coding-standards.md` and `smell-prevention.md`: remove mutable-baseline claims.
- `documentation/guides/documentation-maintenance.md`: use the corrected smallest/final gates.
- `AGENTS.md` and `CLAUDE.md`: update only stale routing statements; do not re-expand canonical documentation.

No user-visible API, persistence, export, viewer, installation, configuration, or runtime requirement changes are
planned. Test fixtures representing plugin behavior do not change unless required to preserve current assertions.

---

## Acceptance Criteria

### Complexity integrity

- [ ] `check:complexity` invokes maintained ESLint directly with error limits 10/40/4/6.
- [ ] Complexity rules cover `viewer/*.js`, `plugin.js`, and `plugin.mjs`, not dev-tool/test functions.
- [ ] The mutable baseline, custom budget, and custom scanner are deleted.
- [ ] Each independent complexity metric has a clean and failing direct-ESLint fixture.
- [ ] An arbitrary matching baseline file cannot change a failing result.
- [ ] No current documentation claims that complexity debt can be baselined or ratcheted.

### Command semantics

- [ ] `check:fast` is exactly `check:standard && typecheck && test:unit`.
- [ ] `test:unit` excludes exhaustive tool/contract, package, docs, scaling, complexity, and coverage work.
- [ ] `check:core` reaches the complete `test:split`.
- [ ] `check:smells` has one path from `check:core`.
- [ ] `check:all` and `check:strict` retain their exact shared definitions.
- [ ] Negative graph fixtures reject both the former duplicated smell route and exhaustive fast graph.

### Quality integrity and portability

- [ ] Coverage floors, inventories, hotspot/scaling budgets, Python contracts, type checks, and package checks are not
      weakened.
- [ ] No new suppression, ignored path, skipped test, coverage exception, or debt ledger is introduced.
- [ ] Actionlint installation supports every advertised OS/architecture checksum path with `sha256sum`/`shasum`
      fallback and deterministic tests.
- [ ] Required gates remain offline after setup and require no external browser.

### Portable role-model configuration

- [ ] `.codex` is a directory containing the normalized `config.toml`, not an empty marker file.
- [ ] The configuration contains no OS-specific command/environment and no unpinned MCP.
- [ ] It is byte-identical to Dyninstruments' normalized configuration.
- [ ] A local test proves required keys and forbidden-token rejection.
- [ ] Generic schema and generic case payloads still match the paired repository.

### Documentation

- [ ] README, CONTRIBUTING, quality-gate, testing, coding, smell, and maintenance guidance match live behavior.
- [ ] Documentation clearly separates the hybrid role model from a future greenfield environment.
- [ ] The supported developer platform/Python contract is stated without overstating portability.
- [ ] No shipped file cites this plan or a phase as authority.
- [ ] All edited maintained files remain below their size limits.
- [ ] `npm run docs:check` passes.

### Completion

- [ ] `npm run check:fast` passes.
- [ ] `npm run check:core` passes.
- [ ] `npm run test:coverage:check` passes.
- [ ] `npm run check:all` passes.
- [ ] `npm run hooks:doctor` passes.
- [ ] The adversarial complexity probe fails closed with arbitrary policy data present.
- [ ] The paired mechanical comparison reports no unexplained common-contract drift.
- [ ] Both repositories remain independently runnable and clean apart from their intended plan implementations.

---

## Progress / Completion Evidence

Populate this section during implementation. Record exact commits, commands, counts, coverage summaries, adversarial
results, parity results, and deviations. Do not mark criteria complete from expectation alone.

---

## Related

- [Core principles](../../documentation/core-principles.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)
- [Completed migration plan](../completed/PLAN6.md)
- Dyninstruments paired plan: `../../../dyninstruments/exec-plans/active/PLAN40.md`
