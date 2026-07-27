# PLAN7 — Close quality-contract gaps and establish the final hybrid-profile role model

## Status

Written after repository verification and the cross-repository quality-system audit on 2026-07-27.

This plan closes the remaining Polar Recorder migration gaps: the complexity self-grandfathering escape, duplicated
command-graph work, an unbounded fast gate, non-portable actionlint checksum behavior, missing portable Codex
configuration, synchronized contributor documentation, and final mechanical alignment evidence with Dyninstruments.

Archived at the repository owner's direction on 2026-07-27. The remaining paired-repository verification is recorded
in the completion evidence for a future follow-up.

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
- Move the plan to `exec-plans/completed/PLAN7.md` after standalone and paired acceptance criteria pass, or earlier at
  the repository owner's direction when any outstanding external condition remains recorded in the completion evidence.

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

- [x] `check:complexity` invokes maintained ESLint directly with error limits 10/40/4/6.
- [x] Complexity rules cover `viewer/*.js`, `plugin.js`, and `plugin.mjs`, not dev-tool/test functions.
- [x] The mutable baseline, custom budget, and custom scanner are deleted.
- [x] Each independent complexity metric has a clean and failing direct-ESLint fixture.
- [x] An arbitrary matching baseline file cannot change a failing result.
- [x] No current documentation claims that complexity debt can be baselined or ratcheted.

### Command semantics

- [x] `check:fast` is exactly `check:standard && typecheck && test:unit`.
- [x] `test:unit` excludes exhaustive tool/contract, package, docs, scaling, complexity, and coverage work.
- [x] `check:core` reaches the complete `test:split`.
- [x] `check:smells` has one path from `check:core`.
- [x] `check:all` and `check:strict` retain their exact shared definitions.
- [x] Negative graph fixtures reject both the former duplicated smell route and exhaustive fast graph.

### Quality integrity and portability

- [x] Coverage floors, inventories, hotspot/scaling budgets, Python contracts, type checks, and package checks are not
      weakened.
- [x] No new suppression, ignored path, skipped test, coverage exception, or debt ledger is introduced.
- [x] Actionlint installation supports every advertised OS/architecture checksum path with `sha256sum`/`shasum`
      fallback and deterministic tests.
- [x] Required gates remain offline after setup and require no external browser.

### Portable role-model configuration

- [x] `.codex` is a directory containing the normalized `config.toml`, not an empty marker file.
- [x] The configuration contains no OS-specific command/environment and no unpinned MCP.
- [x] It is byte-identical to Dyninstruments' normalized configuration (verified against Dyninstruments' current,
      uncommitted worktree state -- see Phase F3).
- [x] A local test proves required keys and forbidden-token rejection.
- [x] Generic schema and generic case payloads still match the paired repository.

### Documentation

- [x] README, CONTRIBUTING, quality-gate, testing, coding, smell, and maintenance guidance match live behavior.
- [x] Documentation clearly separates the hybrid role model from a future greenfield environment.
- [x] The supported developer platform/Python contract is stated without overstating portability.
- [x] No shipped file cites this plan or a phase as authority.
- [x] All edited maintained files remain below their size limits.
- [x] `npm run docs:check` passes.

### Completion

- [x] `npm run check:fast` passes.
- [x] `npm run check:core` passes.
- [x] `npm run test:coverage:check` passes.
- [x] `npm run check:all` passes.
- [x] `npm run hooks:doctor` passes.
- [x] The adversarial complexity probe fails closed with arbitrary policy data present.
- [x] The paired mechanical comparison (against Dyninstruments' current worktree) reports no unexplained
      common-contract drift.
- [ ] Both repositories remain independently runnable and clean apart from their intended plan implementations --
      Polar Recorder is clean; Dyninstruments' PLAN40 is still uncommitted/active as of this comparison (see Phase F3).
      **This is the one criterion this session cannot close; see "What remains" below.**

---

## Progress / Completion Evidence

Populate this section during implementation. Record exact commits, commands, counts, coverage summaries, adversarial
results, parity results, and deviations. Do not mark criteria complete from expectation alone.

### Phase A — baseline reconfirmation (2026-07-27)

- HEAD at start of implementation: `3f40ecbaee7f8f9be4668e673dcf8a47be7382a5` ("Added PLAN7.md"), one commit ahead of
  the plan's verified baseline `265289dfbd5f640c9ebf788cae047535221aa43a`. `git diff --stat` between the two shows only
  `exec-plans/active/PLAN7.md` (new) and a 6-line regenerated `tools/quality-policy/format-scope.json` delta (adding the
  new plan file's own `prettier` row and bumping `countByOwner.prettier` from 171 to 172) — no other drift. Worktree was
  clean (`git status` reported nothing to commit) before any implementation edit.
- Node `v26.4.0`, npm `12.0.1`, Python `3.14.6` (matches `tools/quality-policy/developer-python.json`'s
  `supportedVersionRange`).
- `npm run hooks:doctor` → `Git hooks are correctly configured.` (exit 0).
- `npm run check:all` passed clean from this HEAD: 378 Python tests (`378 passed, 1 warning in 4.00s` under
  `--cov-fail-under=90`, combined coverage `95.77%` reported by pytest-cov, `TOTAL ... 96%` branch line matches prior
  95.7723%/91.7508% figures at displayed precision), 250 `test:tools` quality-tool tests, 26 `test:viewer` tests plus 1
  `test:plugin` test (27 total under `test:coverage:viewer`'s c8 run — `93.43%` lines/statements, `79.38%` branches,
  `90.82%` functions), and `Complexity budget check passed: 0 tracked baseline entries, 0 new violations.`
- **Adversarial complexity self-grandfathering reproduction** (isolated scratchpad copy of the real
  `tools/quality-policy/complexity-scan.mjs`/`complexity-budget.mjs`, never touching the repo tree): wrote
  `viewer/seven-param.js` with a 7-parameter function (`max-params` limit is 6) under an empty
  `complexity-baseline.json` (`{"entries": []}`) → `runComplexityBudgetCheck` returned
  `{"ok": false, "failures": ["New over-limit function: 'viewer/seven-param.js' sevenParamFunction has max-params 7 ...; new debt cannot be baselined."]}`
  (exit 1). Then, **without changing `seven-param.js` at all**, added a matching baseline entry
  `{"file": "viewer/seven-param.js", "identity": "sevenParamFunction", "metric": "max-params", "value": 7, "limit": 6}`
  → the identical checker returned `{"ok": true, "failures": [], "baselineEntryCount": 1}` (exit 0). This confirms the
  plan's Verified Baseline claim #14: a coordinated policy-data edit, with zero source change, flips a real violation
  from failing to passing. The temporary probe directory was deleted after recording this result; nothing was
  committed. This is the negative behavior Phase B's direct-ESLint replacement must make structurally impossible (no
  policy file for ESLint's built-in `complexity`/`max-statements`/`max-depth`/`max-params` rules to read).
- Dyninstruments paired baseline: `exec-plans/active/PLAN40.md` exists and is still active (not yet implemented) at
  read time, verified against Dyninstruments commit `9a62c68b2cde6df4afb9be4248e18de46ef52af9`. Both plans agree on the
  shared contract: identical `check:fast` target string, `check:core`/`check:all`/`check:strict` semantics, `.codex`
  portability rules (strip Windows `cmd`/env/`chrome-devtools-mcp@latest`, keep the rest, byte-identical output), and
  independence constraints. No disagreement found requiring plan amendment. Because PLAN40 is not yet implemented in
  Dyninstruments, the final byte-identical `.codex/config.toml` and full paired mechanical comparison (Phase F3) cannot
  be closed from this side alone; this is tracked explicitly rather than assumed.

### Phase B — direct-ESLint complexity enforcement (2026-07-27)

- Added `tools/quality-policy/eslint.complexity.config.mjs`: a focused ESLint flat config with only `complexity`,
  `max-statements`, `max-depth`, `max-params` at error-level 10/40/4/6, scoped to `viewer/*.js`/`plugin.js` (classic
  script) and `plugin.mjs` (module). `check:complexity` is now
  `eslint --config tools/quality-policy/eslint.complexity.config.mjs viewer/*.js plugin.js plugin.mjs`; verified clean
  against the real tree (`EXIT=0`, no output).
- Deleted `tools/quality-policy/complexity-baseline.json`, `complexity-budget.mjs`, `complexity-scan.mjs`, and
  `tests/js/complexity-budget.test.mjs`. Removed all references from `package.json` (`test:tools` list),
  `tsconfig.tools.json`, `tsconfig.tests.json`. Regenerated `tools/quality-policy/format-scope.json` (292 rows,
  `prettier` 171 -> 170 net of the deletions) and `tools/quality-policy/test-inventory.json` via their canonical
  generators (`npm run format:scope`, `node tools/quality-policy/test-inventory.mjs --write`).
- Added `tests/js/complexity-policy.test.mjs` (10 tests, all passing): retired-file absence, a clean function passes,
  each of the 4 metrics fails independently (complexity/max-statements/max-depth/max-params), `plugin.js` (classic) and
  `plugin.mjs` (module) both covered, a 7-param `tools/*.mjs` dev-tool fixture is confirmed outside the shipped-product
  scope (exit 0, no error), and a fixture recreating a matching `complexity-baseline.json` next to a real
  `viewer/*.js` violation still fails (`too many parameters`) because ESLint never reads that file.
- `npm run format:check`, `npm run typecheck:tools`, `npm run typecheck:tests`, `npm run check:filesize`, and
  `npm run check:smells` all pass against the new state.
- `rg "complexity-baseline|complexity-scan|complexity-budget"` after this phase finds only the new test/config file
  names and this active plan's evidence; no live claim remains outside them.

### Phase C — command-graph normalization (2026-07-27)

- `test:contract` no longer runs `check:smells`; `check:core` still calls `check:smells` directly (now the sole path).
  Verified: `npm run test:contract` passes standalone; `npm run check:smells` passes standalone.
- Added `test:unit = npm run test:python && npm run test:viewer && npm run test:plugin`.
- Changed `check:fast` to exactly `npm run check:standard && npm run typecheck && npm run test:unit`.
- Rewrote `tests/js/command-graph.test.mjs` (297 non-empty lines, well under the 400-line flag threshold noted in the
  plan's Hard Constraints): added an exact `check:fast` string test, a `check:fast`-exclusion test (asserts
  `test:split`/`test:tools`/`test:contract`/`check:python-contracts`/`test:coverage:check`/`package:check`/
  `docs:check`/`check:complexity`/`check:scaling`/`release:create` are unreachable from `check:fast`), a
  `duplicateLeaves()` helper proving no npm-script name is reached by more than one distinct parent from `check:core`,
  and a fixture test that reintroduces `test:contract -> check:smells` and confirms `duplicateLeaves` flags exactly
  `["check:smells"]`. Added `test:unit` to `ALLOWED_OUTSIDE_CHECK_ALL`. All 27 tests in this file pass, including the
  11 pre-existing per-group failure-propagation fixtures (`REQUIRED_CHECK_CORE_GROUPS` unchanged).

### Phase D — actionlint portability and `.codex` (2026-07-27)

- `tools/actionlint.sh`: shebang changed to `#!/usr/bin/env bash`; the `--install` branch now detects
  `command -v sha256sum` first, falls back to `shasum -a 256`, and fails with an explicit prerequisite message
  _before_ `mkdir`/`curl`/`tar` run if neither exists. The four reviewed checksums and `ACTIONLINT_VERSION=1.7.12` are
  unchanged (verified 64 hex chars each). `bash -n tools/actionlint.sh` passes.
- Extended `tests/js/setup.test.mjs` (126 -> 259 non-empty lines) with a fully isolated fake-`PATH` harness
  (`buildFakeBin`/`withFakeInstallEnv`): real `bash`/`uname`/`mkdir`/`mktemp`/`cut`/`tar`/`install`/`dirname`/`rm`/
  `chmod`/`gzip` are symlinked in; `curl` is faked to build a valid local tar.gz (never touches the network);
  `sha256sum`/`shasum` are faked to report a controlled hash. 4 new tests, all passing: install succeeds via
  `sha256sum`-only, install succeeds via `shasum -a 256`-only (Darwin-style, no `sha256sum` on `PATH` at all), a
  checksum mismatch fails closed with `checksum mismatch` and no binary installed, and neither-tool-present fails
  closed with the new explicit message before any cache/tmp directory is created. All 16 tests in the file pass, and
  the 3 pre-existing offline/cache/in-repo-cache-rejection tests are unaffected.
- Removed the zero-byte `.codex` marker file; created `.codex/config.toml`. Content was derived by observing that
  Dyninstruments' own `.codex/config.toml` (mid-implementation of PLAN40 in that repo, read-only) had, by the time this
  phase ran, already been stripped down to exactly the portable subset both plans describe (project-doc/approval/
  sandbox/web-search keys, no MCP block, no Windows `cmd`/env) -- `sha256sum` of that file
  (`be6ded57d66fa0d9101ef7eb2b9fb1aa3105e2871f8eca93218da1c6dc937f64`) was copied byte-for-byte into Polar Recorder's
  `.codex/config.toml` (verified identical checksum both sides).
- Updated `tools/quality-policy/generate-format-scope.mjs`: removed the retired `.codex` empty-marker special case,
  added a `.codex/config.toml` classification (`unsupported`, no maintained TOML formatter, alternate validation is the
  new drift test). Regenerated `format-scope.json` (293 rows).
- Added `tests/js/codex-config.test.mjs` (4 tests, all passing): `.codex` is a directory (not the retired file),
  required portable keys present, no forbidden OS-specific/MCP tokens present, and a deliberate forbidden-token fixture
  trips the same check.
- `npm run format:check`, `npm run typecheck:tests`, `npm run check:smells`, `npm run actions:lint` all pass.

### Phase E — documentation synchronization (2026-07-27)

- Updated `documentation/conventions/coding-standards.md`, `smell-prevention.md` (complexity row), and
  `testing-infrastructure.md` (full paragraph rewrite) to describe direct ESLint enforcement and remove every claim
  that a baseline/scanner/budget exists or that debt can be baselined/ratcheted.
- Updated `documentation/conventions/quality-gates.md`: `check:complexity` row now names the real command; `check:smells`
  row now states it is the sole path from `check:core`; the convenience-alias table now states `check:fast`'s exact
  string and exclusions and documents the new `test:unit` alias.
- Updated `README.md`'s "For developers" section (trimmed to a short pointer into `CONTRIBUTING.md` to keep the file
  under its hotspot budget -- see below) and `CONTRIBUTING.md` (exact `check:fast` composition, hybrid-role-model
  sentence naming the sibling `dyninstruments` alignment).
- `npm run docs:check` passes (36 Markdown files linted, 40 links checked, TOC/format/reachability/smell-catalog/
  `CLAUDE.md`-pointer checks all pass).
- `rg "PLAN7|Phase [A-Z]"` over shipped source/docs (outside `exec-plans/`) finds no citation; `check:patterns`'s
  `exec-plan-reference` rule continues to pass.
- **README.md hotspot-budget correction**: after the first documentation pass, README.md reached 365 non-empty lines,
  exceeding its `tools/quality-policy/hotspot-budgets.json` budget of 360 (`tests/js/hotspot-budgets.test.mjs` caught
  this in the first `check:core` run below). Per the budget file's own note ("cannot be raised merely to make a change
  pass; the file must be split or trimmed instead") and this plan's Hard Constraints ("split cleanly instead of
  compressing"), the "For developers" section was trimmed to a short pointer into `CONTRIBUTING.md` (which already
  owns this detail in full) rather than raising the budget or compressing prose. README.md is now 350 non-empty lines
  (below both its 360 hotspot budget and the original 356-line pre-plan baseline).

### Phase F — final verification (2026-07-27)

Exact commands and results, run sequentially from the fully implemented worktree:

| Command                       | Result                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:fast`          | Exit 0. `check:standard && typecheck && test:unit` (378 Python + 26 viewer + 1 plugin tests, all passing).                                                                                                                                  |
| `npm run check:core`          | Exit 0 (after the README hotspot-budget fix above). 378 Python tests, 260 `test:tools` tests, 26 viewer + 1 plugin test, `Complexity budget` line replaced by ESLint's silent-success exit.                                                 |
| `npm run test:coverage:check` | Exit 0. Python: `378 passed, 1 warning`, `Required test coverage of 90% reached. Total coverage: 95.77%`. Viewer/plugin c8: `93.43%` lines/statements, `79.38%` branches, `90.82%` functions (27 tests). `Coverage inventory check passed.` |
| `npm run check:all`           | Exit 0 (`check:core && test:coverage:check`, same figures as above).                                                                                                                                                                        |
| `npm run hooks:doctor`        | `Git hooks are correctly configured.` (exit 0).                                                                                                                                                                                             |

Test-count delta from the Phase A baseline: 378 Python tests unchanged; quality-tool tests moved 250 -> 260 (net:
-complexity-budget.test.mjs's tests, +10 `complexity-policy.test.mjs`, +4 new `setup.test.mjs` checksum-branch tests,
+4 `codex-config.test.mjs` tests, and the 27 `command-graph.test.mjs` tests, versus the prior file's tests, replacing
its former count); viewer/plugin coverage tests unchanged at 26+1=27. Combined Python coverage unchanged at 95.77%;
viewer/plugin c8 coverage unchanged at 93.43%/79.38%/90.82% (no product code touched, per the Hard Constraints).

**Adversarial complexity re-proof with arbitrary policy data present** (`viewer/__adversarial_probe.js`, a real
7-parameter function, plus a hand-authored `tools/quality-policy/complexity-baseline.json` containing a matching
entry for it, both created directly in the live repo tree this time -- not a scratch copy): `npm run check:complexity`
exited **1** (`Function 'sevenParamFunction' has too many parameters (7). Maximum allowed is 6  max-params`), proving
the arbitrary matching baseline had zero effect because the direct-ESLint config never reads that file. Both files
were removed immediately after; `git status --short` confirmed the worktree returned to its intended-changes-only
state.

### Phase F3 — read-only paired comparison (2026-07-27)

Dyninstruments' `exec-plans/active/PLAN40.md` was **still active and uncommitted** at comparison time (`git status
--short` in that checkout showed modified `.codex/config.toml`, `CONTRIBUTING.md`, `README.md`, two
`documentation/conventions/*.md` files, `documentation/guides/documentation-maintenance.md`, `package.json`, two
`tests/`/`tools/quality-policy/*.json` files, `tsconfig.tests.json`, and an untracked `tests/tools/codex-config.test.js`
-- i.e. PLAN40 implementation was actively in progress in that worktree during this session, never edited by this
agent). The following mechanical, read-only comparisons were nonetheless performed against that current (in-progress)
state, since most of what PLAN7/PLAN40 require to align was already present:

- **Common devDependency versions**: all 12 shared packages (`@eslint/js`, `@types/node`, `ajv`, `eslint`, `globals`,
  `jscpd`, `linkinator`, `markdownlint-cli2`, `prettier`, `stylelint`, `stylelint-config-standard`, `typescript`)
  match exactly. `engines.node` (`>=26 <27`), `engines.npm` (`12.0.1`), and `packageManager` (`npm@12.0.1`) match
  exactly.
- **`check:fast`/`check:all`/`check:strict` exact strings**: Dyninstruments' `check:fast` is
  `"npm run check:standard && npm run typecheck && npm run test:unit"` -- byte-identical to Polar Recorder's.
  `check:all` (`"npm run check:core && npm run test:coverage:check"`) and `check:strict` (`"npm run check:all"`) are
  also byte-identical. `check:core` composition differs in group set/order as expected (Dyninstruments has no
  Python-specific `check:python-contracts` leaf; Polar Recorder's `test:focus:check` sits before `check:smells` while
  Dyninstruments' sits after) -- a justified profile difference, since `check:core` shares a _meaning_
  ("complete deterministic non-coverage gate"), not an exact graph, per the Target Alignment Contract.
- **`.codex/config.toml`**: `diff` reports zero differences; both files share SHA-256
  `be6ded57d66fa0d9101ef7eb2b9fb1aa3105e2871f8eca93218da1c6dc937f64`.
- **Generic AvNav schema**: `schemas/avnav-plugin-base.schema.json` is byte-identical (`diff` empty). The
  `genericBase` corpus in `tools/quality-policy/plugin-schema-corpus.json` is structurally identical
  (`JSON.stringify` equal); Dyninstruments' corpus note has already been corrected (no longer claims "no sibling has
  published a base/profile split") and now names Polar Recorder's shared corpus explicitly.
- **actionlint**: identical version (`1.7.12`) and all four SHA-256 checksums (`8aca8db9…`, `325e971b…`,
  `5b44c3bc…`, `aba9ced2…`) match exactly, byte-for-byte, despite the two scripts using different internal variable
  names/case-statement shapes. Both scripts independently implement the same portable fallback intent
  (`command -v sha256sum` else `shasum -a 256`); Dyninstruments' fallback path does not pre-check for the total
  absence of both tools the way Polar Recorder's explicit prerequisite-message branch does -- a minor, non-required
  implementation difference, not a contract violation (only "portable checksum behavior" is shared, not byte-identical
  scripts).
- **Publisher workflow Action SHAs**: `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2` and
  `softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 # v2.6.2` match exactly in both
  `.github/workflows/publish-release.yml` files.
- **No sibling-path reference in required commands**: `grep -rn "\.\./dyninstruments\|/dyninstruments/"` over Polar
  Recorder's `.json`/`.mjs`/`.sh`/`.py`/`.js` files (excluding `node_modules`) finds only one hit, inside
  `.claude/settings.local.json` (a Claude Code session tool-permission allowlist entry, not a repo script, hook, test,
  release command, or documentation checker). Every other "dyninstruments" mention in maintained source is prose
  attribution ("adapted from the sibling `dyninstruments` plugin"), not a path resolution. `grep -rn "polarrecorder"`
  over Dyninstruments' equivalent file types (excluding `node_modules`) found zero hits.

**No unexplained common-contract drift was found** on any dimension compared above; every profile difference found
(`check:core` group set/order, actionlint script internals) is explained by the two repositories' documented,
justified differences (Python/Node hybrid vs. pure-JS/Vitest, and independent-but-equivalent script authorship).

**What remains** (the one acceptance criterion this session cannot close): Dyninstruments' PLAN40 was uncommitted and
still in `exec-plans/active/` at comparison time, so "both repositories remain independently runnable and clean apart
from their intended plan implementations" cannot yet be certified for the Dyninstruments side -- that worktree had
real, in-progress, uncommitted edits during this session (never touched by this agent, per the Hard Constraints).
Every dimension actually compared showed no drift, and Polar Recorder's own worktree is clean apart from this plan's
intended changes. At the repository owner's direction, this plan was archived with the external condition still open:
Dyninstruments must commit/finalize its PLAN40 implementation, then a follow-up session must re-run this Phase F3
comparison against that committed state (in particular re-confirming `check:core`'s exact composition and the
`.codex/config.toml` byte-identity once both sides are frozen).

---

## Related

- [Core principles](../../documentation/core-principles.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)
- Dyninstruments paired plan: `../../../dyninstruments/exec-plans/active/PLAN40.md`
