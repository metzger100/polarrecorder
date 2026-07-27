# PLAN6 - Complete the quality migration and establish the aligned hybrid-profile exemplar

## Status

Written after repository verification and the cross-repository quality-system review on 2026-07-26.

This plan covers the remaining Polar Recorder migration defects, retirement of completed migration scaffolding,
activation of the maintained documentation tools, strict quality-tool ownership, common dependency and release pins,
portable policy evidence, generic AvNav metadata validation, developer onboarding, live-host validation, and final
alignment with Dyninstruments.

The coding agent may choose equivalent internal helper names and file splits as long as the behavioral, structural,
negative-proof, and documentation outcomes below are met. The public command names, maintained documentation owners,
strict tool-code boundary, removal of obsolete migration authority, common dependency/action pin set, generic schema
corpus, and portable-baseline outcomes are prescriptive.

No pre-plan user interview was run. The plan therefore makes these explicit assumptions:

1. Product behavior, runtime Python 3.9 compatibility, AvNav lifecycle, persisted data, API shapes, viewer output,
   installer behavior, and release ZIP contents remain unchanged.
2. The current local-first authority remains in force: no PR/push quality workflow, CODEOWNERS file, branch ruleset, or
   pre-commit framework is introduced. A novice-default remote-governance profile belongs to the future generic
   scaffolder, not this exemplar migration.
3. Polar Recorder remains independently buildable and testable. Its required gate must never read the sibling
   Dyninstruments checkout.
4. The paired Dyninstruments plan is `PLAN39 — Finalize the generic quality migration and establish the aligned
viewer-profile exemplar`. The two plans coordinate guarantees; neither repository becomes a package dependency of
   the other.
5. Extracting a third, versioned `avnav-plugin-quality` package and `create-avnav-plugin` scaffolder is a subsequent
   productization task. This plan makes Polar Recorder extraction-ready but does not choose a package registry or
   ownership repository.

Repo rules and core principles outrank this plan. If implementation reveals a conflict, amend the active plan with
evidence instead of weakening a gate or silently improvising.

---

## Goal

Finish Polar Recorder's quality migration so it is a trustworthy hybrid Python/JavaScript AvNav plugin exemplar and
exposes the same common quality guarantees and contributor vocabulary as Dyninstruments.

Expected outcomes after completion:

- markdownlint-cli2 and Linkinator are real required documentation owners with positive and negative proofs.
- The live package script graph is the only current command authority; obsolete migration target/phase ledgers are
  archived or deleted rather than consulted by the gate.
- Every custom documentation checker exports a testable entry point and has clean/failing fixtures.
- Every maintained JavaScript and Python quality tool is linted, typed where applicable, size-limited, and
  behavior-tested; oversized checker programs are split into focused owners.
- Common direct tool versions, npm overrides, actionlint checksums, GitHub Action pins, SemVer corpus, schema corpus,
  and public command names match the paired Dyninstruments outcome.
- `plugin.json` uses maintained Ajv validation with a generic AvNav metadata base and a Polar server-plugin profile.
- Complexity/coverage/test baselines are portable and contain no obsolete migration debt; all viewer files reach the
  generic 80% per-file line floor.
- A beginner has a reproducible supported setup path, and releases require an honest live-AvNav manual validation
  record.
- `npm run check:all` remains deterministic, offline after setup, external-browser-free, and green.

---

## Verified Baseline

The following points were rechecked against Polar Recorder `addd6656a5293988a9457934af87515ef3c082b8` before this
plan was written:

1. `package.json` defines the canonical top level exactly as
   `check:all = check:core && test:coverage:check`; `check:strict` is an exact alias and `tools/check-all.sh` is a pure
   compatibility wrapper.
2. `npm run setup`, `npm run hooks:doctor`, and `npm run check:all` all pass on the current
   Linux-x86_64/Node 26.4.0/npm 12.0.1/Python 3.14.6 checkout.
3. The gate executes 387 Python tests, reports 95.77% combined Python coverage, and reports viewer coverage of 91.03%
   lines and 77.41% branches.
4. `check:core` currently invokes `check:docs`, while Dyninstruments' equivalent public command is `docs:check`.
5. markdownlint-cli2 0.23.1 and Linkinator 8.0.2 are exact installed dependencies with committed configs, but no
   package script executes either. `.markdownlint-cli2.jsonc` explicitly says it is “Not yet wired.”
6. A manual markdownlint run passes the current 36 Markdown files. A naïve Linkinator repository invocation checks
   only one link, and a TOC-only invocation resolves relative roots incorrectly; an explicit root-seeded runner is
   required.
7. `tools/check-docs.mjs`, `tools/check-doc-format.mjs`, and `tools/check-doc-reachability.mjs` execute at module load,
   export no `run*` entry point, and have no focused failing-fixture self-tests.
8. `tools/quality-policy/command-graph.json` names `docs:check` in `finalCheckCoreComposition` while its live package
   graph uses `check:docs`. `notYetActivatedLeaves` is empty.
9. `tests/js/command-graph.test.mjs` proves the live package graph but never compares it with
   `finalCheckCoreComposition`; `tests/js/setup.test.mjs` only iterates the now-empty transitional leaf list.
10. `tools/quality-policy/rule-parity-ledger.json`, its 839-non-empty-line Python generator,
    `verified-baseline.json`, its generator, and `baseline-test-inventory.json` are migration evidence rather than live
    product behavior. They remain coupled into digest tests/format-scope bookkeeping after the migration completed.
11. `exec-plans/completed/PLAN5.md` and `exec-plans/PLAN5Ledger.md` already preserve the detailed migration record; the
    ledger is not located with the completed plan.
12. `eslint.config.mjs` manually defines a small rule set and does not import `@eslint/js`. A `missingGlobal();` tool
    probe exits successfully, so undefined tool globals are not rejected.
13. `eslint .` does include `tools/**/*.mjs`, but `tsconfig.checkjs.json` owns shipped viewer/plugin JS only and
    `tsconfig.tests.json` owns tests plus `tools/viewer-harness.mjs`. Other JS quality tools have no strict no-emit
    boundary.
14. `pyproject.toml` excludes all `tools/` from Ruff formatting/linting. `typecheck:python` checks
    `server/polarrecorder`, `tests`, and `plugin.py`, not Python tools.
15. `tools/check-python-filesize.py` and `tools/check-python-compat.py` scan `server/polarrecorder` and `tests`, not
    Python tools. `AGENTS.md` currently exempts `tools/` from the 400-line limit.
16. Maintained tool sources over 400 non-empty lines are: `check-patterns.mjs` 1,096,
    `generate_rule_parity_ledger.py` 839, `viewer-harness.mjs` 736, `check-file-size.mjs` 603,
    `check-coverage-inventory.mjs` 596, `check-js-duplication.mjs` 453, and `mock-server.py` 444.
    Five more checker modules are between 304 and 372 lines.
17. The active complexity baseline is empty because all four captured migration findings were fixed. Nevertheless,
    required `check:complexity` reconstructs history from Git blob IDs in
    `baseline-complexity-source-capture.json`; `baseline-complexity-capture.mjs` also contains two literal NUL bytes.
18. Every one of the 28 executable JavaScript test/helpers is strict and
    `test-exception-baseline.json` is empty.
19. Coverage owns every Python and shipped viewer/plugin JS file, with no contract-owned exceptions. Five viewer files
    retain below-default line floors: `export-ui.js` 60, `grid-editor.js` 75, `settings-ui.js` 60,
    `timeline-chart.js` 75, and `viewer.js` 45.
20. `tools/check-schema.mjs` is a hand-written validator. Development form validation accepts any object without
    `version`; release form validation checks only a non-empty first `version` key. The command graph explicitly
    forbids a public `schema:check` script.
21. Runtime `plugin.json` is `{}` in development and is version-stamped for release. User-app registration is owned by
    `plugin.py`, not `plugin.json`.
22. `developer-python.json` accepts only `>=3.14,<3.15` and lists only `linux-x86_64`, reflecting the single migration
    host. `tools/setup.mjs` hard-codes that range and POSIX `venv/bin` paths.
23. Runtime compatibility remains Python 3.9+ stdlib-only and is checked by Ruff target configuration plus
    `check-python-compat.py`; the required gate does not actually execute on Python 3.9.
24. The common-version alignment snapshot verified on 2026-07-26 is:
    `@eslint/js` 10.0.1, `@types/node` 26.1.1, ESLint 10.8.0, `globals` 17.8.0, jscpd 5.0.12, Linkinator 8.0.2,
    markdownlint-cli2 0.23.1, Prettier 3.9.6, Stylelint 17.14.1, `stylelint-config-standard` 40.0.0, and TypeScript
    7.0.2. Polar currently lacks `@eslint/js` and differs on `@types/node`, ESLint, and `globals`.
25. A post-setup `npm audit --json` reported two high development-tool findings through direct `js-yaml` 5.2.1 and
    markdownlint-cli2 0.23.1. The shipped plugin has no npm runtime dependency chain.
26. The publisher pins checkout v4.4.0 and `softprops/action-gh-release` v2.6.2. Dyn currently pins checkout v6.0.2 and
    release action v2.2.2. Both use actionlint 1.7.12 with the same four official platform checksums.
27. Polar's SemVer implementation matches Dyn for all 20 valid and 42 invalid cases in
    `tools/quality-policy/semver-corpus.json`.
28. Automated viewer/host tests use fakes without an external browser. Unlike Dyn, Polar has no documented full
    live-AvNav release checklist.
29. `.github/workflows/publish-release.yml` is the only workflow and is deliberately a transport-only tag publisher.
30. No active execution plan exists; the next sequential Polar Recorder plan number is 6.

---

## Target Authority and Adaptation Model

| Layer                | Shared/aligned owner                                                                                       | Polar-specific extension                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Public UX            | `setup`, `check:fast`, `check:all`, `docs:check`, `schema:check`, hooks, local release                     | Python venv and pytest composition                              |
| Standard tools       | Prettier, ESLint recommended, Stylelint, markdownlint-cli2, Linkinator, actionlint, jscpd, TypeScript, Ajv | Ruff, mypy, pytest/cov, Python duplication                      |
| Inventories/ratchets | Strict-default test/source ownership, 80/65 JS floor, 10/40/4/6 JS complexity                              | Python family floors and validation/histogram owners            |
| AvNav metadata       | Verified generic base schema and common corpus                                                             | Server-plugin profile: no declarative duplicate user app        |
| Runtime contracts    | Raw/no-build JS, transport-only publisher, manual host validation                                          | Python 3.9 stdlib, single-lock boundary, API/persistence checks |
| Product smells       | None in the generic layer                                                                                  | Polar namespace, validation, finite output, dependency layers   |

Alignment does not justify porting Dyn mapper/theme rules, Vitest, jsdom, layout requirements, or legacy baseline data.

---

## Hard Constraints

### Runtime and architecture

- Preserve Python 3.9+ stdlib-only runtime code. No target-device pip dependency may enter `plugin.py` or
  `server/polarrecorder/`.
- Keep `plugin.py` the only AvNav boundary and lock owner; do not change API, persistence, viewer, installer, or release
  behavior.
- Keep viewer scripts raw/no-build under `window.Polarrecorder`.
- Do not make Polar invoke, import, or inspect Dyninstruments from setup, hooks, tests, `check:all`, package, or release
  commands.

### Quality integrity

- Do not lower coverage, complexity, file-size, inventory, duplication, type, lint, documentation, or package floors.
- Do not add a type/lint suppression, skipped test, formatter directory exclusion, coverage contract-owned exception,
  or baseline debt entry to make the migration pass.
- Raise every existing below-default viewer line floor from measured evidence. Add meaningful tests wherever current
  measured coverage is below 80%; do not set a floor above an achieved result or manufacture coverage-only code.
- Every changed custom checker needs a focused clean case and at least one focused failing case.
- Required gates remain deterministic, external-browser-free, and offline after setup.

### Common alignment snapshot

- At implementation time, re-query current registry/advisory metadata. If Baseline fact 24 is still current, use it
  exactly in both repositories.
- If a version must change for a newly published fix, amend both active plans first and use the same compatible exact
  version in both repositories.
- Align publisher actions to checkout v6.0.2
  (`de0fac2e4500dabe0009e67214ff5f5447ce83dd`) and `softprops/action-gh-release` v2.6.2
  (`3bb12739c298aeb8a4eeaf626c5b8d85266b0e65`) unless a newer reviewed pair replaces both snapshots.
- Force markdownlint-cli2's vulnerable exact `js-yaml` 5.2.1 dependency to a tested fixed resolution (5.2.2 in the
  verified snapshot) through one documented exact npm override until upstream removes the need.

### File organization

- By the end of Phase D, the 400-non-empty-line limit applies to maintained JS/MJS/Python tools as well as existing
  source/test/docs scopes.
- Split the seven current over-limit tool sources before activating the new tool-size gate.
- Do not compress code or prose, and do not create a permanent “legacy tool” exemption.
- Move the completed migration ledger beside the completed plan or retire it after preserving necessary evidence.
- Do not leave permanent plan/phase citations outside `exec-plans/`.

---

## Implementation Order

### Phase A - Freeze current behavior and paired decisions

**Intent:** Capture a reproducible clean baseline and resolve the shared choices before deleting migration evidence.  
**Dependencies:** None.

#### A1. Record current proof

- Record current HEAD/clean state, tool versions, `npm run setup`, `npm run hooks:doctor`, `npm run check:all`,
  coverage summaries, dependency tree, and `npm audit --json` in this plan's progress log.
- Record exact hashes for the common SemVer corpus, actionlint checksum table, selected Action SHAs, and agreed common
  direct dependency set.

#### A2. Classify migration artifacts

- Produce a reference graph for every file under `tools/quality-policy/`.
- Mark each as one of: live gate input, live generated snapshot, current config, reusable generic tool, or completed
  migration-only evidence.
- Do not delete coverage/complexity/test provenance until its live consumer and replacement proof are explicit.

#### A3. Verify the AvNav metadata base

- Inspect current AvNav plugin-loader behavior and both exemplar `plugin.json` forms before authoring a generic schema.
- Define generic and Polar-profile cases without inventing upstream fields.

**Exit conditions:**

- The current full proof is green and recorded.
- Every proposed deletion has a verified non-live or replacement owner.
- Common pin/action/schema decisions match the paired plan.

### Phase B - Retire completed migration scaffolding and normalize the command graph

**Intent:** Make live scripts/tests/docs the only present-tense authority and archive historical migration evidence.  
**Dependencies:** Phase A.

#### B1. Normalize public script names

- Rename `check:docs` to `docs:check` and update `check:core`, docs, tests, and hook/release expectations.
- Introduce `schema:check` as the public package-schema leaf and compose `package:check` from it plus focused package
  tests, matching the shared contributor vocabulary.
- Keep `check:all`, `check:strict`, `check:standard`, `typecheck`, `check:smells`, and
  `test:coverage:check` semantics unchanged.

#### B2. Delete stale graph authority

- Delete `tools/quality-policy/command-graph.json` and its transitional
  `notYetActivatedLeaves` assertion. `package.json` plus `tests/js/command-graph.test.mjs` become the only live graph
  authority.
- Extend the command-graph test to prove `docs:check` and `schema:check` composition, ordered core membership,
  declared-leaf reachability, cycle absence, and failure propagation.

#### B3. Archive or remove migration-only captures

- Delete `generate_rule_parity_ledger.py` and `rule-parity-ledger.json` after verifying every row has a current
  maintained-tool/custom owner and focused negative proof.
- Delete `generate_verified_baseline.py` and `verified-baseline.json` after moving any still-live invariant to its real
  owner test/config.
- Remove `baseline-test-inventory.json` and its generator if Phase A confirms the active strict inventory and
  independently anchored empty exception baseline contain the complete live guarantee.
- Move `PLAN5Ledger.md` under `exec-plans/completed/` and repair the factual link in the completed plan, or consolidate
  and remove it if no useful unique evidence remains.
- Regenerate `format-scope.json` and remove comments/tests that cite deleted migration artifacts.

**Exit conditions:**

- No current source/test/doc points to a deleted ledger.
- The live script graph has one name and one tested owner per leaf.
- Completed historical plans remain readable but are not active gate inputs.
- `npm run test:tools`, `npm run docs:check`, and `npm run check:core` pass.

### Phase C - Activate maintained Markdown and link ownership

**Intent:** Complete the promised maintained-tool adoption while preserving Polar-specific doc contracts.  
**Dependencies:** Phase B.

#### C1. Wire standard documentation leaves

- Add `docs:lint` using markdownlint-cli2.
- Add a root-seeded Linkinator runner for root Markdown, `documentation/**`, and active plans with external HTTP(S)
  skipped and local fragments checked.
- Add `docs:links` and `docs:links:proof` scripts and compose `docs:check` as:
  markdown lint, Linkinator fixture proof, real local-link scan, then retained TOC/shape/reachability/smell/pointer
  contracts.
- Remove “not yet wired” comments and align Linkinator config semantics with Dyn.

#### C2. Make retained checkers testable

- Refactor `check-docs.mjs`, `check-doc-format.mjs`, and `check-doc-reachability.mjs` to export pure/testable `run*`
  entry points accepting root/print options while preserving CLI behavior.
- Add `tests/js/documentation-checkers.test.mjs` with real-root clean cases and temporary-root failures for missing TOC
  registration, missing required section, broken file link, broken fragment, and unreachable document.
- Ensure no checker independently reimplements Markdown fragment parsing now owned by Linkinator.

#### C3. Prove effective documentation scope

- Add a contract that every maintained Markdown file is reached by both Prettier and markdownlint and every
  link-bearing maintained Markdown file is an input to the root-seeded Linkinator scan.
- Keep completed plans/release notes archival and excluded.

**Exit conditions:**

- `npm run docs:lint`, `npm run docs:links:proof`, `npm run docs:links`, and `npm run docs:check` pass.
- Seeded missing-file and missing-fragment fixtures fail Linkinator.
- Every retained custom documentation rule has focused clean/failing tests.

### Phase D - Bring the quality-tool implementation under its own standards

**Intent:** Split oversized tools and make every maintained checker linted, typed, size-limited, and behavior-tested.  
**Dependencies:** Phases B and C.

#### D1. Split oversized JavaScript owners

- Split `check-patterns.mjs` by shared parsing and coherent rule families behind a thin CLI facade.
- Split `viewer-harness.mjs` by DOM/fake-response/loading responsibilities while preserving one public harness API.
- Split `check-file-size.mjs` by discovery/counting and JS compression rules.
- Split `check-coverage-inventory.mjs` by policy parsing, report normalization, and comparison/diagnostics.
- Split `check-js-duplication.mjs` by parse/normalization and clone comparison.
- Measure `test-inventory.mjs` and `complexity-scan.mjs` before edits and split them if added ownership would push them
  toward 400 lines.

#### D2. Split and standardize Python tools

- Delete the over-limit parity generator in Phase B.
- Split `mock-server.py` into a thin server entry point plus focused fake-data/request handlers without changing mock
  endpoints.
- Measure `check-py-contracts.py` and `check-py-dependencies.py` before edits; split before 400.
- Remove the broad Ruff `tools` exclusion. Apply Ruff format/lint to maintained Python tools with tool-appropriate
  rules rather than product-module `Documentation`/`Depends` headers.
- Add maintained Python tools to strict mypy ownership through a dedicated config/leaf if their CLI environment needs
  different imports from runtime/test code.
- Extend Python file-size checking to maintained tools and add clean/401-line/compression fixtures.

#### D3. Adopt the maintained JavaScript baseline

- Add `@eslint/js` and layer its recommended rules over all maintained JS/MJS before Polar-specific rules.
- Retain tool console output allowances and shipped-runtime restrictions.
- Add a negative tool fixture proving `no-undef`; the previously passing `missingGlobal();` probe must fail.
- Add `tsconfig.tools.json` and `typecheck:tools` for all maintained JS/MJS tools/configs. Exclude invalid fixtures by
  exact path or non-source extension, never by directory-sized ownership gaps.
- Add a completeness contract comparing tracked maintained tool source with the effective TypeScript project.

#### D4. Update checker contracts

- Require every custom JS checker CLI facade to export a `run*` entry point.
- Update `test:tools`, inventories, format scope, complexity/coverage classifications, and docs for all splits.
- Keep all behavior tests using temporary roots; do not mutate real product files in concurrently executable tests.

**Exit conditions:**

- No maintained JS/MJS/Python tool exceeds 400 non-empty lines.
- All maintained JS tools pass ESLint recommended and strict no-emit typechecking.
- All maintained Python tools pass Ruff and their strict mypy boundary.
- New/unclassified tool files, undefined JS globals, Python typing errors, and 401-line tools fail the intended leaves.
- `npm run check:standard`, `npm run typecheck`, `npm run test:tools`, and `npm run check:filesize` pass.

### Phase E - Align maintained versions, supply-chain pins, and supported setup

**Intent:** Eliminate common pin drift and provide an honest beginner bootstrap path.  
**Dependencies:** Phase D.

#### E1. Upgrade the common exact set

- Update `package.json` and `package-lock.json` to the agreed versions in Hard Constraints.
- Add Ajv 8.20.0 for the schema phase and keep Polar-only c8/acorn dependencies exact.
- Add the tested exact `js-yaml` override and remove the vulnerable direct 5.2.1 resolution.
- Add a package contract proving the effective override/version.

#### E2. Align action and advisory ownership

- Update the publisher to the agreed Action SHAs and retain transport-only workflow contracts.
- Keep actionlint 1.7.12 and the shared four checksums unless both plans update it together.
- Add a networked maintainer-only `dependencies:audit` command and a documented owner/date/expiry response process.
  Keep it outside `check:all`.

#### E3. Provide a novice-supported environment

- Preserve native setup as a locked, checksum/hash-verified path.
- Add a pinned, optional development container as the beginner/cross-host route with Node 26/npm 12.0.1 and the
  verified developer Python. Pin the base image by immutable digest and keep setup network access explicit.
- Test `npm run setup`, `npm run hooks:install`, `npm run hooks:doctor`, and `npm run check:all` inside the container.
- Replace host-specific rationale in `developer-python.json` with accurate native/container support statements. Do not
  claim native OS/Python combinations that were not executed.
- Keep Python 3.9 syntax/stdlib compatibility as a separate runtime contract and state honestly that the developer
  interpreter is newer.

**Exit conditions:**

- The paired repositories have identical common dependency versions, override, actionlint data, and Action SHAs.
- A fresh npm advisory query has no fixable high/critical common-tool finding, or a still-unfixed upstream issue has
  explicit time-bounded evidence.
- Native current-host setup and the documented container path pass without dirtying the worktree.
- Required gates remain offline after setup.

### Phase F - Replace hand-written metadata shape checks with base/profile Ajv schemas

**Intent:** Make package metadata validation maintained-tool-owned and extraction-ready.  
**Dependencies:** Phases A and E.

#### F1. Add generic and Polar profile schemas

- Add the upstream-verified generic AvNav `plugin.json` base schema.
- Add a Polar server-plugin profile composed with the base: development form permits no stamped version or duplicate
  declarative user-app registration; release form requires the release-stamped SemVer version while preserving the
  Python-owned registration boundary.
- Refactor `check-schema.mjs` into a thin Ajv runner plus the existing release-form builder. Remove hand-coded
  property/type validation now expressed by schema.

#### F2. Add common schema and SemVer corpora

- Add the agreed valid/invalid generic schema cases byte-identically with Dyn; keep Polar profile cases local.
- Run development and release forms, wrong types, duplicate user-app metadata, unknown/unsupported shapes, and version
  placement/format through the real runner.
- Retain the existing SemVer corpus and make Dyn consume the same bytes; continue testing every row against Polar's
  release-version implementation.

**Exit conditions:**

- `npm run schema:check` is a real maintained Ajv leaf reached by `package:check`.
- Existing release stamping/package tests remain green and artifact contents are unchanged.
- Both repositories agree on the generic schema and SemVer corpora.

### Phase G - Remove obsolete debt and make policy evidence portable

**Intent:** End the migration with clean strict defaults rather than carrying solved history into a future template.  
**Dependencies:** Phases D and F.

#### G1. Collapse the empty complexity history

- Because the active complexity baseline is empty, make `check:complexity` enforce the strict 10/40/4/6 limits
  directly with no historical exception path.
- Delete the Git-blob source capture, findings capture, capture generator, and required historical reconstruction after
  focused tests prove no active finding depends on them.
- Remove literal NUL bytes and add a maintained-source text contract that rejects future NULs.
- Keep the complexity scanner/budget's duplicate/identity diagnostics and negative fixtures.

#### G2. Raise viewer files to the generic floor

- Use the fresh coverage report to prove `grid-editor.js`, `settings-ui.js`, `timeline-chart.js`, and `viewer.js`
  already exceed 80% lines, then raise their stale floors to 80.
- Add meaningful `export-ui.js` behavior tests until its measured line coverage rises from the current 71.71% to at
  least 80%, without lowering branch/family floors.
- Raise their active and minimum floors only after coverage output proves the values.
- Retain higher existing per-file floors and all Python family/plugin floors.

#### G3. Simplify empty exception provenance

- Preserve the fail-closed all-strict JS test inventory and empty exception rule.
- Remove migration-only baseline machinery that no longer adds a guarantee, while keeping a direct test that any
  non-strict executable entry is invalid.
- Ensure a source copy with no `.git` passes complexity, coverage-inventory, and test-inventory checks.

**Exit conditions:**

- Active complexity and test exception sets are empty by construction.
- Every shipped viewer file has an 80% or higher line floor.
- No required policy check needs an unavailable historical Git object.
- Capture/policy mutation, new complexity, unclassified tests, and coverage regression still fail focused fixtures.

### Phase H - Add live-host validation, synchronize docs, and prove final alignment

**Intent:** Make the completed system honest, navigable, and mechanically comparable to the viewer-profile exemplar.  
**Dependencies:** Phases B–G.

#### H1. Add a profile-aware live AvNav checklist

- Add one release checklist with fields for date, AvNav version, plugin commit/version, host/device, browser, and
  results.
- Cover install/activate/load, log/status health, recording start/stop, representative API responses, viewer
  theme/chart/settings behavior, export/import, persistence across restart, package upgrade, and rollback.
- Make `release:prepare` print the checklist location without claiming completion automatically.

#### H2. Synchronize canonical guidance

- Update `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, quality/coding/smell/testing docs, documentation maintenance,
  release workflow, architecture orientation, and the TOC where needed.
- Remove statements that tools are maintained-owner-backed when they are not in the actual graph, and then describe
  the final real ownership.
- Keep `CLAUDE.md` a short pointer and keep completed migration records historical.

#### H3. Run final standalone and paired proof

- From clean setup, run hook doctor, every new negative proof, `npm run check:all`, package dry run, installer tests,
  and maintainer advisory query.
- Perform and record the real live-AvNav checklist.
- Mechanically compare the repositories' common versions, overrides, public command names/semantics, actionlint table,
  Action SHAs, generic schema corpus, SemVer corpus, and manual-checklist vocabulary. The comparison is completion
  evidence only and must not become a required repository command.

**Exit conditions:**

- All documentation lint/link/shape/reachability owners pass.
- Setup and gates leave the worktree clean.
- The paired comparison reports no unexplained common-contract drift.
- Completion evidence is recorded before moving this plan to `exec-plans/completed/`.

---

## User-Facing Documentation Impact

Runtime behavior and configuration do not change. `README.md` must still change because developer setup, supported
environment, advisory maintenance, package-schema terminology, and release/manual validation are contributor-visible.

Required updates:

- `README.md`: development/bootstrap paths, exact gates, supported native/container environment, advisory command, live
  validation.
- `CONTRIBUTING.md`: maintained Markdown tools, strict tool-code rules, dependency/action updates, release evidence.
- `AGENTS.md`: 400-line tool scope, quality checklist, schema base/profile routing, manual host validation.
- `documentation/conventions/quality-gates.md`: normalized script graph and exact owner map.
- `documentation/conventions/coding-standards.md`: tool lint/type/size contracts.
- `documentation/conventions/smell-prevention.md`: new/changed rule owners and negative proofs.
- `documentation/conventions/testing-infrastructure.md`: checker self-tests, tool type projects, portable policies.
- `documentation/guides/documentation-maintenance.md`: markdownlint/Linkinator/schema/advisory touchpoints.
- `documentation/guides/release-workflow.md`: aligned Action pins and live-host checklist.
- `ARCHITECTURE.md`: quality-policy/tool module split only if its structural map changes.
- `documentation/TABLEOFCONTENTS.md`: link any new focused validation/setup document.

No API, persistence, export/import, configuration, or viewer behavior changes are intended, so user fixtures change only
when new tests need additional existing-shape samples—not to alter product output.

---

## Acceptance Criteria

### Maintained documentation and command authority

- [ ] `docs:check` is the sole public documentation aggregate and is reached by `check:core`.
- [ ] markdownlint-cli2 and root-seeded Linkinator execute in `docs:check`.
- [ ] Missing local files and fragments fail focused Linkinator proofs.
- [ ] Every retained custom documentation checker exports a testable entry point with clean/failing fixtures.
- [ ] `command-graph.json` and transitional activation state are gone; the tested live script graph is authoritative.
- [ ] `schema:check` is a real public leaf reached by `package:check`.

### Migration-scaffolding retirement

- [ ] The rule-parity ledger/generator and verified pre-migration baseline/generator are removed after live owners are
      proved.
- [ ] Any test-baseline artifact retained has a live fail-closed purpose; migration-only inventory is removed.
- [ ] The completed migration plan/ledger is archived together and is not a current gate input.
- [ ] `format-scope.json` contains no deleted or stale owner.

### Tool-code integrity

- [ ] No maintained JS/MJS/Python tool exceeds 400 non-empty lines.
- [ ] All maintained JS tools use ESLint recommended rules and strict no-emit typing.
- [ ] All maintained Python tools use Ruff and a strict mypy boundary.
- [ ] New tool files fail closed until statically owned.
- [ ] Undefined JS globals, Python type errors, and over-limit tool fixtures fail their intended leaves.
- [ ] All changed custom checkers have clean and failing behavior tests.

### Cross-repository alignment

- [ ] Common exact dev dependencies and the `js-yaml` override match Dyninstruments.
- [ ] Node/npm, actionlint version/checksums, publisher Action SHAs, and common public script vocabulary match.
- [ ] The common generic schema and SemVer corpora are byte-identical and pass both real implementations.
- [ ] Python/pytest/mypy/Ruff and domain-specific checks are documented as the hybrid profile rather than unexplained
      divergence.

### Strict defaults and portability

- [ ] Active JavaScript complexity debt is empty and all functions meet 10/40/4/6.
- [ ] Executable-JS test exceptions remain empty.
- [ ] Every viewer file has at least an 80% line floor and all existing higher floors/family floors are preserved.
- [ ] Required policy gates pass without Polar's historical Git objects.
- [ ] Maintained tracked source contains zero literal NUL bytes.
- [ ] Runtime Python 3.9 compatibility remains enforced separately from the developer interpreter.

### Setup, release, and completion

- [ ] Native supported-host and documented container setup paths pass and leave the worktree clean.
- [ ] Advisory checks remain maintainer-only/networked; required gates remain offline after setup.
- [ ] Release ZIP contents and user-visible runtime behavior are unchanged.
- [ ] A real live-AvNav checklist result is recorded.
- [ ] `npm run hooks:doctor` passes after explicit hook installation.
- [ ] `npm run check:all` passes.
- [ ] Documentation, installer, schema, and package/release gates pass.
- [ ] Both worktrees are clean after final proof.
- [ ] Completion evidence is recorded and the implemented plan is moved to `exec-plans/completed/PLAN6.md`.

---

## Related

- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)
- [Release workflow](../../documentation/guides/release-workflow.md)
- [Core principles](../../documentation/core-principles.md)
